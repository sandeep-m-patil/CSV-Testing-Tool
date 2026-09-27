import { and, asc, eq } from "drizzle-orm";
import { discoveredActions, discoveredPages } from "@repo/db/schema";
import type { DiscoveryContext } from "../discovery/runner";
import { resolveStepValue } from "../workflows/builder";

interface ExecutedAction {
  pageId: string;
  action: string;
  targetLabel: string;
}

const ACTION_STEP_TYPE = "action";
const VERIFY_STEP_TYPE = "verify";

/**
 * Deterministically generate DRAFT test cases from the executed action trace:
 * one functional case per page where a form was filled + submitted, and one
 * smoke case that just loads the application landing page.
 */
export async function generateTestCases(ctx: DiscoveryContext): Promise<number> {
  const pages = await ctx.db.select().from(discoveredPages).where(eq(discoveredPages.discoverySessionId, ctx.sessionId)).orderBy(asc(discoveredPages.order));
  const actions = await ctx.db
    .select()
    .from(discoveredActions)
    .where(and(eq(discoveredActions.discoverySessionId, ctx.sessionId), eq(discoveredActions.executed, true)))
    .orderBy(asc(discoveredActions.createdAt));

  const actionsByPage = new Map<string, ExecutedAction[]>();
  for (const action of actions) {
    const targetInfo = action.target as { label?: string; text?: string; url?: string };
    const label = targetInfo.label ?? targetInfo.text ?? targetInfo.url ?? action.action;
    const list = actionsByPage.get(action.pageId) ?? [];
    list.push({ pageId: action.pageId, action: action.action, targetLabel: label });
    actionsByPage.set(action.pageId, list);
  }

  let count = 0;

  for (const page of pages) {
    const pageActions = actionsByPage.get(page.id);
    if (!pageActions || pageActions.length === 0) continue;

    const didFill = pageActions.some((action) => action.action === "FILL");
    const didSubmit = pageActions.some((action) => action.action === "SUBMIT");
    if (!didFill && !didSubmit) continue;

    const steps: Array<{ order: number; action: string; target: string; value?: string; stepType: string }> = [];
    steps.push({ order: 1, action: "GOTO", target: page.url, stepType: ACTION_STEP_TYPE });

    for (const action of pageActions) {
      if (action.action === "FILL") {
        const value = resolveStepValue({ ...action, cssSelector: null, executed: true, order: steps.length }, ctx);
        steps.push({ order: steps.length + 1, action: "FILL", target: action.targetLabel, value, stepType: ACTION_STEP_TYPE });
      } else if (action.action === "SELECT" || action.action === "CHECK" || action.action === "UNCHECK") {
        steps.push({ order: steps.length + 1, action: action.action, target: action.targetLabel, value: "first option", stepType: ACTION_STEP_TYPE });
      } else if (action.action === "SUBMIT") {
        steps.push({ order: steps.length + 1, action: "SUBMIT", target: action.targetLabel, stepType: ACTION_STEP_TYPE });
      }
    }

    steps.push({ order: steps.length + 1, action: "VERIFY", target: `${page.name} page loads without errors`, stepType: VERIFY_STEP_TYPE });

    await ctx.store.insertTestCase({
      workflowId: undefined,
      name: `${ctx.moduleName} — ${page.name} form submission`,
      description: `Filled and submitted the form on ${page.name} with generated test data during autonomous discovery.`,
      type: "functional",
      priority: didSubmit ? "high" : "normal",
      role: ctx.role ?? null,
      precondition: ctx.credentials.some((credential) => credential.password !== null) ? "login with role credentials" : null,
      steps,
    });
    count += 1;
  }

  if (count === 0) {
    await ctx.store.insertTestCase({
      workflowId: undefined,
      name: `${ctx.moduleName} — smoke test`,
      description: "Application landing page loads successfully.",
      type: "smoke",
      priority: "high",
      role: ctx.role ?? null,
      precondition: null,
      steps: [
        { order: 1, action: "GOTO", target: ctx.baseUrl, stepType: ACTION_STEP_TYPE },
        { order: 2, action: "VERIFY", target: `${ctx.moduleName} application loads`, stepType: VERIFY_STEP_TYPE },
      ],
    });
    count = 1;
  }

  return count;
}