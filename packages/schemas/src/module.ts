import { z } from "zod";

export const ModuleStatusSchema = z.enum(["NOT_DISCOVERED", "DISCOVERING", "DISCOVERED", "FAILED"]);
export type ModuleStatus = z.infer<typeof ModuleStatusSchema>;

export const ModuleSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).nullable(),
  status: ModuleStatusSchema,
  discoveryStatus: ModuleStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Module = z.infer<typeof ModuleSchema>;

export const CreateModuleInputSchema = z.object({
  applicationId: z.string().uuid(),
  name: z.string().trim().min(1, "Module name is required").max(160),
  description: z.string().trim().max(1000).optional().default(""),
});
export type CreateModuleInput = z.infer<typeof CreateModuleInputSchema>;

export const UpdateModuleInputSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
});
export type UpdateModuleInput = z.infer<typeof UpdateModuleInputSchema>;

export const ModuleWithRelationsSchema = ModuleSchema.extend({
  application: z.object({ name: z.string(), baseUrl: z.string(), environment: z.string(), projectId: z.string().uuid() }),
  credentials: z.array(z.object({ id: z.string().uuid(), role: z.string(), username: z.string() })),
  testDataSets: z.array(z.object({ id: z.string().uuid(), name: z.string(), dataType: z.string() })),
});
export type ModuleWithRelations = z.infer<typeof ModuleWithRelationsSchema>;