import { chromium, type Browser, type Page } from "playwright";
import { createAIProvider, type AIProvider } from "@repo/ai";
import { CredentialCrypto, createChildLogger, createStorage, type StorageProvider } from "@repo/core";
import { analyzeCurrentPage, resolveLocator, type AnalyzedPage, type DetectedAction } from "@repo/browser";
import type { Db } from "@repo/db";
import { credentials, discoveredActions, modules, projects, testDataSets } from "@repo/db/schema";
import { and, eq } from "drizzle-orm";
import { env } from "../env";
import type { WorkerEnv } from "../env";
import type { ActorContext, IndexedAction } from "./action-space";
import { actionKey, buildActionSpace, decideOneAction } from "./action-space";
import { DiscoveryStore, type ActionRecord } from "./store";
import { captureEvidence } from "../evidence";
import { buildModuleScope, describeScope, isInScope, type ModuleScope } from "./scope";
import { buildWorkflows } from "../workflows/builder";
import { generateTestCases } from "../test-generation/generator";

export interface RunInput {
  discoverySessionId: string;
  moduleId: string;
  projectId: string;
  role?: string;
  db: Db;
}

export interface DecodedCredential {
  id: string;
  role: string;
  username: string;
  password: string | null;
}

export interface DiscoveryContext {
  sessionId: string;
  moduleId: string;
  projectId: string;
  moduleName: string;
  moduleKeywords: string[];
  baseUrl: string;
  scope: ModuleScope;
  projectName: string;
  environment: string;
  credentials: DecodedCredential[];
  testData: Array<Record<string, string>>;
  role?: string;
  db: Db;
  store: DiscoveryStore;
  storage: StorageProvider;
  ai: AIProvider;
}

interface StepBudget {
  pages: number;
  actions: number;
  workflows: number;
}

const crypto = new CredentialCrypto();
const log = createChildLogger({ scope: "discovery" });

