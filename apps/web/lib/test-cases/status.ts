import { and, eq } from "drizzle-orm";
import { testDataSets } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { db } from "@/lib/db";

export { statusAfterEdit } from "./status-rules";

/** A case may only be driven by a dataset of its own module. */
export async function assertDatasetInModule(datasetId: string | null | undefined, moduleId: string): Promise<void> {
  if (!datasetId) return;
  const [row] = await db
    .select({ id: testDataSets.id })
    .from(testDataSets)
    .where(and(eq(testDataSets.id, datasetId), eq(testDataSets.moduleId, moduleId)))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Dataset not found in this module", 404);
}
