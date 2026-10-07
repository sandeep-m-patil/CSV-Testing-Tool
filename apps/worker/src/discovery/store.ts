import { and, eq } from "drizzle-orm";
import type { Db } from "@repo/db";
import type { DetectedAction } from "@repo/browser";
import { actionKey } from "./action-space";
import {
  discoveredActions,
  discoveredElements,
  discoveredPages,
  discoveryArtifacts,
  discoveryLogs,
  discoverySessions,
  modules,
  navigationEdges,
  stateTransitions,
  testCases,
  testCaseSteps,
  uiStates,
  workflowSteps,
  workflows,
  type NewDiscoveredActionRow,
  type NewDiscoveredElementRow,
  type NewDiscoveredPageRow,
} from "@repo/db/schema";

export interface DiscoveryScope {
  sessionId: string;
  moduleId: string;
}

export interface ElementRecord {
  elementType: string;
  role: string | null;
  name: string | null;
  text: string | null;
  placeholder: string | null;
  label: string | null;
  testId: string | null;
  cssSelector: string | null;
  xpath: string | null;
  ariaAttributes: Record<string, string> | null;
  visible: boolean;
  enabled: boolean;
}

export interface ActionRecord {
  action: string;
  target: Record<string, unknown>;
  dangerous: boolean;
  blocked: boolean;
  executed: boolean;
}

export interface ArtifactRecord {
  actionId?: string;
  pageId?: string;
  artifactType: string;
  storageKey: string;
  url: string | null;
  label: string;
}

export interface PageRecordResult {
  id: string;
  existing: boolean;
}

/**
 * Progressive write-ahead persistence for a single discovery session.
 * Every piece of evidence is durable immediately so the web UI can stream it.
 */
export class DiscoveryStore {
  constructor(
    private readonly db: Db,
    private readonly scope: DiscoveryScope,
  ) {}

  async log(level: "debug" | "info" | "warn" | "error" | "event" | "action", message: string, data?: Record<string, unknown>): Promise<void> {
    // Fire-and-forget: log writes must never stall the discovery pipeline.
    void this.db
      .insert(discoveryLogs)
      .values({
        discoverySessionId: this.scope.sessionId,
        level,
        message,
        data: data ?? {},
      })
      .catch((error: unknown) => {
        console.error("[store:log]", error instanceof Error ? error.message : String(error));
      });
  }

