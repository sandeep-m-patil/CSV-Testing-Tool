"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { Project } from "@repo/schemas";
import type { Module } from "@repo/schemas";
import type { AttemptView, StepView } from "@/lib/test-run-view";

export type ProjectRow = Project;

/** Run states that mean the worker is still working, so polling should continue. */
const ACTIVE_RUN_STATUSES: string[] = ["QUEUED", "RUNNING"];

export interface ModuleRow extends Module {
  projectName?: string;
  environment?: string;
  baseUrl?: string;
}

export interface ModuleDetail {
  module: Module;
  project: Project | null;
  projectId: string;
  credentials: Array<{ id: string; role: string; username: string; hasSecret: boolean }>;
  testDataSets: Array<{ id: string; name: string; dataType: string; data: unknown }>;
  lastDiscoverySession: {
    id: string;
    status: string;
    pagesDiscovered: number;
    actionsDiscovered: number;
    workflowsDiscovered: number;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  } | null;
}

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: ProjectRow[] }>("/api/projects"),
    select: (data) => data.projects,
  });
}

export function useProjectDetail(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () =>
      apiFetch<{ project: ProjectRow | null; modules: ModuleRow[] }>(
        `/api/projects/${projectId}/detail`,
      ),
    enabled: Boolean(projectId),
  });
}

export function useModulesHub() {
  return useQuery({
    queryKey: queryKeys.modulesHub,
    queryFn: () => apiFetch<{ modules: ModuleRow[] }>("/api/modules"),
    select: (data) => data.modules,
  });
}

export function useModuleDetail(moduleId: string) {
  return useQuery({
    queryKey: queryKeys.moduleWithRelations(moduleId),
    queryFn: () => apiFetch<ModuleDetail>(`/api/modules/${moduleId}`),
    enabled: Boolean(moduleId),
  });
}

export interface DiscoveryProgress {
  session: {
    id: string;
    status: string;
    currentUrl: string | null;
    currentStep: string | null;
    pagesDiscovered: number;
    actionsDiscovered: number;
    workflowsDiscovered: number;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  } | null;
  module: Module | null;
  project: { name: string; baseUrl: string; environment: string } | null;
  logs: Array<{ id: string; level: string; message: string; createdAt: string }>;
  artifacts: Array<{
    id: string;
    artifactType: string;
    storageKey: string;
    url: string | null;
    label: string;
    pageId: string | null;
    actionId: string | null;
    createdAt: string;
  }>;
  pages: Array<{
    id: string;
    name: string;
    url: string;
    title: string;
    pageType: string;
    order: number;
  }>;
  actions: Array<{
    id: string;
    pageId: string;
    action: string;
    target: {
      elementType?: string;
      role?: string;
      name?: string;
      text?: string;
      label?: string;
      placeholder?: string;
      testId?: string;
      url?: string;
    };
    dangerous: boolean;
    blocked: boolean;
    executed: boolean;
    createdAt: string;
  }>;
  history: Array<{ id: string; status: string; createdAt: string }>;
}

export function useDiscovery(moduleId: string, options: { enabled?: boolean; refetchMs?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.discovery(moduleId),
    queryFn: () => apiFetch<DiscoveryProgress>(`/api/modules/${moduleId}/discovery`),
    enabled: options.enabled ?? Boolean(moduleId),
    refetchInterval: (query) => {
      if (query.state.error) {
        return options.refetchMs ?? 3000;
      }
      const status = query.state.data?.session?.status;
      if (!status) {
        return false;
      }
      if (status === "RUNNING" || status === "QUEUED") {
        return options.refetchMs ?? 2000;
      }
      return false;
    },
    retry: (failureCount, error) => {
      if (error && (error as { status?: number }).status === 404) return false;
      return failureCount < 2;
    },
  });
}

export interface WorkflowRecord {
  id: string;
  name: string;
  description: string | null;
  preconditions: string[];
  steps: Array<{ order: number; action: string; target: string; value?: string; optional?: boolean }>;
  status: string;
  source: string;
  confidence: string;
  discoverySessionId?: string | null;
}

export function useWorkflows(moduleId: string) {
  return useQuery({
    queryKey: queryKeys.workflows(moduleId),
    queryFn: () => apiFetch<{ workflows: WorkflowRecord[] }>(`/api/modules/${moduleId}/workflows`),
    enabled: Boolean(moduleId),
    select: (data) => data.workflows,
  });
}

export interface TestCaseRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  source: string;
  role: string | null;
  precondition: string | null;
  steps: Array<{ order: number; action: string; target: string; value?: string; type?: string }>;
}

