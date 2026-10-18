import { eq } from "drizzle-orm";
import { testCases } from "@repo/db/schema";
import type { ImportRow, ImportTestCasesInput } from "@repo/schemas";
import { db } from "@/lib/db";

export interface ImportOutcome {
  created: number;
  updated: number;
  skipped: number;
}

/** Rows per INSERT; one statement per chunk instead of one per row. */
const INSERT_CHUNK = 500;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Writes validated rows in one transaction, so a failure part-way leaves the
 * module exactly as it was. Test IDs match existing cases case-insensitively;
 * an updated case goes back to DRAFT (or NEEDS_REVIEW) because its content
 * changed and any earlier approval no longer describes it.
 */
export async function importTestCases(moduleId: string, rows: readonly ImportRow[], mode: ImportTestCasesInput["mode"]): Promise<ImportOutcome> {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: testCases.id, code: testCases.code }).from(testCases).where(eq(testCases.moduleId, moduleId));
    const idByCode = new Map(existing.filter((row) => row.code).map((row) => [row.code!.toLowerCase(), row.id]));
    const valid = rows.filter((row) => row.input?.code);
    const fresh = valid.filter((row) => !idByCode.has(row.input!.code!.toLowerCase()));
    const known = valid.filter((row) => idByCode.has(row.input!.code!.toLowerCase()));

    for (let start = 0; start < fresh.length; start += INSERT_CHUNK) {
      const chunk = fresh.slice(start, start + INSERT_CHUNK);
      await tx.insert(testCases).values(chunk.map((row) => ({ ...fieldsOf(row), moduleId, code: row.input!.code!, source: "imported" })));
    }
    if (mode === "upsert") {
      for (const row of known) await updateCase(tx, idByCode.get(row.input!.code!.toLowerCase())!, row);
    }
    return { created: fresh.length, updated: mode === "upsert" ? known.length : 0, skipped: mode === "upsert" ? 0 : known.length };
  });
}

function fieldsOf(row: ImportRow) {
  const input = row.input!;
  return {
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    priority: input.priority,
    severity: input.severity ?? null,
    tags: input.tags ?? [],
    role: input.role ?? null,
    precondition: input.precondition ?? null,
    testData: input.testData ?? null,
    expectedResult: input.expectedResult ?? null,
    steps: input.steps,
    status: row.status,
  };
}

async function updateCase(tx: Tx, id: string, row: ImportRow): Promise<void> {
  // Now human-authored: re-discovery must not refresh it back to generated content.
  await tx.update(testCases).set({ ...fieldsOf(row), source: "imported", updatedAt: new Date() }).where(eq(testCases.id, id));
}

