import { and, asc, eq } from "drizzle-orm";
import { discoveredActions, discoveredPages, stateTransitions } from "@repo/db/schema";
import type { DiscoveryContext } from "../discovery/runner";
import type { WorkflowStep } from "./types";

interface PageModel {
  id: string;
  url: string;
  name: string;
  pageType: string;
  /** Purpose recorded by the AI provider during discovery, if any. */
  aiPurpose: string | null;
}

interface ExecutedStep {
  pageId: string;
  action: string;
  targetLabel: string;
  cssSelector: string | null;
  executed: boolean;
  order: number;
}

/**
 * Deterministically build DRAFT workflows from the executed action trace:
 * a form workflow for every page where we filled + submitted, and a
 * navigation workflow for every reachable page. Steps reference locator
 * metadata recorded during discovery.
 */
export async function buildWorkflows(ctx: DiscoveryContext): Promise<number> {
  const pages = await ctx.db.select().from(discoveredPages).where(eq(discoveredPages.discoverySessionId, ctx.sessionId)).orderBy(asc(discoveredPages.order));
  const actions = await ctx.db
    .select()
    .from(discoveredActions)
    .where(and(eq(discoveredActions.discoverySessionId, ctx.sessionId), eq(discoveredActions.executed, true)))
    .orderBy(asc(discoveredActions.createdAt));
  const transitions = await ctx.db.select().from(stateTransitions).where(eq(stateTransitions.discoverySessionId, ctx.sessionId));

  const pageById = new Map(pages.map((page) => [page.id, page] satisfies [string, PageModel]));
  const intents = await loadPageIntents(ctx, pages);

  const stepsByPage = new Map<string, ExecutedStep[]>();
  for (const action of actions) {
    const targetInfo = action.target as { label?: string; text?: string; cssSelector?: string; url?: string };
    const label = targetInfo.label ?? targetInfo.text ?? targetInfo.url ?? action.action;
    const steps = stepsByPage.get(action.pageId) ?? [];
    steps.push({
      pageId: action.pageId,
      action: action.action,
      targetLabel: label,
      cssSelector: targetInfo.cssSelector ?? null,
      executed: action.executed,
      order: steps.length + 1,
    });
    stepsByPage.set(action.pageId, steps);
  }

  const workflowPages = pages.filter((page) => {
    const steps = stepsByPage.get(page.id);
    if (!steps) return false;
    const didFill = steps.some((step) => step.action === "FILL");
    const didSubmit = steps.some((step) => step.action === "SUBMIT");
    return didFill || didSubmit;
  });

  const created: number[] = [];

  for (const page of workflowPages) {
    const steps = stepsByPage.get(page.id) ?? [];
    const role = ctx.credentials.find((credential) => credential.id)?.role ?? "authenticated";
    const workflowSteps = buildFormWorkflow(page, steps, ctx);
    const destination = findTransitionDestination(page.id, pageById, transitions);

    const fullSteps: WorkflowStep[] = [
      { order: 1, action: "GOTO", target: page.url },
      ...workflowSteps.map((step, index) => ({ ...step, order: index + 2 })),
      ...(destination
        ? [
            { order: workflowSteps.length + 2, action: "SUBMIT", target: "submit form", optional: false } satisfies WorkflowStep,
            { order: workflowSteps.length + 3, action: "VERIFY", target: `successful navigation to ${destination.name}` } satisfies WorkflowStep,
          ]
        : [{ order: workflowSteps.length + 2, action: "VERIFY", target: `${page.name} loads without errors` } satisfies WorkflowStep]),
    ];

    const workflowId = await ctx.store.insertWorkflowAndSteps(
      {
        name: `Submit ${ctx.moduleName} — ${page.name}`,
        // Prefer the model's description of what this page is for; it is richer
        // than "filled the form", and it comes from the same redacted snapshot.
        description: intents.get(page.id) ?? `Filled the ${page.name} form with test data and submitted it during autonomous discovery.`,
        preconditions: [`login as ${role}`],
        steps: fullSteps,
        source: "discovered",
        confidence: "1.0",
      },
      role,
    );
    if (workflowId) created.push(1);
  }

  // Navigation workflows for discovered list/detail/dashboard pages that were reached by a link.
  const navPages = pages.filter((page) => !workflowPages.includes(page));
  for (const page of navPages) {
    if (page.pageType === "login" || page.pageType === "core") continue;
    const workflowId = await ctx.store.insertWorkflowAndSteps(
      {
        name: `Navigate to ${page.name}`,
        description: intents.get(page.id) ?? `Reachable page ${page.pageType} at ${page.url}.`,
        preconditions: [],
        steps: [
          { order: 1, action: "GOTO", target: page.url },
          { order: 2, action: "VERIFY", target: `heading "${page.name}" is visible` },
        ],
        source: "discovered",
        confidence: "1.0",
      },
      ctx.role ?? null,
    );
    if (workflowId) created.push(1);
  }

  return created.length;
}

