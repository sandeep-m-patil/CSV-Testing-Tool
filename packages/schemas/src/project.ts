import { z } from "zod";
import { PaginationQuerySchema } from "./common";

export const ProjectEnvironmentSchema = z.enum(["development", "qa", "staging", "production", "custom"]);
export type ProjectEnvironment = z.infer<typeof ProjectEnvironmentSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable(),
  baseUrl: z.string().url(),
  environment: ProjectEnvironmentSchema,
  productionConfirmed: z.boolean().default(false),
  authorizationConfirmedAt: z.string().datetime().nullable().optional(),
  authorizedHosts: z.array(z.string()).optional(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

const projectInputFields = {
  name: z.string().trim().min(1, "Project name is required").max(120),
  baseUrl: z
    .string()
    .trim()
    .url("Must be a valid URL (e.g. https://shop.example.com)"),
  description: z.string().trim().max(1000).optional().default(""),
  environment: ProjectEnvironmentSchema.default("development"),
  productionConfirmed: z.boolean().default(false),
} as const;

export const CreateProjectInputSchema = z
  .object(projectInputFields)
  .extend({
    /** The user's attestation that they are permitted to test the site at `baseUrl`. */
    authorizationConfirmed: z.literal(true, {
      errorMap: () => ({ message: "Confirm that you are authorized to test this website" }),
    }),
  })
  .refine((value) => value.environment !== "production" || value.productionConfirmed, {
    message: "Production environment requires explicit confirmation",
    path: ["productionConfirmed"],
  });
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateProjectInputSchema = z
  .object(projectInputFields)
  .partial({ description: true, productionConfirmed: true });
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export const ProjectListQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
});
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

/** Body of POST /projects/:id/authorization; `url` picks one of the project's environments. */
export const ConfirmTestAuthorizationInputSchema = z.object({
  url: z.string().trim().url().optional(),
});
export type ConfirmTestAuthorizationInput = z.infer<typeof ConfirmTestAuthorizationInputSchema>;