  async updateSession(changes: {
    status?: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
    currentUrl?: string | null;
    currentStep?: string | null;
    pagesDiscovered?: number;
    actionsDiscovered?: number;
    workflowsDiscovered?: number;
    error?: string | null;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<void> {
    await this.db.update(discoverySessions).set(changes).where(eq(discoverySessions.id, this.scope.sessionId));
  }

  /**
   * Identity of a page for deduplication: the route pattern and fingerprint
   * when known, otherwise the literal URL. Two concrete records of the same
   * route collapse onto one node; two identical URLs always collapse.
   */
  private async findExistingPage(page: NewDiscoveredPageRow): Promise<string | null> {
    const byUrl = await this.db
      .select({ id: discoveredPages.id })
      .from(discoveredPages)
      .where(and(eq(discoveredPages.discoverySessionId, this.scope.sessionId), eq(discoveredPages.url, page.url)))
      .limit(1);
    if (byUrl[0]) return byUrl[0].id;

    if (page.routePattern && page.pageFingerprint) {
      const byRoute = await this.db
        .select({ id: discoveredPages.id })
        .from(discoveredPages)
        .where(
          and(
            eq(discoveredPages.discoverySessionId, this.scope.sessionId),
            eq(discoveredPages.routePattern, page.routePattern),
            eq(discoveredPages.pageFingerprint, page.pageFingerprint),
          ),
        )
        .limit(1);
      if (byRoute[0]) return byRoute[0].id;
    }
    return null;
  }

  async insertPage(page: NewDiscoveredPageRow): Promise<PageRecordResult> {
    const existingId = await this.findExistingPage(page);
    if (existingId) return { id: existingId, existing: true };

    const [row] = await this.db.insert(discoveredPages).values(page).returning({ id: discoveredPages.id });
    if (!row) throw new Error("Failed to insert discovered page");
    return { id: row.id, existing: false };
  }

  /**
   * Backfills the identity columns once a page row exists. Discovery learns a
   * page's route pattern only after the DOM has been analysed, so these are set
   * in a second write instead of at insert time.
   */
  async updatePageIdentity(
    pageId: string,
    identity: { routePattern: string; canonicalUrl: string; pageFingerprint: string; domFingerprint: string },
  ): Promise<void> {
    await this.db
      .update(discoveredPages)
      .set({ ...identity, updatedAt: new Date() })
      .where(eq(discoveredPages.id, pageId));
  }

  /**
   * Records a distinct UI state of a page. Idempotent on
   * (pageId, stateFingerprint), so revisiting the same state reuses the row
   * instead of multiplying it on every crawl.
   */
  async upsertUiState(input: {
    pageId: string;
    routePattern: string | null;
    stateFingerprint: string;
    name: string;
    isModal: boolean;
    triggerLabel?: string | null;
    triggerSelector?: string | null;
    snapshot?: Record<string, unknown> | null;
  }): Promise<string> {
    const { sessionId, moduleId } = this.scope;
    const existing = await this.db
      .select({ id: uiStates.id })
      .from(uiStates)
      .where(and(eq(uiStates.pageId, input.pageId), eq(uiStates.stateFingerprint, input.stateFingerprint)))
      .limit(1);
    if (existing[0]) return existing[0].id;

    const [row] = await this.db
      .insert(uiStates)
      .values({
        discoverySessionId: sessionId,
        moduleId,
        pageId: input.pageId,
        routePattern: input.routePattern,
        stateFingerprint: input.stateFingerprint,
        name: input.name.slice(0, 200),
        isModal: input.isModal,
        triggerLabel: input.triggerLabel ?? null,
        triggerSelector: input.triggerSelector ?? null,
        snapshot: input.snapshot ?? null,
      })
      .returning({ id: uiStates.id });
    if (!row) throw new Error("Failed to insert ui state");
    return row.id;
  }

  async attachUiState(pageId: string, uiStateId: string): Promise<void> {
    await this.db.update(discoveredPages).set({ uiStateId }).where(eq(discoveredPages.id, pageId));
  }

  /**
   * Stores the AI's page interpretation alongside the deterministic
   * classification. The model only ever contributes intent here: it never
   * supplies a locator and never influences PASS/FAIL.
   */
  async savePageInsight(
    pageId: string,
    insight: { pageType: string; purpose: string; fields: unknown[]; actions: unknown[]; source: string },
  ): Promise<void> {
    await this.db
      .update(discoveredPages)
      .set({
        aiPageType: insight.pageType,
        aiPurpose: insight.purpose,
        aiFields: insight.fields,
        aiActions: insight.actions,
        aiSource: insight.source,
      })
      .where(eq(discoveredPages.id, pageId));
  }

  /**
   * A navigation edge. `toPageId` stays null when the target has not been
   * discovered yet, so unvisited links still appear in the graph.
   */
  async insertNavigationEdge(input: {
    fromPageId: string;
    toPageId?: string | null;
    fromRoutePattern?: string | null;
    toRoutePattern?: string | null;
    toUrl?: string | null;
    label?: string | null;
    action?: string;
    role?: string | null;
    isNewPage?: boolean;
  }): Promise<void> {
    await this.db.insert(navigationEdges).values({
      discoverySessionId: this.scope.sessionId,
      moduleId: this.scope.moduleId,
      fromPageId: input.fromPageId,
      toPageId: input.toPageId ?? null,
      fromRoutePattern: input.fromRoutePattern ?? null,
      toRoutePattern: input.toRoutePattern ?? null,
      toUrl: input.toUrl ?? null,
      label: input.label ?? null,
      action: input.action ?? "navigate",
      role: input.role ?? null,
      isNewPage: input.isNewPage ?? false,
    });
  }

  async insertElements(pageId: string, elements: ElementRecord[]): Promise<number> {
    if (elements.length === 0) return 0;
    const { sessionId, moduleId } = this.scope;
    const rows: NewDiscoveredElementRow[] = elements.map((element) => ({
      discoverySessionId: sessionId,
      moduleId,
      pageId,
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
    }));
    await this.db.insert(discoveredElements).values(rows);
    return rows.length;
  }

  async insertActions(pageId: string, actions: ActionRecord[]): Promise<Record<string, string>> {
    if (actions.length === 0) return {};
    const { sessionId, moduleId } = this.scope;
    const seen = new Set<string>();
    const keys: string[] = [];
    const rows: NewDiscoveredActionRow[] = [];
    for (const action of actions) {
      const key = actionKey(action as unknown as DetectedAction);
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
      rows.push({ ...action, discoverySessionId: sessionId, moduleId, pageId });
    }
    const inserted = await this.db.insert(discoveredActions).values(rows).returning({ id: discoveredActions.id });
    const ids: Record<string, string> = {};
    inserted.forEach((row, index) => {
      const key = keys[index];
      if (row && key) ids[key] = row.id;
    });
    return ids;
  }

  async setExecuted(actionId: string): Promise<void> {
    await this.db.update(discoveredActions).set({ executed: true }).where(eq(discoveredActions.id, actionId));
  }

  async insertTransition(input: {
    fromPageId: string;
    toPageId: string;
    actionId?: string | null;
    label: string;
  }): Promise<void> {
    await this.db.insert(stateTransitions).values({
      discoverySessionId: this.scope.sessionId,
      moduleId: this.scope.moduleId,
      fromPageId: input.fromPageId,
      toPageId: input.toPageId,
      actionId: input.actionId ?? null,
      label: input.label,
    });
  }

  async insertArtifact(artifact: ArtifactRecord): Promise<void> {
    await this.db.insert(discoveryArtifacts).values({
      discoverySessionId: this.scope.sessionId,
      moduleId: this.scope.moduleId,
      actionId: artifact.actionId ?? null,
      pageId: artifact.pageId ?? null,
      artifactType: artifact.artifactType,
      storageKey: artifact.storageKey,
      url: artifact.url,
      label: artifact.label,
    });
  }

  async insertWorkflowAndSteps(
    input: {
      name: string;
      description: string | null;
      preconditions: string[];
      steps: Array<{ order: number; action: string; target: string; value?: string; optional?: boolean }>;
      source: string;
      confidence: string;
    },
    role: string | null,
  ): Promise<string> {
    const [workflow] = await this.db
      .insert(workflows)
      .values({
        discoverySessionId: this.scope.sessionId,
        moduleId: this.scope.moduleId,
        name: input.name,
        description: input.description,
        preconditions: input.preconditions,
        steps: input.steps,
        status: "DRAFT",
        source: input.source,
        confidence: input.confidence,
      })
      .returning({ id: workflows.id });
    if (!workflow) throw new Error("Failed to insert workflow");

    if (input.steps.length > 0) {
      await this.db.insert(workflowSteps).values(
        input.steps.map((step) => ({
          workflowId: workflow.id,
          order: step.order,
          action: step.action,
          target: step.target,
          value: step.value ?? null,
          optional: step.optional ?? false,
        })),
      );
    }
    void role;
    return workflow.id;
  }

  async insertTestCase(
    input: {
      workflowId?: string;
      name: string;
      description: string | null;
      type: string;
      priority: string;
      role: string | null;
      precondition: string | null;
      testData?: string | null;
      expectedResult?: string | null;
      steps: Array<{ order: number; action: string; target: string; value?: string; stepType: string; expect?: unknown }>;
      /** "generated" (deterministic, refreshed on re-discovery) or "ai" (kept once written). */
      source?: "generated" | "ai";
    },
  ): Promise<void> {
    const code = await this.nextTestCaseCode();
    const [testCase] = await this.db
      .insert(testCases)
      .values({
        moduleId: this.scope.moduleId,
        workflowId: input.workflowId ?? null,
        discoverySessionId: this.scope.sessionId,
        code,
        name: input.name,
        description: input.description,
        type: input.type,
        priority: input.priority,
        status: "DRAFT",
        source: input.source ?? "generated",
        role: input.role,
        precondition: input.precondition,
        testData: input.testData ?? null,
        expectedResult: input.expectedResult ?? null,
        steps: input.steps,
      })
      .returning({ id: testCases.id });
    if (!testCase) throw new Error("Failed to insert test case");

    await this.db.insert(testCaseSteps).values(
      input.steps.map((step) => ({
        testCaseId: testCase.id,
        order: step.order,
        action: step.action,
        target: step.target,
        value: step.value ?? null,
        stepType: step.stepType,
      })),
    );
  }

  /**
   * Refreshes a previously generated case in place. Only cases whose `source` is
   * "generated" may be passed here, so a hand-authored case is never overwritten.
   * Generation is therefore repeatable: adding a credential and re-discovering
   * updates the stored steps instead of leaving stale values behind.
   */
  async reconcileTestCase(
    testCaseId: string,
    input: {
      description: string | null;
      precondition: string | null;
      testData: string | null;
      expectedResult: string | null;
      steps: Array<{ order: number; action: string; target: string; value?: string; stepType: string; expect?: unknown }>;
    },
  ): Promise<void> {
    await this.db
      .update(testCases)
      .set({
        description: input.description,
        precondition: input.precondition,
        testData: input.testData,
        expectedResult: input.expectedResult,
        steps: input.steps,
        updatedAt: new Date(),
      })
      .where(eq(testCases.id, testCaseId));

    // Kept in step with the JSONB column, which is what the executor executes.
    await this.db.delete(testCaseSteps).where(eq(testCaseSteps.testCaseId, testCaseId));
    await this.db.insert(testCaseSteps).values(
      input.steps.map((step) => ({
        testCaseId,
        order: step.order,
        action: step.action,
        target: step.target,
        value: step.value ?? null,
        stepType: step.stepType,
      })),
    );
  }

  private moduleSlug: string | null = null;

  /** Uppercase alphanumeric prefix derived from the module name, e.g. "Material Approval" -> "MATERIAL-APPR". */
  private async resolveModuleSlug(): Promise<string> {
    if (this.moduleSlug) return this.moduleSlug;
    const [row] = await this.db
      .select({ name: modules.name })
      .from(modules)
      .where(eq(modules.id, this.scope.moduleId))
      .limit(1);
    const slug = (row?.name ?? "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase()
      .slice(0, 12);
    this.moduleSlug = slug.length > 0 ? slug : "MOD";
    return this.moduleSlug;
  }

  /** Next stable per-module code, e.g. "LOGIN-TC-024". Never reuses a code, so results stay traceable. */
  private async nextTestCaseCode(): Promise<string> {
    const slug = await this.resolveModuleSlug();
    const rows = await this.db
      .select({ code: testCases.code })
      .from(testCases)
      .where(eq(testCases.moduleId, this.scope.moduleId));
    const suffix = new RegExp(`^${slug}-TC-(\\d+)$`);
    let max = 0;
    for (const row of rows) {
      if (!row.code) continue;
      const match = suffix.exec(row.code);
      if (!match) continue;
      const value = Number.parseInt(match[1]!, 10);
      if (Number.isFinite(value) && value > max) max = value;
    }
    return `${slug}-TC-${String(max + 1).padStart(3, "0")}`;
  }

  async countSessionsForModule(): Promise<number> {
    const result = await this.db.select({ id: discoverySessions.id }).from(discoverySessions).where(eq(discoverySessions.moduleId, this.scope.moduleId));
    return result.length;
  }
}