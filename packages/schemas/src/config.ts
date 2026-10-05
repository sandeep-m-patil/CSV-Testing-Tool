import { z } from "zod";

export const CredentialSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  role: z.string().min(1).max(120),
  username: z.string().min(1).max(255),
  hasSecret: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Credential = z.infer<typeof CredentialSchema>;

export const CredentialInputSchema = z.object({
  role: z.string().trim().min(1, "Role is required").max(120),
  username: z.string().trim().min(1, "Username / email is required").max(255),
  password: z.string().min(1, "Password is required").max(512),
});
export type CredentialInput = z.infer<typeof CredentialInputSchema>;

export const UpdateCredentialInputSchema = CredentialSchema.omit({ id: true, moduleId: true, hasSecret: true, createdAt: true, updatedAt: true })
  .extend({ password: z.string().min(1).max(512).optional() });
export type UpdateCredentialInput = z.infer<typeof UpdateCredentialInputSchema>;

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