import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, closeAll } from "./index";
import { applications, credentials, modules, projects, testDataSets, users } from "./schema/index";

const db = getDb();

async function seed(): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log("Seed skipped — database already contains users.");
    await closeAll();
    process.exit(0);
  }

  const passwordHash = await hash("demo1234", 12);
  const [user] = await db
    .insert(users)
    .values({ name: "Demo User", email: "demo@autotest.dev", passwordHash })
    .returning();

  const [project] = await db
    .insert(projects)
    .values({
      name: "Pharma LIMS",
      description: "Laboratory information management system — QA/QT demo environment.",
      createdBy: user!.id,
    })
    .returning();

  const [app] = await db
    .insert(applications)
    .values({
      projectId: project!.id,
      name: "Pharma LIMS",
      baseUrl: process.env.DEMO_APP_URL ?? "http://localhost:4000",
      description: "QA environment for autonomous testing demo.",
      environment: "qa",
      status: "ACTIVE",
    })
    .returning();

  const moduleRows = await db
    .insert(modules)
    .values([
      { applicationId: app!.id, name: "Login", description: "Authentication flows." },
      { applicationId: app!.id, name: "Material Management", description: "Create and manage materials." },
      { applicationId: app!.id, name: "Material Review", description: "Review materials submitted for QC." },
      { applicationId: app!.id, name: "Material Approval", description: "Approve or reject materials." },
      { applicationId: app!.id, name: "Reports", description: "Generate and view reports." },
    ])
    .returning();

  const [mgmt] = moduleRows;
  const [review] = moduleRows;

  await db.insert(credentials).values([
    {
      moduleId: mgmt!.id,
      role: "Material Creator",
      username: "creator@test.com",
      secretData: `{ "encrypted": true, "placeholder": "set via UI" }`,
    },
    {
      moduleId: review!.id,
      role: "QC Reviewer",
      username: "reviewer@test.com",
      secretData: `{ "encrypted": true, "placeholder": "set via UI" }`,
    },
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
  console.log(`  Application: ${app!.name} @ ${app!.baseUrl}`);
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