export async function runDiscovery(input: RunInput): Promise<void> {
  const { discoverySessionId, moduleId, projectId, db } = input;
  const store = new DiscoveryStore(db, { sessionId: discoverySessionId, moduleId });

  let browser: Browser | null = null;

  try {
    const [module] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
    if (!module) throw new Error("Module not found");

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) throw new Error("Project not found");

    const credentialRows = await db.select().from(credentials).where(eq(credentials.moduleId, moduleId));
    const dataSets = await db.select().from(testDataSets).where(eq(testDataSets.moduleId, moduleId));

    const desiredRole = input.role ?? credentialRows[0]?.role ?? null;
    const decoded = credentialRows
      .filter((credential) => !input.role || credential.role === input.role)
      .map((credential) => decodeCredential(credential, moduleId));

    const scope = buildModuleScope({
      baseUrl: project.baseUrl,
      startPath: module.startPath,
      includePaths: module.includePaths,
    });

    const ctx: DiscoveryContext = {
      sessionId: discoverySessionId,
      moduleId,
      projectId,
      moduleName: module.name,
      moduleKeywords: keywordize(module.name),
      baseUrl: project.baseUrl,
      scope,
      projectName: project.name,
      environment: project.environment,
      credentials: decoded.filter((credential) => credential.password !== null),
      testData: buildRowPool(dataSets.map((dataset) => dataset.data)),
      db,
      store,
      storage: createStorage({
        driver: env.STORAGE_DRIVER,
        localDir: env.STORAGE_LOCAL_DIR,
        publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
      }),
      ai: createAIProvider(resolveAiConfig(env)),
    };

    await store.updateSession({ status: "RUNNING", startedAt: new Date(), error: null });

    await store.log("event", `Discovery started for "${module.name}" (${project.environment}) using ${ctx.ai.label}.`);
    await store.log("event", `Module scope: ${describeScope(scope)} (start ${scope.startUrl}).`);
    await store.log("event", `Decrypted credentials available: ${ctx.credentials.map((credential) => credential.role).join(", ") || "none"}.`);
    for (const credential of decoded) {
      if (credential.password === null) {
        await store.log(
          "warn",
          `Role "${credential.role}" has no usable password — set it in the module's Config tab to explore authenticated pages.`,
        );
      }
    }
    await store.log("event", `Test data rows available: ${ctx.testData.length}.`);

    browser = await chromium.launch({ headless: env.BROWSER_HEADLESS });
    const budget: StepBudget = { pages: 0, actions: 0, workflows: 0 };

    const activeCredentials: DecodedCredential[] =
      ctx.credentials.length > 0 ? ctx.credentials : [{ id: "", role: "anonymous", username: "", password: null }];

    for (const credential of activeCredentials) {
      if (budget.pages >= env.DISCOVERY_MAX_PAGES || budget.actions >= env.DISCOVERY_MAX_STEPS) break;
      await store.log("event", `Exploring as role "${credential.role}".`);
      await exploreAsRole(browser, ctx, credential, budget);
    }

    budget.workflows = await buildWorkflows(ctx);
    // Gate on the pages and actions this session actually exercised, not on the
    // number of newly created workflows. buildWorkflows returns 0 when it
    // reuses workflows from an earlier run, which previously skipped test-case
    // generation entirely on every re-discovery.
    if ((await visitedPages(ctx)) > 0 && budget.actions > 0) {
      await generateTestCases(ctx);
    }

    await store.updateSession({
      status: "COMPLETED",
      pagesDiscovered: budget.pages,
      actionsDiscovered: budget.actions,
      workflowsDiscovered: budget.workflows,
      completedAt: new Date(),
      currentUrl: null,
      currentStep: null,
      error: null,
    });

    await db.update(modules).set({ discoveryStatus: "DISCOVERED", updatedAt: new Date() }).where(eq(modules.id, moduleId));
    await store.log(
      "event",
      `Discovery completed: ${budget.pages} pages, ${budget.actions} actions, ${budget.workflows} workflows.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.updateSession({ status: "FAILED", completedAt: new Date(), error: message, currentStep: null });
    await db.update(modules).set({ discoveryStatus: "FAILED", updatedAt: new Date() }).where(eq(modules.id, moduleId));

    await store.log("error", `Discovery failed: ${message}`);
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

/** Counts pages this session actually exercised, which is what generation needs. */
async function visitedPages(ctx: DiscoveryContext): Promise<number> {
  const rows = await ctx.db
    .select({ pageId: discoveredActions.pageId })
    .from(discoveredActions)
    .where(and(eq(discoveredActions.discoverySessionId, ctx.sessionId), eq(discoveredActions.executed, true)));
  return new Set(rows.map((row) => row.pageId)).size;
}

async function exploreAsRole(browser: Browser, ctx: DiscoveryContext, credential: DecodedCredential, budget: StepBudget): Promise<void> {
  const browserContext = await browser.newContext({ locale: "en-US" });
  const page = await browserContext.newPage();
  page.setDefaultTimeout(env.DISCOVERY_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(env.DISCOVERY_TIMEOUT_MS);

  const visitedUrls = new Set<string>();
  const actor: ActorContext = {
    baseUrl: ctx.baseUrl,
    scope: ctx.scope,
    moduleName: ctx.moduleName,
    moduleKeywords: ctx.moduleKeywords,
    roleUsername: credential.username || null,
    rolePassword: credential.password,
    testData: ctx.testData,
    visitedUrls,
    executedKeys: new Set<string>(),
    skippedUrls: new Set<string>(),
    onLoginPage: false,
    fillCount: 0,
    navigationDepth: 0,
    navigationDepthBudget: env.DISCOVERY_NAVIGATION_DEPTH,
  };

  try {
    await page.goto(ctx.scope.startUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    const first = await analyzeCurrentPage(page, navOptions(ctx));
    if (first && looksLikeLogin(first)) {
      actor.onLoginPage = true;
      await ctx.store.log("event", `Login page detected at ${page.url()}; authenticating as "${credential.role}".`);
    } else {
      await ctx.store.log("event", `Started at ${page.url()} (no login required).`);
    }

    await explorePage(page, ctx, actor, budget, visitedUrls, 0);
  } catch (error) {
    await ctx.store.log("warn", `Role exploration error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browserContext.close().catch(() => undefined);
  }
}

const SKIP_SAMPLE_SIZE = 5;

/**
 * Guard at the top of every page exploration: an out-of-scope URL is only
 * tolerated when it is the application's login gate (a redirect the module
 * must pass through to authenticate), never recorded as a module page.
 */
