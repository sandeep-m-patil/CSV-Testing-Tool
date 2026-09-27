import { and, asc, eq } from "drizzle-orm";
import { discoveredActions, discoveredElements, discoveredPages } from "@repo/db/schema";
import type { DiscoveryContext } from "../discovery/runner";
import { classifyFields, type DiscoveredControl } from "./fields";
import { buildScenariosForPage, isAuthForm } from "./scenarios";

const INPUT_TYPES = ["input", "textarea", "select", "button", "a", "link"];

/**
 * Deterministically generate DRAFT test cases from the executed action trace.
 * Pages whose controls classify as an auth form get the full login matrix
 * (happy path, negative, validation, boundary, security, UI); every other form
 * gets a smaller baseline. A smoke case is always emitted as a floor.
 */
export async function generateTestCases(ctx: DiscoveryContext): Promise<number> {
  const pages = await ctx.db.select().from(discoveredPages).where(eq(discoveredPages.discoverySessionId, ctx.sessionId)).orderBy(asc(discoveredPages.order));
  const actions = await ctx.db
    .select()
    .from(discoveredActions)
    .where(and(eq(discoveredActions.discoverySessionId, ctx.sessionId), eq(discoveredActions.executed, true)))
    .orderBy(asc(discoveredActions.createdAt));

  const visited = new Set(actions.map((action) => action.pageId));
  let count = 0;

  for (const page of pages) {
    if (!visited.has(page.id)) continue;
    const controls = await loadControls(ctx, page.id);
    const fields = classifyFields(controls);
    const scenarios = buildScenariosForPage({ pageUrl: page.url, pageName: page.name, fields });
    if (scenarios.length === 0) continue;

    for (const scenario of scenarios) {
      await ctx.store.insertTestCase({
        workflowId: undefined,
        name: `${ctx.moduleName} — ${scenario.name}`,
        description: `${scenario.description} (auto-generated from ${isAuthForm(fields) ? "auth form" : "form"} analysis on ${page.name}).`,
        type: scenario.type,
        priority: scenario.priority,
        role: ctx.role ?? null,
        precondition: ctx.credentials.length > 0 ? "login with role credentials" : null,
        testData: scenario.testData,
        expectedResult: scenario.expectedResult,
        steps: scenario.steps,
      });
      count += 1;
    }
  }

  if (count === 0) count = await insertSmokeCase(ctx);
  return count;
}

async function loadControls(ctx: DiscoveryContext, pageId: string): Promise<DiscoveredControl[]> {
  const rows = await ctx.db
    .select()
    .from(discoveredElements)
    .where(eq(discoveredElements.pageId, pageId))
    .orderBy(asc(discoveredElements.createdAt));

  return rows
    .filter((row) => INPUT_TYPES.includes(row.elementType.toLowerCase()))
    .map((row) => ({
      elementType: row.elementType,
      name: row.name,
      label: row.label,
      placeholder: row.placeholder,
      testId: row.testId,
      cssSelector: row.cssSelector,
      ariaAttributes: row.ariaAttributes,
    }));
}

async function insertSmokeCase(ctx: DiscoveryContext): Promise<number> {
  await ctx.store.insertTestCase({
    workflowId: undefined,
    name: `${ctx.moduleName} — smoke test`,
    description: "Application landing page loads successfully.",
    type: "smoke",
    priority: "high",
    role: ctx.role ?? null,
    precondition: null,
    testData: "navigate to the application root",
    expectedResult: "The application loads and stays responsive",
    steps: [
      { order: 1, action: "GOTO", target: ctx.baseUrl, stepType: "action" },
      {
        order: 2,
        action: "VERIFY",
        target: ctx.baseUrl,
        stepType: "verify",
        expect: { kind: "app_responsive" },
      },
    ],
  });
  return 1;
}
