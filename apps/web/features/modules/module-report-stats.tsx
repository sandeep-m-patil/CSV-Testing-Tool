import { Activity, FileCode2, GitBranch, Images, Layers, Route, ShieldAlert, Table2 } from "lucide-react";
import type { ModuleReport } from "@/features/hooks";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";

type Report = ModuleReport["report"];

/** KPI grid summarising what the latest discovery run found. */
export function ModuleReportStats({ report }: { report: Report | undefined }) {
  if (!report) return null;

  const items = [
    { icon: <Layers />, label: "Pages", value: report.counts.pages },
    { icon: <Table2 />, label: "Forms", value: report.counts.forms },
    { icon: <Activity />, label: "Actions", value: report.counts.actions },
    { icon: <GitBranch />, label: "Workflows", value: report.counts.workflows },
    { icon: <FileCode2 />, label: "Candidate tests", value: report.counts.testCases },
    { icon: <Route />, label: "Transitions", value: report.counts.transitions },
    { icon: <Images />, label: "Artifacts", value: report.counts.artifacts },
    { icon: <ShieldAlert />, label: "Roles", value: report.counts.roles },
  ];

  return (
    <section className="space-y-4" aria-labelledby="discovery-report-heading">
      <SectionHeader
        title={<span id="discovery-report-heading">Discovery report</span>}
        description={
          report.discovery
            ? `Latest run started ${formatDate(report.discovery.startedAt)}`
            : "No discovery run yet"
        }
        actions={report.discovery ? <StatusBadge status={report.discovery.status} /> : null}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} icon={item.icon} />
        ))}
      </div>
      {report.roles.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Roles explored:</span> {report.roles.join(", ")}
        </p>
      )}
    </section>
  );
}
