"use client";

import { Download, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { CsvImportWizard } from "./csv-import-wizard";
import { TestCaseEditor } from "./test-case-editor";

/** Write a case by hand, or move cases in and out as CSV. */
export function TestCaseToolbar({ moduleId, moduleName, caseCount }: { moduleId: string; moduleName: string; caseCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TestCaseEditor
        moduleId={moduleId}
        trigger={
          <Button>
            <Plus className="h-4 w-4" />
            New test case
          </Button>
        }
      />
      <CsvImportWizard moduleId={moduleId} moduleName={moduleName} />
      {caseCount > 0 && (
        <a className={buttonVariants({ variant: "outline" })} href={`/api/modules/${moduleId}/test-cases/export`} download>
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      )}
    </div>
  );
}