export function useTestCases(moduleId: string) {
  return useQuery({
    queryKey: queryKeys.testCases(moduleId),
    queryFn: () => apiFetch<{ testCases: TestCaseRecord[] }>(`/api/modules/${moduleId}/test-cases`),
    enabled: Boolean(moduleId),
    select: (data) => data.testCases,
  });
}

export interface TestRunSummary {
  id: string;
  moduleId: string;
  status: string;
  /** RUN-<year>-<number>. */
  runLabel: string;
  runNumber: number;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  skippedCases: number;
  blockedCases: number;
  browser: string;
  workers: number;
  retries: number;
  failFast: boolean;
  scope: string;
  environmentId: string | null;
  baseUrl: string | null;
  parentRunId: string | null;
  parentRunLabel?: string | null;
  durationMs: number | null;
  error: string | null;
  triggeredBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function useTestRuns(moduleId: string) {
  return useQuery({
    queryKey: queryKeys.testRuns(moduleId),
    queryFn: () => apiFetch<{ runs: TestRunSummary[] }>(`/api/modules/${moduleId}/test-runs`),
    enabled: Boolean(moduleId),
    select: (data) => data.runs,
    // The tab list has to refresh on its own, otherwise a run queued elsewhere
    // never appears until the page is reloaded by hand. `query.state.data` is
    // the raw queryFn payload; `select` runs at the observer, not in the cache.
    refetchInterval: (query) => {
      const payload = query.state.data as { runs?: TestRunSummary[] } | undefined;
      const isActive = payload?.runs?.some((run) => ACTIVE_RUN_STATUSES.includes(run.status));
      return isActive ? 2000 : false;
    },
  });
}

export interface TestRunResultRecord {
  id: string;
  testCaseId: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "SKIP";
  durationMs: number | null;
  testData: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  error: string | null;
  screenshotKey: string | null;
  screenshotUrl: string | null;
  order: number;
  /** Set when this result came from one row of a CSV dataset bound to the case. */
  datasetId: string | null;
  datasetRow: number | null;
  code: string;
  name: string;
  type: string;
  priority: string;
  role: string | null;
  /** Display name of the credential the case ran as; never its secret. */
  credentialName: string | null;
  browser: string | null;
  attemptCount: number;
  attempts: AttemptView[];
  stepResults: StepView[];
}

export type { AttemptView, StepView } from "@/lib/test-run-view";

export interface TestRunDetail {
  testRun: TestRunSummary;
  module: { id: string; name: string; baseUrl: string | null } | null;
  results: TestRunResultRecord[];
}

export function useTestRun(testRunId: string | null, options: { refetchMs?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.testRun(testRunId ?? "none"),
    queryFn: () => apiFetch<TestRunDetail>(`/api/test-runs/${testRunId}`),
    enabled: Boolean(testRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.testRun?.status;
      return status && ACTIVE_RUN_STATUSES.includes(status) ? (options.refetchMs ?? 2000) : false;
    },
  });
}

export interface ModuleReport {
  report: {
    project: { name: string; baseUrl: string; environment: string };
    module: { id: string; name: string; discoveryStatus: string };
    discovery: { sessionId: string; status: string; startedAt: string | null; completedAt: string | null; error: string | null } | null;
      counts: {
        pages: number;
        forms: number;
        elements: number;
        actions: number;
        transitions: number;
        workflows: number;
        testCases: number;
        artifacts: number;
        roles: number;
      };
      roles: string[];
      testRuns: ModuleReportRun[];
      testSummary: {
        runs: number;
        executed: number;
        passed: number;
        failed: number;
        blocked: number;
        skipped: number;
        screenshots: number;
      };
      coverage: {
        testCasesCreated: number;
        testCasesExecuted: number;
        untestedTestCases: number;
        pagesDiscovered: number;
        workflowsDiscovered: number;
      };
    };
  }

  export interface ModuleReportRun {
    id: string;
    runLabel: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    totalCases: number | null;
    passedCases: number | null;
    failedCases: number | null;
    skippedCases: number | null;
    error: string | null;
    executed: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    screenshots: number;
    storedTotal: number | null;
    storedPassed: number | null;
    storedFailed: number | null;
    storedSkipped: number | null;
    countersConsistent: boolean;
  }


export function useModuleReport(moduleId: string) {
  return useQuery({
    queryKey: queryKeys.report(moduleId),
    queryFn: () => apiFetch<ModuleReport>(`/api/modules/${moduleId}/report`),
    enabled: Boolean(moduleId),
    select: (data) => data.report,
  });
}