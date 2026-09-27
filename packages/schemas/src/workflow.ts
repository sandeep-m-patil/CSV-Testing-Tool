import { z } from "zod";
import { ActionTypeSchema, ActionTargetSchema } from "./discovery";

export const WorkflowStepActionSchema = z.enum(["navigate", "click", "fill", "select", "check", "uncheck", "submit", "verify", "upload"]);

export const WorkflowStepSchema = z.object({
  order: z.number().int().min(1),
  action: WorkflowStepActionSchema,
  target: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  optional: z.boolean().default(false),
  note: z.string().optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  discoverySessionId: z.string().uuid(),
  moduleId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  preconditions: z.array(z.string()).default([]),
  steps: z.array(WorkflowStepSchema),
  status: z.enum(["DRAFT", "APPROVED", "NEEDS_REVIEW"]).default("DRAFT"),
  source: z.enum(["discovered", "ai", "manual"]).default("discovered"),
  confidence: z.number().min(0).max(1).default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

export const CreateWorkflowInputSchema = z.object({
  moduleId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  preconditions: z.array(z.string()).default([]),
  steps: z.array(WorkflowStepSchema).min(1),
});
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInputSchema>;

export const UpdateWorkflowInputSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  preconditions: z.array(z.string()).optional(),
  steps: z.array(WorkflowStepSchema).min(1).optional(),
  status: z.enum(["DRAFT", "APPROVED", "NEEDS_REVIEW"]).optional(),
});
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowInputSchema>;

export const AiWorkflowSuggestionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  preconditions: z.array(z.string()).default([]),
  steps: z.array(WorkflowStepSchema).min(1),
});
export type AiWorkflowSuggestion = z.infer<typeof AiWorkflowSuggestionSchema>;