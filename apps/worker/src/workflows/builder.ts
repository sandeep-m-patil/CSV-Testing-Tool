import { and, asc, eq } from "drizzle-orm";
import { discoveredActions, discoveredPages, stateTransitions } from "@repo/db/schema";
import type { DiscoveryContext } from "../discovery/runner";
import type { WorkflowStep } from "./types";

interface PageModel {
  id: string;
  url: string;
  name: string;
  pageType: string;
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
      { order: workflowSteps.length + 1, action: "GOTO", target: page.url },
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
        description: `Filled the ${page.name} form with test data and submitted it during autonomous discovery.`,
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
        description: `Reachable page ${page.pageType} at ${page.url}.`,
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