import { z } from "zod";

export const IdSchema = z.string().uuid({ message: "Expected a valid UUID" });
export type Id = z.infer<typeof IdSchema>;

export const TimestampSchema = z.string().datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const ApiEnvelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data, meta: z.object({}).optional(), error: z.object({ message: z.string(), code: z.string() }).optional() });

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);
export type JsonValue = z.infer<typeof JsonValueSchema>;