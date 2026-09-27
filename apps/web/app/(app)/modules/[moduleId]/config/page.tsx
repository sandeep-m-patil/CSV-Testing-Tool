"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { useModuleDetail } from "@/features/hooks";
import { ModuleNav } from "@/features/modules/module-nav";
import { CredentialManager, type CredentialRow } from "@/features/credentials/credential-manager";
import { TestDataManager, type TestDataSetRow } from "@/features/test-data/test-data-manager";

export default function ModuleConfigPage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;

  const { data, isLoading } = useModuleDetail(moduleId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const module = data?.module;
  if (!module) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Module not found.</div>;
  }

  const credentials = (data?.credentials ?? []).map((credential): CredentialRow => ({ ...credential, moduleId }));
  const testDataSets = (data?.testDataSets ?? []).map((dataset): TestDataSetRow => ({
    ...dataset,
    moduleId,
    dataType: dataset.dataType.toUpperCase() === "CSV" ? "CSV_TEMPLATE" : "KEY_VALUE",
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleNav moduleId={moduleId} moduleName={module.name} status={module.discoveryStatus} />

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>How this is used</AlertTitle>
        <AlertDescription>
          The discovery worker logs in with each credential role to explore the module, and uses test data to fill
          forms. Credentials stay encrypted, are only decrypted inside the worker process, and are never written to
          logs, screenshots, or the browser&apos;s normal session store.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <CredentialManager moduleId={moduleId} initial={credentials} />
        <TestDataManager moduleId={moduleId} initial={testDataSets} />
      </div>
    </div>
  );
}