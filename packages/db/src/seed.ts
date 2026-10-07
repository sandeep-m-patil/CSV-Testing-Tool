import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, closeAll } from "./index";
import { credentials, moduleCredentials, modules, projectRoles, projects, testDataSets, users } from "./schema/index";

const db = getDb();

async function seed(): Promise<void> {
  const existing = await db.select({ id: projects.id }).from(projects).limit(1);
  if (existing.length > 0) {
    console.log("Seed skipped — database already contains projects.");
    await closeAll();
    process.exit(0);
  }

  const passwordHash = await hash("demo1234", 12);
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "demo@autotest.dev"))
    .limit(1);

  const user =
    existingUser ??
    (
      await db
        .insert(users)
        .values({ name: "Demo User", email: "demo@autotest.dev", passwordHash })
        .returning()
    )[0];

  const [project] = await db
    .insert(projects)
    .values({
      name: "Pharma LIMS",
      description: "Laboratory information management system — QA/QT demo environment.",
      baseUrl: process.env.DEMO_APP_URL ?? "http://localhost:4000",
      environment: "qa",
      productionConfirmed: false,
      createdBy: user!.id,
    })
    .returning();

  const moduleRows = await db
    .insert(modules)
    .values([
      { projectId: project!.id, name: "Login", description: "Authentication flows.", startPath: "/login", includePaths: [] },
      {
        projectId: project!.id,
        name: "Material Management",
        description: "Create and manage materials.",
        startPath: "/materials",
        includePaths: ["/materials/new"],
      },
      { projectId: project!.id, name: "Material Review", description: "Review materials submitted for QC.", startPath: "/review", includePaths: [] },
      { projectId: project!.id, name: "Material Approval", description: "Approve or reject materials.", startPath: "/approvals", includePaths: [] },
      { projectId: project!.id, name: "Reports", description: "Generate and view reports.", startPath: "/reports", includePaths: [] },
    ])
    .returning();

  const mgmt = moduleRows.find((row) => row.name === "Material Management");
  const review = moduleRows.find((row) => row.name === "Material Review");
  if (!mgmt || !review) {
    throw new Error("Seed requires Material Management and Material Review modules");
  }

  // Seeded rows hold a placeholder secret; set the real one via the UI.
  const placeholder = `{ "encrypted": true, "placeholder": "set via UI" }`;
  const seeded = await db
    .insert(credentials)
    .values([
      { projectId: project!.id, name: "Material Creator", role: "Material Creator", username: "creator@test.com", secretData: placeholder, encryptionScope: project!.id },
      { projectId: project!.id, name: "QC Reviewer", role: "QC Reviewer", username: "reviewer@test.com", secretData: placeholder, encryptionScope: project!.id },
    ])
    .returning();
  await db.insert(projectRoles).values(seeded.map((row) => ({ projectId: project!.id, name: row.role })));
  await db.insert(moduleCredentials).values([
    { moduleId: mgmt!.id, credentialId: seeded[0]!.id },
    { moduleId: review!.id, credentialId: seeded[1]!.id },
  ]);

  await db.insert(testDataSets).values([
    {
      moduleId: mgmt!.id,
      name: "Default materials",
      dataType: "key_value",
      data: {
        type: "key_value",
        values: {
          material_name: "Acetone",
          material_code: "MAT-001",
          department: "QC",
          material_type: "Chemical",
        },
      },
    },
    {
      moduleId: mgmt!.id,
      name: "Material library",
      dataType: "csv",
      data: {
        type: "csv",
        columns: ["material_name", "material_code", "department", "material_type"],
        rows: [
          { material_name: "Acetone", material_code: "MAT-001", department: "QC", material_type: "Chemical" },
          { material_name: "Methanol", material_code: "MAT-002", department: "QA", material_type: "Chemical" },
          { material_name: "Paracetamol API", material_code: "MAT-003", department: "Production", material_type: "API" },
        ],
      },
    },
  ]);

  console.log("Seed complete.");
  console.log("  Login: demo@autotest.dev / demo1234");
  console.log(`  Project: ${project!.name} @ ${project!.baseUrl}`);
}

async function hash(password: string, cost: number): Promise<string> {
  const bcrypt = (await import("bcryptjs")) as unknown as {
    default?: { hash: (value: string, cost: number) => Promise<string> };
    hash?: (value: string, cost: number) => Promise<string>;
  };
  const hashFn = bcrypt.default?.hash ?? bcrypt.hash;
  if (!hashFn) throw new Error("bcryptjs hash export not available");
  return hashFn(password, cost);
}

let exitCode = 0;
try {
  await seed();
} catch (error) {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  await closeAll();
  process.exit(exitCode);
}