/** Purpose text the AI recorded per page, if any. Never required. */
async function loadPageIntents(ctx: DiscoveryContext, pages: PageModel[]): Promise<Map<string, string>> {
  const intents = new Map<string, string>();
  for (const page of pages) {
    if (page.aiPurpose && page.aiPurpose.length > 0) intents.set(page.id, page.aiPurpose);
  }
  return intents;
}

/**
 * Asks the model to name the user-facing journeys it can see in the discovered
 * graph. The result is advisory metadata only: it is logged and stored as intent,
 * and never becomes an executable step, because the model does not know which
 * locators or values the executor will use.
 *
 * Any failure is swallowed. Discovery must not depend on an AI provider.
 */
export async function enrichWithAiAnalysis(ctx: DiscoveryContext): Promise<void> {
  if (ctx.ai.kind === "mock") {
    await ctx.store.log("info", "AI workflow analysis skipped: no provider configured (heuristic classification used).");
    return;
  }

  const [pages, transitions] = await Promise.all([
    ctx.db
      .select({ id: discoveredPages.id, name: discoveredPages.name, url: discoveredPages.url, pageType: discoveredPages.pageType })
      .from(discoveredPages)
      .where(eq(discoveredPages.discoverySessionId, ctx.sessionId)),
    ctx.db
      .select({ label: stateTransitions.label, fromPageId: stateTransitions.fromPageId, toPageId: stateTransitions.toPageId })
      .from(stateTransitions)
      .where(eq(stateTransitions.discoverySessionId, ctx.sessionId)),
  ]);
  if (pages.length === 0) return;

  const nameById = new Map(pages.map((page) => [page.id, page.name] satisfies [string, string]));
  try {
    const analysis = await ctx.ai.analyzeWorkflows({
      moduleName: ctx.moduleName,
      pages: pages.map((page) => ({ name: page.name, url: page.url, pageType: page.pageType })),
      transitions: transitions.map((transition) => ({
        label: transition.label,
        from: nameById.get(transition.fromPageId) ?? transition.fromPageId,
        to: nameById.get(transition.toPageId) ?? transition.toPageId,
      })),
    });
    await ctx.store.log(
      "info",
      `AI analysed ${pages.length} page(s) via ${ctx.ai.kind}: ${analysis.workflows.length} candidate journey(s). ${analysis.purpose}`,
    );
    for (const workflow of analysis.workflows.slice(0, 20)) {
      await ctx.store.log("info", `  candidate journey: ${workflow.name} — ${workflow.steps.join(" → ")}`);
    }
  } catch (error) {
    await ctx.store.log("warn", `AI workflow analysis unavailable (${error instanceof Error ? error.message : String(error)}); continuing with heuristic workflows.`);
  }
}

function buildFormWorkflow(page: PageModel, steps: ExecutedStep[], ctx: DiscoveryContext): WorkflowStep[] {
  const filled: WorkflowStep[] = [];
  let submitLabel = "Submit";

  for (const step of steps) {
    if (step.action === "FILL") {
      const value = resolveStepValue(step, ctx);
      filled.push({ order: filled.length + 1, action: "FILL", target: step.targetLabel, value });
    } else if (step.action === "SUBMIT") {
      submitLabel = step.targetLabel;
    } else if (step.action === "SELECT") {
      filled.push({ order: filled.length + 1, action: "SELECT", target: step.targetLabel, value: "first option" });
    } else if (step.action === "CHECK") {
      filled.push({ order: filled.length + 1, action: "CHECK", target: step.targetLabel, value: "checked" });
    }
  }

  void page;
  return [...filled, { order: filled.length + 1, action: "SUBMIT", target: submitLabel }];
}

export function resolveStepValue(step: ExecutedStep, ctx: DiscoveryContext): string {
  const normalized = `${step.targetLabel}`.toLowerCase();
  for (const row of ctx.testData) {
    const entry = Object.entries(row).find(([key]) => normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized));
    if (entry && entry[1]) return entry[1];
  }
  if (/(email)/.test(normalized)) return "autotest@test.local";
  return `${step.targetLabel.replace(/[^a-z0-9]+/gi, "_").slice(0, 20).toLowerCase()}_auto`;
}

function findTransitionDestination(pageId: string, pageById: Map<string, PageModel>, transitions: Array<{ fromPageId: string; toPageId: string }>): PageModel | null {
  for (const transition of transitions) {
    if (transition.fromPageId !== pageId) continue;
    const destination = pageById.get(transition.toPageId);
    if (destination && destination.pageType !== "login" && destination.id !== pageId) return destination;
  }
  return null;
}