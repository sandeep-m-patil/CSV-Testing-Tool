"use client";

import { useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useModuleDetail } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { ModuleNotFound, ModulePageSkeleton } from "@/features/modules/module-page-states";
import { ModuleCredentialPicker } from "@/features/credentials/module-credential-picker";
import { ModuleSettingsCard } from "@/features/modules/module-settings-card";
import { TestDataManager, type TestDataSetRow } from "@/features/test-data/test-data-manager";

export default function ModuleConfigPage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;

  const { data, isLoading } = useModuleDetail(moduleId);

  if (isLoading) {
    return (
      <ModulePageSkeleton>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </ModulePageSkeleton>
    );
  }

  const module = data?.module;
  if (!module) return <ModuleNotFound />;

  const testDataSets = (data?.testDataSets ?? []).map((dataset): TestDataSetRow => ({
    ...dataset,
    moduleId,
    dataType: dataset.dataType.toUpperCase() === "CSV" ? "CSV_TEMPLATE" : "KEY_VALUE",
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleNav
        moduleId={moduleId}
        moduleName={module.name}
        status={module.discoveryStatus}
        project={data?.project ? { id: data.project.id, name: data.project.name } : null}
      />

      <Alert variant="info">
        <ShieldCheck />
        <AlertTitle>How this is used</AlertTitle>
        <AlertDescription>
          Credentials are defined once on the project and selected here. The discovery worker logs in with each
          selected role to explore the module, and uses test data to fill forms. Secrets stay encrypted, are only
          decrypted inside the worker process, and are never written to logs, screenshots, or reports.
        </AlertDescription>
      </Alert>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ModuleCredentialPicker moduleId={moduleId} projectId={data!.projectId} />
          <ModuleSettingsCard module={module} />
        </div>
        <TestDataManager moduleId={moduleId} initial={testDataSets} />
      </div>
    </div>
  );
}
