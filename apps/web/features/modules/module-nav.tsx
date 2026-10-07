"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, KeyRound, LayoutDashboard, ListChecks, PlayCircle, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, type BreadcrumbItem } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeleteModuleButton } from "@/features/modules/delete-module-button";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "config", label: "Credentials & Data", icon: KeyRound },
  { key: "discovery", label: "Discovery", icon: Radar },
  { key: "review", label: "Review", icon: ListChecks },
  { key: "test-runs", label: "Test runs", icon: PlayCircle },
  { key: "report", label: "Report", icon: FileText },
] as const;

export interface ModuleNavProps {
  moduleId: string;
  moduleName: string;
  status: string;
  /** When known, the breadcrumb runs Projects / project / module instead of Modules / module. */
  project?: { id: string; name: string } | null;
  /** Page-level actions shown next to the delete button. */
  actions?: React.ReactNode;
}

function breadcrumbsFor(moduleName: string, project: ModuleNavProps["project"]): BreadcrumbItem[] {
  if (project) {
    return [
      { label: "Projects", href: "/projects" },
      { label: project.name, href: `/projects/${project.id}` },
      { label: moduleName },
    ];
  }
  return [{ label: "Modules", href: "/modules" }, { label: moduleName }];
}

/** Module workspace header: breadcrumbs, title + status, actions, and the section tab bar. */
export function ModuleNav({ moduleId, moduleName, status, project, actions }: ModuleNavProps) {
  const pathname = usePathname();

  return (
    <div className="mb-6 space-y-5">
      <PageHeader
        breadcrumbs={breadcrumbsFor(moduleName, project)}
        title={moduleName}
        meta={<StatusBadge status={status} />}
        actions={
          <>
            {actions}
            <DeleteModuleButton moduleId={moduleId} moduleName={moduleName} />
          </>
        }
      />
      <nav aria-label="Module sections" className="scrollbar-none -mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const href = tab.key === "overview" ? `/modules/${moduleId}` : `/modules/${moduleId}/${tab.key}`;
            const isActive = pathname === href;
            const Icon = tab.icon;
            return (
              <li key={tab.key}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-t-md px-3 pb-2.5 pt-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-brand" : "")} aria-hidden="true" />
                  {tab.label}
                  {isActive ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" aria-hidden="true" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
