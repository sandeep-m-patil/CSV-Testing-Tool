import type { DiscoveryContext } from "../discovery/runner";
import type { GeneratedCase } from "../test-execution/types";
import type { DiscoveredControl } from "./fields";
import { groundControls, toAiElements, toGeneratedCase } from "./ai-cases";

/**
 * Asks the configured model (Gemini, OpenAI-compatible, Grok, local) for test
 * cases beyond the deterministic matrix. Advisory and best-effort: a timeout,
 * a malformed answer or an outage logs a warning and generation continues with
 * the deterministic cases alone.
 */

const AI_CASE_TIMEOUT_MS = 45_000;
/** Bounds model cost per discovery run; pages are visited in discovery order. */
const MAX_AI_PAGES_PER_RUN = 10;
const AI_NAME_PREFIX = "AI: ";

export interface AiPageTarget {
  page: { url: string; name: string; pageType: string | null };
  controls: DiscoveredControl[];
  /** Full stored names already taken in this module. */
  takenNames: Set<string>;
  /** Short names of this page's deterministic cases, so the model does not repeat them. */
  deterministicNames: string[];
}

/** Returns a per-run generator that stops calling the model after the page budget. */
export function createAiCaseGenerator(ctx: DiscoveryContext): (target: AiPageTarget) => Promise<number> {
  let pagesUsed = 0;
  return async (target) => {
    if (ctx.ai.kind === "mock" || target.controls.length === 0 || pagesUsed >= MAX_AI_PAGES_PER_RUN) return 0;
    pagesUsed += 1;
    try {
      return await generateForPage(ctx, target);
    } catch (error) {
      await ctx.store.log("warn", `${ctx.ai.label} test generation skipped for ${target.page.name}: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  };
}

async function generateForPage(ctx: DiscoveryContext, target: AiPageTarget): Promise<number> {
  const grounded = groundControls(target.controls);
  const hasCredential = ctx.credentials.length > 0;
  const suggestions = await withTimeout(
    ctx.ai.generateTestCases({
      moduleName: ctx.moduleName,
      pageUrl: target.page.url,
      pageName: target.page.name,
      pageType: target.page.pageType ?? undefined,
      hasCredential,
      elements: toAiElements(grounded),
      existingCaseNames: target.deterministicNames.slice(0, 100),
    }),
    AI_CASE_TIMEOUT_MS,
  );

  let inserted = 0;
  let rejected = 0;
  for (const suggestion of suggestions.cases) {
    const converted = toGeneratedCase(suggestion, grounded, { pageUrl: target.page.url, hasCredential });
    const name = `${ctx.moduleName} — ${AI_NAME_PREFIX}${suggestion.name}`;
    if (!converted) rejected += 1;
    if (!converted || target.takenNames.has(name)) continue;
    await insertAiCase(ctx, { ...converted, name }, target.page.name);
    target.takenNames.add(name);
    inserted += 1;
  }
  await ctx.store.log("event", `${ctx.ai.label} suggested ${suggestions.cases.length} case(s) for ${target.page.name}: ${inserted} added, ${rejected} rejected (unknown or incompatible elements).`);
  return inserted;
}

async function insertAiCase(ctx: DiscoveryContext, generated: GeneratedCase, pageName: string): Promise<void> {
  await ctx.store.insertTestCase({
    workflowId: undefined,
    name: generated.name,
    description: `${generated.description} (suggested by ${ctx.ai.label} for ${pageName}).`,
    type: generated.type,
    priority: generated.priority,
    role: ctx.role ?? null,
    precondition: ctx.credentials.length > 0 ? "login with role credentials" : null,
    testData: generated.testData,
    expectedResult: generated.expectedResult,
    steps: generated.steps,
    source: "ai",
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
