import { z } from "zod";

export const ModuleStatusSchema = z.enum(["NOT_DISCOVERED", "DISCOVERING", "DISCOVERED", "FAILED"]);
export type ModuleStatus = z.infer<typeof ModuleStatusSchema>;

/** Lifecycle, separate from discovery status: a DISABLED module is skipped by Discover All and Run All. */
export const ModuleLifecycleSchema = z.enum(["ACTIVE", "DISABLED"]);
export type ModuleLifecycle = z.infer<typeof ModuleLifecycleSchema>;

/** Paths must be origin-relative ("/materials") or bare segments ("materials"). */
export const ModulePathSchema = z
  .string()
  .trim()
  .min(1, "Path cannot be empty")
  .max(200)
  .regex(/^[^\s?#]*$/, "Path must not contain spaces, ? or #")
  .transform((value) => (value.startsWith("/") ? value : `/${value}`))
  .transform((value) => (value.length > 1 ? value.replace(/\/+$/, "") : value));

export const ModulePathListSchema = z.array(ModulePathSchema).max(25).default([]);

export const ModuleSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).nullable(),
  startPath: z.string().nullable(),
  includePaths: z.array(z.string()),
  status: ModuleLifecycleSchema,
  discoveryStatus: ModuleStatusSchema,
  requireApproval: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Module = z.infer<typeof ModuleSchema>;

export const CreateModuleInputSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Module name is required").max(160),
  description: z.string().trim().max(1000).optional().default(""),
  startPath: ModulePathSchema.optional(),
  includePaths: ModulePathListSchema.optional(),
});
export type CreateModuleInput = z.infer<typeof CreateModuleInputSchema>;

export const UpdateModuleInputSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  startPath: ModulePathSchema.nullable().optional(),
  includePaths: ModulePathListSchema.optional(),
  status: ModuleLifecycleSchema.optional(),
  requireApproval: z.boolean().optional(),
});
export type UpdateModuleInput = z.infer<typeof UpdateModuleInputSchema>;

export const ModuleWithRelationsSchema = ModuleSchema.extend({
  project: z.object({ name: z.string(), baseUrl: z.string(), environment: z.string() }),
  credentials: z.array(z.object({ id: z.string().uuid(), name: z.string(), role: z.string(), username: z.string().nullable() })),
  testDataSets: z.array(z.object({ id: z.string().uuid(), name: z.string(), dataType: z.string() })),
});
export type ModuleWithRelations = z.infer<typeof ModuleWithRelationsSchema>;