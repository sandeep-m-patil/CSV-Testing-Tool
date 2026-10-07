// Temporary end-to-end harness (deleted after verification): runs the real
// discovery + test-run processors without Redis against the local demo app.
import "dotenv/config";
import { and, asc, eq } from "drizzle-orm";
import { CredentialCrypto } from "@repo/core";
import { closeAll, getDb } from "@repo/db";
import { credentials, discoverySessions, moduleCredentials, modules, projectRoles, projects, testCases, testRunResults, testRuns, users } from "@repo/db/schema";
import { runDiscovery } from "./discovery/runner";
import { processTestRunJob } from "./test-execution/processor";

const db = getDb();
const crypto = new CredentialCrypto();
const DEMO = "http://localhost:4000";

async function setup() {
  const [user] = await db.select().from(users).where(eq(users.email, "e2e-verify@autotest.test"));
  if (!user) throw new Error("test user missing");
  let [project] = await db.select().from(projects).where(and(eq(projects.createdBy, user.id), eq(projects.name, "E2E Demo App")));
  project ??= (await db.insert(projects).values({ name: "E2E Demo App", description: "Phase 2 end-to-end verification (Claude)", baseUrl: DEMO, environment: "development", createdBy: user.id }).returning())[0]!;
  let [module] = await db.select().from(modules).where(and(eq(modules.projectId, project.id), eq(modules.name, "Materials")));
  module ??= (await db.insert(modules).values({ projectId: project.id, name: "Materials", startPath: "/login", includePaths: ["/login", "/dashboard", "/materials"] }).returning())[0]!;
  let [credential] = await db.select().from(credentials).where(and(eq(credentials.projectId, project.id), eq(credentials.name, "Creator")));
  credential ??= (await db.insert(credentials).values({ projectId: project.id, name: "Creator", role: "MATERIAL_CREATOR", username: "creator@test.com", secretData: crypto.encryptCredentials(project.id, "creator@test.com", "demo1234"), encryptionScope: project.id }).returning())[0]!;
  await db.insert(projectRoles).values({ projectId: project.id, name: "MATERIAL_CREATOR" }).onConflictDoNothing();
  await db.insert(moduleCredentials).values({ moduleId: module.id, credentialId: credential.id }).onConflictDoNothing();
  return { project, module };
}

async function discover(projectId: string, moduleId: string) {
  const [session] = await db.insert(discoverySessions).values({ moduleId, status: "QUEUED" }).returning();
  await runDiscovery({ discoverySessionId: session!.id, moduleId, projectId, db });
  const [done] = await db.select().from(discoverySessions).where(eq(discoverySessions.id, session!.id));
  const cases = await db.select({ name: testCases.name, source: testCases.source, steps: testCases.steps }).from(testCases).where(eq(testCases.moduleId, moduleId));
  console.log(`DISCOVERY ${done!.status}: pages=${done!.pagesDiscovered} actions=${done!.actionsDiscovered} workflows=${done!.workflowsDiscovered} cases=${cases.length}`);
}

async function run(projectId: string, moduleId: string, extra: Partial<typeof testRuns.$inferInsert>) {
  const [row] = await db.insert(testRuns).values({ moduleId, projectId, status: "QUEUED", baseUrl: DEMO, ...extra }).returning();
  const started = Date.now();
  await processTestRunJob({ id: "e2e", data: { testRunId: row!.id, moduleId, projectId } } as never);
  const [done] = await db.select().from(testRuns).where(eq(testRuns.id, row!.id));
  const results = await db.select().from(testRunResults).where(eq(testRunResults.testRunId, row!.id)).orderBy(asc(testRunResults.order));
  console.log(`RUN #${done!.runNumber} ${done!.status} in ${((Date.now() - started) / 1000).toFixed(1)}s workers=${done!.workers} retries=${done!.retries} scope=${done!.scope} total=${done!.totalCases} pass=${done!.passedCases} fail=${done!.failedCases} blocked=${done!.blockedCases} skip=${done!.skippedCases} note=${done!.error ?? "-"}`);
  for (const result of results) {
    const steps = result.stepResults as Array<{ status: string; screenshotKey: string | null; resolvedBy?: string }>;
    console.log(`  ${result.status.padEnd(7)} attempts=${result.attemptCount} steps=${steps.length} shots=${steps.filter((step) => step.screenshotKey).length} role=${result.role ?? "-"} cred=${result.credentialName ?? "-"} ${result.error ? `err=${result.error.slice(0, 90)}` : ""}`);
  }
  return done!;
}

const { project, module } = await setup();
await db.update(testRuns).set({ status: "FAILED", error: "interrupted: worker process crashed (ECONNRESET) during verification", completedAt: new Date() }).where(and(eq(testRuns.moduleId, module.id), eq(testRuns.status, "RUNNING")));
console.log(`project=${project.id} module=${module.id}`);
if (process.argv.includes("--discover")) await discover(project.id, module.id);
const first = await run(project.id, module.id, { workers: 3, retries: 1 });
if (first.failedCases + first.blockedCases > 0) {
  await run(project.id, module.id, { workers: 2, retries: 0, scope: "failed", parentRunId: first.id });
}
await closeAll();