async function enterModuleScope(
  page: Page,
  ctx: DiscoveryContext,
  actor: ActorContext,
  currentUrl: string,
): Promise<boolean> {
  if (isInScope(ctx.scope, currentUrl)) return true;

  const outside = await analyzeCurrentPage(page, navOptions(ctx));
  if (outside && looksLikeLogin(outside)) {
    actor.onLoginPage = true;
    return true;
  }

  await noteSkippedUrl(ctx, actor, currentUrl);
  await page.goto(ctx.scope.startUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  return false;
}

async function noteSkippedUrl(ctx: DiscoveryContext, actor: ActorContext, url: string): Promise<void> {
  if (actor.skippedUrls.has(url)) return;
  actor.skippedUrls.add(url);
  await ctx.store.log("info", `Skipped ${url} — outside module scope (${describeScope(ctx.scope)}).`);
}

/** One summary line per page listing the links that were deliberately not followed. */
async function logSkippedLinks(ctx: DiscoveryContext, actor: ActorContext, actions: DetectedAction[]): Promise<void> {
  const outside = actions.filter(
    (action) =>
      action.action === "NAVIGATE" &&
      action.target.url &&
      !isInScope(ctx.scope, action.target.url) &&
      !actor.skippedUrls.has(action.target.url),
  );
  if (outside.length === 0) return;

  for (const action of outside) {
    if (action.target.url) actor.skippedUrls.add(action.target.url);
  }
  const sample = outside.slice(0, SKIP_SAMPLE_SIZE).map((action) => action.target.url);
  const remainder = outside.length - sample.length;
  await ctx.store.log(
    "info",
    `${outside.length} link(s) outside module scope not followed: ${sample.join(", ")}${remainder > 0 ? ` +${remainder} more` : ""}.`,
  );
}

async function explorePage(
  page: Page,
  ctx: DiscoveryContext,
  actor: ActorContext,
  budget: StepBudget,
  visitedUrls: Set<string>,
  depth: number,
): Promise<void> {
  const currentUrl = page.url();
  if (visitedUrls.has(currentUrl) || depth > actor.navigationDepthBudget) return;
  visitedUrls.add(currentUrl);
  actor.navigationDepth = depth;

  if (!(await enterModuleScope(page, ctx, actor, currentUrl))) return;

  const persistedActionKeys = new Set<string>();
  const finalizedPages = new Set<string>();
  let actionsOnPage = 0;

  while (
    actionsOnPage < env.DISCOVERY_MAX_ACTIONS_PER_PAGE &&
    budget.actions < env.DISCOVERY_MAX_STEPS &&
    budget.pages < env.DISCOVERY_MAX_PAGES
  ) {
    const analyzed = await analyzeCurrentPage(page, navOptions(ctx));
    if (!analyzed) break;

    const pageId = await ctx.store.insertPage({
      discoverySessionId: ctx.sessionId,
      moduleId: ctx.moduleId,
      url: analyzed.snapshot.url,
      title: analyzed.snapshot.title.slice(0, 300),
      name: pageName(analyzed),
      pageType: analyzed.classification.pageType,
      order: budget.pages,
    });

    if (!pageId.existing && budget.pages < env.DISCOVERY_MAX_PAGES) {
      await persistPageSnapshot(ctx, budget, page, analyzed, pageId.id, finalizedPages);
    }

    const freshActions = analyzed.actions.filter((action) => !persistedActionKeys.has(actionKey(action)));
    const actionIds = await ctx.store.insertActions(pageId.id, freshActions.map(toActionRecord));
    freshActions.forEach((action) => persistedActionKeys.add(actionKey(action)));

    const space = buildActionSpace(analyzed.snapshot.elements, analyzed.actions);
    actor.onLoginPage = looksLikeLogin(analyzed);

    const decision = decideOneAction(space, actor);
    if (decision.index === null) {
      await logSkippedLinks(ctx, actor, analyzed.actions);
      break;
    }

    const chosen = space.find((item) => item.index === decision.index);
    if (!chosen) break;

    const stepStartUrl = page.url();
    const executed = await executeOne(ctx, page, chosen, decision);

    // Evidence screenshot after EVERY executed action (redacted before capture).
    const actionRowId = actionIds[actionKey(chosen.action)];
    await recordEvidence(ctx, page, chosen, decision, actionRowId, pageId.id);
    budget.actions += 1;

    // Dispatch session count + executed flag + log write in parallel (single round-trip window).
    const writes: Promise<unknown>[] = [
      ctx.store.updateSession({ actionsDiscovered: budget.actions }),
      ctx.store.log("action", `[${decision.kind}] ${chosen.label}${decision.value !== undefined ? ` = "${decision.value}"` : ""}`),
    ];
    if (actionRowId) writes.push(ctx.store.setExecuted(actionRowId));
    await Promise.all(writes);

    if (!executed) {
      // A failed action is consumed too: retrying it repeatedly (e.g. an
      // ambiguous or vanished locator) would waste the whole step budget.
      actor.executedKeys.add(actionKey(chosen.action));
      actionsOnPage += 1;
      continue;
    }

    actor.executedKeys.add(actionKey(chosen.action));
    actionsOnPage += 1;
    if (decision.value !== undefined) actor.fillCount += 1;

    if (page.url() !== stepStartUrl) {
      // A link that leaves the module scope is never recorded or crawled; the
      // run returns to the module start path and keeps exploring the module.
      if (!isInScope(ctx.scope, page.url())) {
        await noteSkippedUrl(ctx, actor, page.url());
        await page.goto(ctx.scope.startUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        continue;
      }

      const nextPageId = await findOrCreateNextPage(page, ctx, visitedUrls, budget, finalizedPages);
      if (nextPageId) {
        await ctx.store.insertTransition({
          fromPageId: pageId.id,
          toPageId: nextPageId,
          actionId: actionRowId ?? null,
          label: `${chosen.label} → ${page.url()}`,
        });
      }
      await explorePage(page, ctx, actor, budget, visitedUrls, depth + 1);
      return;
    }
  }
}

async function persistPageSnapshot(
  ctx: DiscoveryContext,
  budget: StepBudget,
  page: Page,
  analyzed: AnalyzedPage,
  pageId: string,
  finalizedPages: Set<string>,
): Promise<void> {
  if (finalizedPages.has(analyzed.snapshot.url)) return;
  finalizedPages.add(analyzed.snapshot.url);

  await ctx.store.insertElements(
    pageId,
    analyzed.snapshot.elements.map((element) => ({
      elementType: element.elementType,
      role: element.role,
      name: element.name,
      text: element.text,
      placeholder: element.placeholder,
      label: element.label,
      testId: element.testId,
      cssSelector: element.cssSelector,
      xpath: element.xpath,
      ariaAttributes: element.ariaAttributes,
      visible: element.visible,
      enabled: element.enabled,
    })),
  );
  budget.pages += 1;
  await ctx.store.updateSession({ pagesDiscovered: budget.pages, currentUrl: analyzed.snapshot.url });

  const evidence = await captureEvidence(ctx, page, {
    label: `Page: ${pageName(analyzed)}`,
    suffix: `page-${budget.pages}`,
  });
  if (evidence) {
    await ctx.store.insertArtifact({
      artifactType: "screenshot",
      storageKey: evidence.storageKey,
      url: evidence.url,
      label: `Page: ${pageName(analyzed)}`,
      pageId,
    });
  }
  await ctx.store.log("info", `Page discovered: ${pageName(analyzed)} (${analyzed.classification.pageType}) — ${analyzed.snapshot.url}`);
}

async function recordEvidence(
  ctx: DiscoveryContext,
  page: Page,
  chosen: IndexedAction,
  decision: { kind: string; value?: string },
  actionId: string | undefined,
  pageId: string,
): Promise<void> {
  const label = `After ${chosen.label}${decision.value !== undefined ? ` (${decision.value})` : ""}`;
  const evidence = await captureEvidence(ctx, page, {
    label,
    suffix: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    secrets: ctx.credentials.map((credential) => credential.password ?? "").filter(Boolean),
  });
  if (!evidence) return;
  await ctx.store.insertArtifact({
    artifactType: "screenshot",
    storageKey: evidence.storageKey,
    url: evidence.url,
    label,
    actionId,
    pageId,
  });
}

async function findOrCreateNextPage(
  page: Page,
  ctx: DiscoveryContext,
  visitedUrls: Set<string>,
  budget: StepBudget,
  finalizedPages: Set<string>,
): Promise<string | null> {
  const analyzed = await analyzeCurrentPage(page, navOptions(ctx));
  if (!analyzed) return null;

  const record = await ctx.store.insertPage({
    discoverySessionId: ctx.sessionId,
    moduleId: ctx.moduleId,
    url: analyzed.snapshot.url,
    title: analyzed.snapshot.title.slice(0, 300),
    name: pageName(analyzed),
    pageType: analyzed.classification.pageType,
    order: budget.pages,
  });
  if (!record.existing && budget.pages < env.DISCOVERY_MAX_PAGES) {
    await persistPageSnapshot(ctx, budget, page, analyzed, record.id, finalizedPages);
  }
  return record.id;
}

export async function executeOne(
  ctx: DiscoveryContext,
  page: Page,
  chosen: IndexedAction,
  decision: { kind: string; value?: string },
): Promise<boolean> {
  try {
    const locator = await resolveLocator(page, chosen.selector);
    await locator.waitFor({ state: "visible", timeout: 6000 }).catch(() => undefined);

    if (chosen.operation === "FILL") {
      if (chosen.element?.elementType === "select" || (chosen.element?.role ?? "").includes("combobox")) {
        await locator.selectOption({ index: 0 });
      } else {
        await locator.fill(decision.value ?? "");
      }
    } else if (chosen.operation === "SELECT") {
      await locator.selectOption({ index: 0 });
    } else if (chosen.operation === "CHECK" || chosen.operation === "UNCHECK") {
      await locator.check();
    } else if (chosen.operation === "CLOSE_DIALOG") {
      await locator.click({ force: true }).catch(() => page.keyboard.press("Escape"));
    } else {
      // CLICK / SUBMIT / NAVIGATE
      await locator.click();
      if (chosen.operation === "NAVIGATE") {
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      }
    }

    if (env.DISCOVERY_PAGE_SLEEP_MS > 0) {
      await page.waitForTimeout(env.DISCOVERY_PAGE_SLEEP_MS);
    }
    return true;
  } catch (error) {
    await ctx.store.log("warn", `Failed ${chosen.operation} "${chosen.label}": ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// ---------- helpers ----------

/**
 * Decrypt a stored credential.
 *
 * The encryption scope must match apps/web/app/api/modules/[moduleId]/credentials/route.ts,
 * which encrypts with the module id. `secretData` holds "iv:authTag:ciphertext", not JSON,
 * so a JSON parse is only attempted to detect seeded placeholder rows.
 */
function decodeCredential(
  credential: { id: string; role: string; username: string; secretData: string },
  moduleId: string,
): DecodedCredential {
  const base = { id: credential.id, role: credential.role, username: credential.username, password: null };

  if (isPlaceholderSecret(credential.secretData)) return base;

  try {
    const decrypted = crypto.decryptCredentials(moduleId, credential.secretData);
    return decrypted?.password ? { ...base, password: decrypted.password } : base;
  } catch (error) {
    log.warn(
      { role: credential.role, error },
      "credential decryption failed",
    );
    return base;
  }
}

function isPlaceholderSecret(secretData: string): boolean {
  try {
    const parsed: unknown = JSON.parse(secretData);
    return typeof parsed === "object" && parsed !== null && "placeholder" in parsed;
  } catch {
    // Ciphertext is not JSON, so it is a real (encrypted) credential.
    return false;
  }
}

function buildRowPool(dataValues: unknown[]): Array<Record<string, string>> {
  const pool: Array<Record<string, string>> = [];
  for (const raw of dataValues) {
    const data = raw as { type?: string; values?: Record<string, unknown>; rows?: Array<Record<string, unknown>> };
    if (!data || typeof data !== "object") continue;
    if (data.type === "key_value" && data.values) {
      pool.push(stringifyRecord(data.values));
    } else if (data.type === "csv" && Array.isArray(data.rows)) {
      for (const row of data.rows) pool.push(stringifyRecord(row));
    }
  }
  return pool;
}

function stringifyRecord(record: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(record)) {
    const value = record[key];
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

function keywordize(moduleName: string): string[] {
  return moduleName
    .split(/[\s&,]+/)
    .filter((word) => word.length > 2)
    .map((word) => word.toLowerCase());
}

function navOptions(ctx: DiscoveryContext) {
  return { baseUrl: ctx.baseUrl, moduleKeywords: ctx.moduleKeywords, maxCandidates: 15 };
}

function looksLikeLogin(analyzed: AnalyzedPage): boolean {
  const lower = `${analyzed.snapshot.url} ${analyzed.snapshot.title} ${analyzed.snapshot.heading ?? ""}`.toLowerCase();
  const hasPassword = analyzed.snapshot.elements.some((element) => element.inputType === "password");
  return /(login|signin|sign in|authenticate)/.test(lower) && hasPassword;
}

function pageName(analyzed: AnalyzedPage): string {
  return (analyzed.snapshot.heading ?? (analyzed.snapshot.title || "Untitled")).slice(0, 200);
}

function toActionRecord(action: DetectedAction): ActionRecord {
  return {
    action: action.action,
    target: action.target as unknown as Record<string, unknown>,
    dangerous: action.dangerous,
    blocked: action.blocked,
    executed: false,
  };
}

function resolveAiConfig(workerEnv: WorkerEnv) {
  return {
    provider: workerEnv.AI_PROVIDER,
    openaiApiKey: workerEnv.OPENAI_API_KEY ?? undefined,
    openaiBaseUrl: workerEnv.OPENAI_BASE_URL ?? undefined,
    openaiModel: workerEnv.OPENAI_MODEL ?? undefined,
    localBaseUrl: workerEnv.LOCAL_AI_BASE_URL ?? undefined,
    localModel: workerEnv.LOCAL_AI_MODEL ?? undefined,
  };
}