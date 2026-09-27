import { and, asc, eq } from "drizzle-orm";
import { discoveredActions, discoveredElements, discoveredPages, testCases } from "@repo/db/schema";
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

  // Re-running discovery must not duplicate cases a previous run generated, so
  // the name is the dedup key. A match is *refreshed* rather than skipped:
  // skipping would leave steps holding values from the earlier generation (for
  // example demo credentials) after the module's real credential was added.
  const existing = new Map(
    (
      await ctx.db
        .select({ id: testCases.id, name: testCases.name, source: testCases.source, steps: testCases.steps, testData: testCases.testData, expectedResult: testCases.expectedResult, precondition: testCases.precondition, description: testCases.description })
        .from(testCases)
        .where(eq(testCases.moduleId, ctx.moduleId))
    ).map((row) => [row.name, row]),
  );

  for (const page of pages) {
    if (!visited.has(page.id)) continue;
    const controls = await loadControls(ctx, page.id);
    const fields = classifyFields(controls);
    // A module may hold several roles; the login matrix is written against the
    // first one, which is the role the module itself was discovered with.
    const primary = ctx.credentials[0];
    const scenarios = buildScenariosForPage({
      pageUrl: page.url,
      pageName: page.name,
      fields,
      controls,
      credential: primary ? { username: primary.username, password: primary.password } : undefined,
    });
    if (scenarios.length === 0) continue;

    for (const scenario of scenarios) {
      const name = `${ctx.moduleName} — ${scenario.name}`;
      const description = `${scenario.description} (auto-generated from ${isAuthForm(fields) ? "auth form" : "form"} analysis on ${page.name}).`;
      const precondition = ctx.credentials.length > 0 ? "login with role credentials" : null;

      const match = existing.get(name);
      if (match && match.source !== "generated") {
        // Hand-authored case: leave it exactly as the author wrote it.
        continue;
      }

      if (match) {
        const unchanged =
          JSON.stringify(match.steps) === JSON.stringify(scenario.steps) &&
          match.testData === scenario.testData &&
          match.expectedResult === scenario.expectedResult &&
          match.precondition === precondition;
        if (unchanged) continue;
        await ctx.store.reconcileTestCase(match.id, {
          description,
          precondition,
          testData: scenario.testData,
          expectedResult: scenario.expectedResult,
          steps: scenario.steps,
        });
        count += 1;
        continue;
      }

      await ctx.store.insertTestCase({
        workflowId: undefined,
        name,
        description,
        type: scenario.type,
        priority: scenario.priority,
        role: ctx.role ?? null,
        precondition,
        testData: scenario.testData,
        expectedResult: scenario.expectedResult,
        steps: scenario.steps,
      });
      count += 1;
    }
  }

  if (count === 0) count = await insertSmokeCase(ctx, existing);
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
      text: row.text,
      testId: row.testId,
      cssSelector: row.cssSelector,
      ariaAttributes: row.ariaAttributes,
    }));
}

async function insertSmokeCase(ctx: DiscoveryContext, existing: Map<string, unknown>): Promise<number> {
  const name = `${ctx.moduleName} - smoke test`;
  if (existing.has(name)) return 0;


  await ctx.store.insertTestCase({
    workflowId: undefined,
    name,
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
