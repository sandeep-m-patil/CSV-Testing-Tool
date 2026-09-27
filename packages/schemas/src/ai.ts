import { z } from "zod";

export const AiElementSchema = z.object({
  role: z.string().optional(),
  elementType: z.string().optional(),
  label: z.string().optional(),
  name: z.string().optional(),
  placeholder: z.string().optional(),
  text: z.string().optional(),
  testId: z.string().optional(),
});
export type AiElement = z.infer<typeof AiElementSchema>;

export const AiPageContextSchema = z.object({
  url: z.string(),
  title: z.string(),
  pageType: z.string().optional(),
  elements: z.array(AiElementSchema).max(200),
});
export type AiPageContext = z.infer<typeof AiPageContextSchema>;

export const AiPageInterpretationSchema = z.object({
  pageType: z.enum(["login", "dashboard", "list", "form", "detail", "review", "settings", "core", "other"]),
  purpose: z.string().max(300),
  fields: z
    .array(
      z.object({
        name: z.string(),
        label: z.string().optional(),
        inputType: z.string().optional(),
        required: z.boolean().default(false),
      }),
    )
    .max(80),
  actions: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["submit", "cancel", "navigate", "create", "edit", "delete", "search", "other"]),
        targetUrl: z.string().optional(),
      }),
    )
    .max(50),
});
export type AiPageInterpretation = z.infer<typeof AiPageInterpretationSchema>;

export const AiWorkflowAnalysisSchema = z.object({
  name: z.string().min(1).max(200),
  purpose: z.string().max(500),
  workflows: z.array(
    z.object({
      name: z.string().min(1).max(200),
      steps: z.array(z.string()),
    }),
  ),
});
export type AiWorkflowAnalysis = z.infer<typeof AiWorkflowAnalysisSchema>;