import { z } from "zod";

export const ApplicationEnvironmentSchema = z.enum(["development", "qa", "staging", "production", "custom"]);
export type ApplicationEnvironment = z.infer<typeof ApplicationEnvironmentSchema>;

export const ApplicationStatusSchema = z.enum(["ACTIVE", "NOT_DISCOVERED", "DISCOVERING", "ERROR"]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const ApplicationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120),
  baseUrl: z.string().url(),
  description: z.string().max(1000).nullable(),
  environment: ApplicationEnvironmentSchema,
  productionConfirmed: z.boolean().default(false),
  status: ApplicationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Application = z.infer<typeof ApplicationSchema>;

const createApplicationInputFields = {
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Application name is required").max(120),
  baseUrl: z.string().trim().url("Must be a valid URL (e.g. https://lims.example.com)"),
  description: z.string().trim().max(1000).optional().default(""),
  environment: ApplicationEnvironmentSchema,
  productionConfirmed: z.boolean().default(false),
} as const;

export const CreateApplicationInputSchema = z
  .object(createApplicationInputFields)
  .refine((value) => value.environment !== "production" || value.productionConfirmed, {
    message: "Production environment requires explicit confirmation",
    path: ["productionConfirmed"],
  });
export type CreateApplicationInput = z.infer<typeof CreateApplicationInputSchema>;

export const UpdateApplicationInputSchema = z.object(createApplicationInputFields).omit({ projectId: true }).partial({ productionConfirmed: true });
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationInputSchema>;