"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useModuleDetail, type TestCaseRecord } from "@/features/hooks";
import { bodyFromValues, EMPTY_EDITOR_VALUES, parseSteps, valuesFromCase, type EditorValues } from "./editor-form";
import { MetaFields, NarrativeFields, StepsField } from "./editor-fields";

interface TestCaseEditorProps {
  moduleId: string;
  /** The case to edit; omitted to write a new one. */
  testCase?: TestCaseRecord;
  trigger: React.ReactNode;
}

/** Create or edit a test case: metadata, narrative and executable steps in one panel. */
export function TestCaseEditor({ moduleId, testCase, trigger }: TestCaseEditorProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<EditorValues>(EMPTY_EDITOR_VALUES);
  const { data: detail } = useModuleDetail(moduleId);
  const parsed = useMemo(() => parseSteps(values), [values]);
  const save = useSave(moduleId, testCase?.id, () => setOpen(false));
  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  function onOpenChange(next: boolean) {
    if (next) setValues(testCase ? valuesFromCase(testCase) : EMPTY_EDITOR_VALUES);
    setOpen(next);
  }

  const isSavable = values.name.trim().length > 0 && parsed.errors.length === 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-[42rem] max-w-[95vw] overflow-y-auto p-6">
        <SheetTitle className="text-lg font-semibold">{testCase ? `Edit ${testCase.code}` : "New test case"}</SheetTitle>
        <SheetDescription className="mt-1 text-sm text-muted-foreground">
          Steps use one line each. Credentials stay as {"{{username}}"} and {"{{password}}"} and are filled in only when the case runs.
        </SheetDescription>
        <form
          className="mt-6 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save(bodyFromValues(values, parsed));
          }}
        >
          <MetaFields values={values} set={set} roles={[...new Set((detail?.credentials ?? []).map((credential) => credential.role))]} datasets={detail?.testDataSets ?? []} />
          <StepsField values={values} set={set} parsed={parsed} />
          <NarrativeFields values={values} set={set} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isSavable}>
              {testCase ? "Save changes" : "Create test case"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function useSave(moduleId: string, testId: string | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  return async (body: Record<string, unknown>) => {
    try {
      const path = testId ? `/api/modules/${moduleId}/test-cases/${testId}` : `/api/modules/${moduleId}/test-cases`;
      await apiFetch(path, { method: testId ? "PATCH" : "POST", body: JSON.stringify(body) });
      toast.success(testId ? "Test case saved" : "Test case created");
      await queryClient.invalidateQueries({ queryKey: queryKeys.testCases(moduleId) });
      onSaved();
    } catch (error) {
      errorToast(error);
    }
  };
}
