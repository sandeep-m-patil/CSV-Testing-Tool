import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@repo/db";
import { environments, modules, projects, testCases, testDataSets, testRunResults, testRuns } from "@repo/db/schema";
import { RUN_BROWSERS, type RunBrowser, type TestDataSet } from "@repo/schemas";
import type { ExecutableStep } from "./types";
import type { ExecutableCase } from "./executor";
import { applyValues, expandCases, indexDatasets, type CaseDraft, type DataDrivenCase } from "./data-driven";
import { credentialFor, isRunnable } from "./case-selection";
import { rebaseSteps, rebaseUrl } from "./environment-target";
import { forEnvironment, loadModuleCredentials, type ResolvedCredential } from "../credentials";

/**
 * Everything a run needs, resolved before the browser starts:
 *
 *   structured case + CSV row + credential (by role, by environment) + environment
 *
 * The same authored case is reused for every row and every deployment; nothing
 * here generates a per-row script.
 */

export interface RunOptions {
  browser: RunBrowser;
  workers: number;
  retries: number;
  failFast: boolean;
}

export interface PlannedCase {
  expanded: DataDrivenCase;
  executable: ExecutableCase;
  credential?: ResolvedCredential;
}

export interface RunPlan {
  options: RunOptions;
  /** The module's entry page in the run's environment; where sessions are bootstrapped. */
  startUrl: string;
  items: PlannedCase[];
  credentials: ResolvedCredential[];
  warnings: string[];
}

const FAILED_STATUSES = ["FAIL", "BLOCKED"];

export function resultKey(caseId: string, datasetRow: number | null | undefined): string {
  return `${caseId}:${datasetRow ?? "-"}`;
}

export async function loadRunPlan(db: Db, testRunId: string, moduleId: string): Promise<RunPlan> {
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, testRunId)).limit(1);
  if (!run) throw new Error(`Test run ${testRunId} not found`);

  const drafts = await loadCases(db, moduleId);
  const { cases, warnings } = expandCases(drafts, await loadDatasets(db, drafts));
  const scoped = run.scope === "failed" && run.parentRunId ? await onlyPreviouslyFailed(db, run.parentRunId, cases) : cases;
  const credentials = forEnvironment(await loadModuleCredentials(db, moduleId), run.environmentId);
  const bases = await loadBases(db, moduleId, run.environmentId);

  return {
    options: toOptions(run),
    startUrl: rebaseUrl(bases.startUrl, bases.from, bases.to ?? bases.from),
    items: scoped.map((expanded) => planCase(expanded, credentials, bases)),
    credentials,
    warnings,
  };
}

export function planCase(expanded: DataDrivenCase, credentials: ResolvedCredential[], bases: { from: string; to: string | null }): PlannedCase {
  const credential = credentialFor(credentials, expanded.role);
  const steps = rebaseSteps(applyValues(expanded.steps, credential?.variables ?? {}), bases.from, bases.to);
  return {
    expanded,
    credential,
    executable: {
      id: expanded.id,
      name: expanded.name,
      steps,
      testData: expanded.testData,
      expectedResult: expanded.expectedResult,
      datasetRow: expanded.datasetRow,
    },
  };
}

/** Rerun Failed: only the case/row pairs that failed or were blocked in the parent run. */
export function filterToKeys(cases: DataDrivenCase[], keys: Set<string>): DataDrivenCase[] {
  return cases.filter((item) => keys.has(resultKey(item.id, item.datasetRow)));
}

async function onlyPreviouslyFailed(db: Db, parentRunId: string, cases: DataDrivenCase[]): Promise<DataDrivenCase[]> {
  const rows = await db
    .select({ testCaseId: testRunResults.testCaseId, datasetRow: testRunResults.datasetRow })
    .from(testRunResults)
    .where(and(eq(testRunResults.testRunId, parentRunId), inArray(testRunResults.status, FAILED_STATUSES)));
  return filterToKeys(cases, new Set(rows.map((row) => resultKey(row.testCaseId, row.datasetRow))));
}

function toOptions(run: typeof testRuns.$inferSelect): RunOptions {
  const browser = (RUN_BROWSERS as readonly string[]).includes(run.browser) ? (run.browser as RunBrowser) : "chromium";
  return { browser, workers: Math.max(1, run.workers), retries: Math.max(0, run.retries), failFast: run.failFast };
}

interface Bases {
  from: string;
  to: string | null;
  startUrl: string;
}

async function loadBases(db: Db, moduleId: string, environmentId: string | null): Promise<Bases> {
  const [row] = await db
    .select({ baseUrl: projects.baseUrl, startPath: modules.startPath })
    .from(modules)
    .innerJoin(projects, eq(projects.id, modules.projectId))
    .where(eq(modules.id, moduleId))
    .limit(1);
  const from = row?.baseUrl ?? "";
  const startUrl = row?.startPath ? new URL(row.startPath, from).toString() : from;
  if (!environmentId) return { from, to: null, startUrl };
  const [environment] = await db.select({ baseUrl: environments.baseUrl }).from(environments).where(eq(environments.id, environmentId)).limit(1);
  return { from, to: environment?.baseUrl ?? null, startUrl };
}

async function loadCases(db: Db, moduleId: string): Promise<CaseDraft[]> {
  const [module] = await db.select({ requireApproval: modules.requireApproval }).from(modules).where(eq(modules.id, moduleId)).limit(1);
  const rows = await db
    .select({
      id: testCases.id,
      name: testCases.name,
      steps: testCases.steps,
      testData: testCases.testData,
      expectedResult: testCases.expectedResult,
      datasetId: testCases.datasetId,
      status: testCases.status,
      role: testCases.role,
    })
    .from(testCases)
    .where(eq(testCases.moduleId, moduleId))
    .orderBy(asc(testCases.createdAt));
  return rows
    .filter((row) => isRunnable(row.status, module?.requireApproval ?? false))
    .map((row) => ({ ...row, steps: (row.steps ?? []) as ExecutableStep[] }));
}

/** Loads only the datasets the runnable cases reference. */
async function loadDatasets(db: Db, drafts: CaseDraft[]): Promise<Map<string, TestDataSet["data"]>> {
  const ids = [...new Set(drafts.map((draft) => draft.datasetId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: testDataSets.id, data: testDataSets.data }).from(testDataSets).where(inArray(testDataSets.id, ids));
  return indexDatasets(rows.map((row) => ({ id: row.id, data: row.data as TestDataSet["data"] })));
}
