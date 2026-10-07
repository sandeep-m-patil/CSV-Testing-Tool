import { z } from "zod";

/** Usable as a `{{token}}` inside test steps, so the same rules as CSV column tokens. */
const VariableNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/, "Use letters, digits and underscores");
const MAX_VARIABLES = 25;
const RESERVED_TOKENS = new Set(["username", "password"]);

export const CredentialVariablesSchema = z
  .record(VariableNameSchema, z.string().max(500))
  .refine((value) => Object.keys(value).length <= MAX_VARIABLES, `At most ${MAX_VARIABLES} variables`)
  .refine((value) => Object.keys(value).every((key) => !RESERVED_TOKENS.has(key)), "username and password are reserved");

/** Shape returned to the client: the secret is never exposed, only whether one is set. */
export const CredentialSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(120),
  username: z.string().max(255).nullable(),
  environmentId: z.string().uuid().nullable(),
  variables: z.record(z.string(), z.string()),
  hasSecret: z.boolean(),
  /** Modules that reference this credential. */
  moduleIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Credential = z.infer<typeof CredentialSchema>;

export const CredentialInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.string().trim().min(1, "Role is required").max(120),
  username: z.string().trim().min(1, "Username / email is required").max(255),
  password: z.string().min(1, "Password is required").max(512),
  environmentId: z.string().uuid().nullable().optional(),
  variables: CredentialVariablesSchema.optional(),
});
export type CredentialInput = z.infer<typeof CredentialInputSchema>;

export const UpdateCredentialInputSchema = CredentialInputSchema.partial();
export type UpdateCredentialInput = z.infer<typeof UpdateCredentialInputSchema>;

export const ProjectRoleSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  /** Credentials currently acting as this role. */
  credentialCount: z.number().int(),
});
export type ProjectRole = z.infer<typeof ProjectRoleSchema>;

export const ProjectRoleInputSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(120),
  description: z.string().trim().max(500).nullable().optional(),
});
export type ProjectRoleInput = z.infer<typeof ProjectRoleInputSchema>;

/** Replaces a module's credential references; every id must belong to the module's project. */
export const ModuleCredentialAssignmentSchema = z.object({
  credentialIds: z.array(z.string().uuid()).max(50),
});
export type ModuleCredentialAssignment = z.infer<typeof ModuleCredentialAssignmentSchema>;

export const ENVIRONMENT_KINDS = ["development", "qa", "staging", "production"] as const;

export const EnvironmentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  kind: z.enum(ENVIRONMENT_KINDS),
  baseUrl: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;

export const EnvironmentInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  kind: z.enum(ENVIRONMENT_KINDS).default("development"),
  baseUrl: z.string().trim().url("Enter a full URL, e.g. https://qa.example.com"),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type EnvironmentInput = z.infer<typeof EnvironmentInputSchema>;

export const UpdateEnvironmentInputSchema = EnvironmentInputSchema.partial();

export const TestDataSetTypeSchema = z.enum(["key_value", "csv"]);
export type TestDataSetType = z.infer<typeof TestDataSetTypeSchema>;

export const KeyValueRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
export type KeyValueRow = z.infer<typeof KeyValueRowSchema>;

export const TestDataSetSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  name: z.string().min(1).max(120),
  dataType: TestDataSetTypeSchema,
  data: z.union([
    z.object({ type: z.literal("key_value"), values: KeyValueRowSchema }),
    z.object({ type: z.literal("csv"), columns: z.array(z.string()), rows: z.array(KeyValueRowSchema) }),
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TestDataSet = z.infer<typeof TestDataSetSchema>;

export const TestDataRowSchema = KeyValueRowSchema;
export type TestDataRow = z.infer<typeof TestDataRowSchema>;