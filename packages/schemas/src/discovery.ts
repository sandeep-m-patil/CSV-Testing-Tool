import { z } from "zod";

export const DiscoverySessionStatusSchema = z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]);
export type DiscoverySessionStatus = z.infer<typeof DiscoverySessionStatusSchema>;

export const DiscoverySessionSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  status: DiscoverySessionStatusSchema,
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  currentUrl: z.string().nullable(),
  currentStep: z.string().nullable(),
  pagesDiscovered: z.number().int().min(0),
  actionsDiscovered: z.number().int().min(0),
  workflowsDiscovered: z.number().int().min(0),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type DiscoverySession = z.infer<typeof DiscoverySessionSchema>;

export const PageTypeSchema = z.enum(["login", "dashboard", "list", "form", "detail", "review", "settings", "core", "other"]);
export type PageType = z.infer<typeof PageTypeSchema>;

export const DiscoveredPageSchema = z.object({
  id: z.string().uuid(),
  discoverySessionId: z.string().uuid(),
  moduleId: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  name: z.string(),
  pageType: PageTypeSchema,
  parentPageId: z.string().uuid().nullable(),
  order: z.number().int().min(0),
  discoveredAt: z.string().datetime(),
});
export type DiscoveredPage = z.infer<typeof DiscoveredPageSchema>;

export const ElementTypeSchema = z.enum([
  "button",
  "link",
  "input",
  "textbox",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "tab",
  "table",
  "dialog",
  "form",
  "menu",
  "menuitem",
  "image",
]);
export type ElementType = z.infer<typeof ElementTypeSchema>;

export const DiscoveredElementSchema = z.object({
  id: z.string().uuid(),
  discoverySessionId: z.string().uuid(),
  pageId: z.string().uuid(),
  moduleId: z.string().uuid(),
  elementType: ElementTypeSchema,
  role: z.string().nullable(),
  name: z.string().nullable(),
  text: z.string().nullable(),
  placeholder: z.string().nullable(),
  label: z.string().nullable(),
  testId: z.string().nullable(),
  cssSelector: z.string().nullable(),
  xpath: z.string().nullable(),
  ariaAttributes: z.record(z.string(), z.string()).nullable(),
  visible: z.boolean(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
});
export type DiscoveredElement = z.infer<typeof DiscoveredElementSchema>;

export const ActionTypeSchema = z.enum([
  "CLICK",
  "FILL",
  "SELECT",
  "CHECK",
  "UNCHECK",
  "UPLOAD",
  "NAVIGATE",
  "SUBMIT",
  "OPEN_DIALOG",
  "CLOSE_DIALOG",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ActionTargetSchema = z.object({
  elementType: ElementTypeSchema.optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  testId: z.string().optional(),
  url: z.string().optional(),
});
export type ActionTarget = z.infer<typeof ActionTargetSchema>;

export const DiscoveredActionSchema = z.object({
  id: z.string().uuid(),
  discoverySessionId: z.string().uuid(),
  pageId: z.string().uuid(),
  moduleId: z.string().uuid(),
  action: ActionTypeSchema,
  target: ActionTargetSchema,
  dangerous: z.boolean(),
  blocked: z.boolean(),
  executed: z.boolean(),
  createdAt: z.string().datetime(),
});
export type DiscoveredAction = z.infer<typeof DiscoveredActionSchema>;

export const StateTransitionSchema = z.object({
  id: z.string().uuid(),
  discoverySessionId: z.string().uuid(),
  moduleId: z.string().uuid(),
  fromPageId: z.string().uuid(),
  toPageId: z.string().uuid(),
  actionId: z.string().uuid().nullable(),
  label: z.string(),
  createdAt: z.string().datetime(),
});
export type StateTransition = z.infer<typeof StateTransitionSchema>;

export const DiscoveryLogLevelSchema = z.enum(["info", "success", "warn", "error", "debug"]);
export type DiscoveryLogLevel = z.infer<typeof DiscoveryLogLevelSchema>;

export const DiscoveryLogSchema = z.object({
  id: z.string().uuid(),
  discoverySessionId: z.string().uuid(),
  level: DiscoveryLogLevelSchema,
  message: z.string(),
  data: z.record(z.string(), z.any()).nullable(),
  createdAt: z.string().datetime(),
});
export type DiscoveryLog = z.infer<typeof DiscoveryLogSchema>;

export const ArtifactTypeSchema = z.enum(["screenshot", "trace", "dom_snapshot", "log", "pdf", "video"]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const DiscoveryArtifactSchema = z.object({
  id: z.string().uuid(),
  discoverySessionId: z.string().uuid(),
  moduleId: z.string().uuid().nullable(),
  actionId: z.string().uuid().nullable(),
  pageId: z.string().uuid().nullable(),
  artifactType: ArtifactTypeSchema,
  storageKey: z.string(),
  url: z.string().nullable(),
  label: z.string(),
  createdAt: z.string().datetime(),
});
export type DiscoveryArtifact = z.infer<typeof DiscoveryArtifactSchema>;

export const DiscoverySessionProgressSchema = DiscoverySessionSchema.extend({
  application: z.object({ name: z.string(), baseUrl: z.string(), environment: z.string() }),
  moduleName: z.string(),
  logs: z.array(DiscoveryLogSchema).default([]),
  artifacts: z.array(DiscoveryArtifactSchema).default([]),
});
export type DiscoverySessionProgress = z.infer<typeof DiscoverySessionProgressSchema>;

export const DiscoverModuleInputSchema = z.object({
  role: z.string().trim().min(1).max(120).optional(),
});
export type DiscoverModuleInput = z.infer<typeof DiscoverModuleInputSchema>;