export const queryKeys = {
  me: ["me"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  applications: (projectId: string) => ["projects", projectId, "applications"] as const,
  application: (id: string) => ["applications", id] as const,
  modules: (applicationId: string) => ["applications", applicationId, "modules"] as const,
  module: (id: string) => ["modules", id] as const,
  moduleWithRelations: (id: string) => ["modules", id, "detail"] as const,
  discovery: (moduleId: string) => ["modules", moduleId, "discovery"] as const,
  workflows: (moduleId: string) => ["modules", moduleId, "workflows"] as const,
  testCases: (moduleId: string) => ["modules", moduleId, "test-cases"] as const,
  report: (moduleId: string) => ["modules", moduleId, "report"] as const,
};