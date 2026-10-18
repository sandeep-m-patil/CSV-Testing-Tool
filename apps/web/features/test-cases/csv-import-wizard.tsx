"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  autoMapColumns,
  decodeCsvBytes,
  MAX_CSV_BYTES,
  parseCsvTable,
  validateTestCaseRows,
  type ColumnMapping,
  type CsvTable,
} from "@repo/schemas";
import { ApiError, apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { ErrorList, FileStep, MappingStep, PreviewStep } from "./csv-import-steps";

type Stage = "file" | "map" | "preview" | "done";
type Mode = "upsert" | "create_only";

interface Loaded {
  text: string;
  table: CsvTable;
  note: string;
}

/**
 * Choose file → map columns → preview with row-level errors → import. The
 * preview uses the same validator the API runs, and the API imports nothing
 * unless every row is valid.
 */
export function CsvImportWizard({ moduleId, moduleName }: { moduleId: string; moduleName: string }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("file");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [mode, setMode] = useState<Mode>("upsert");
  const [message, setMessage] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const validation = useMemo(() => (loaded && mapping ? validateTestCaseRows(loaded.table, mapping, moduleName) : null), [loaded, mapping, moduleName]);
  const submit = useImport(moduleId);

  function reset(next: boolean) {
    setOpen(next);
    setStage("file");
    setLoaded(null);
    setMapping(null);
    setMessage(null);
    setServerErrors([]);
  }

  async function onFile(file: File) {
    if (file.size > MAX_CSV_BYTES) return setMessage(`The file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.`);
    const decoded = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
    const table = parseCsvTable(decoded.text);
    const delimiter = table.delimiter === "\t" ? "tab" : `"${table.delimiter}"`;
    setLoaded({ text: decoded.text, table, note: `${file.name}: ${table.rows.length} rows, ${decoded.encoding}, ${delimiter} separated` });
    setMapping(autoMapColumns(table.headers));
    setMessage(null);
    setStage("map");
  }

  async function runImport() {
    if (!loaded || !mapping) return;
    const outcome = await submit({ csv: loaded.text, mapping, mode });
    if (typeof outcome === "string") {
      setMessage(outcome);
      setStage("done");
    } else setServerErrors(outcome);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline">Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import test cases</DialogTitle>
          <DialogDescription>{loaded?.note ?? `Into module "${moduleName}". Rows are matched to existing cases by Test ID.`}</DialogDescription>
        </DialogHeader>
        {stage === "file" && <FileStep onFile={(file) => void onFile(file)} fileNote={message} />}
        {stage === "map" && loaded && mapping && <MappingStep table={loaded.table} mapping={mapping} onChange={setMapping} />}
        {stage === "preview" && validation && <PreviewStep validation={validation} />}
        {serverErrors.length > 0 && <ErrorList title="The server rejected the file; nothing was imported." errors={serverErrors} />}
        {stage === "done" && <p className="text-sm">{message}</p>}
        <DialogFooter className="items-center gap-2">
          {stage === "preview" && (
            <Select aria-label="Existing Test IDs" value={mode} onChange={(event) => setMode(event.target.value as Mode)} className="sm:mr-auto sm:w-64">
              <option value="upsert">Update cases with matching Test IDs</option>
              <option value="create_only">Skip rows whose Test ID exists</option>
            </Select>
          )}
          {stage === "map" && <Button onClick={() => setStage("preview")}>Preview</Button>}
          {stage === "preview" && <Button variant="outline" onClick={() => setStage("map")}>Back to mapping</Button>}
          {stage === "preview" && (
            <Button disabled={!validation?.isValid} onClick={() => void runImport()}>
              Import {validation?.rows.length ?? 0} cases
            </Button>
          )}
          {stage === "done" && <Button onClick={() => reset(false)}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}

/** Resolves to a summary on success, or the server's row errors on a rejected file. */
function useImport(moduleId: string) {
  const queryClient = useQueryClient();
  return async (body: { csv: string; mapping: ColumnMapping; mode: Mode }): Promise<string | string[]> => {
    try {
      const { result } = await apiFetch<{ result: ImportResult }>(`/api/modules/${moduleId}/test-cases/import`, { method: "POST", body: JSON.stringify(body) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.testCases(moduleId) });
      toast.success("Import complete");
      return `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}. Imported cases are drafts; cases without a VERIFY step are marked Needs review.`;
    } catch (error) {
      if (error instanceof ApiError && error.code === "CSV_INVALID") return rowErrorsOf(error.details);
      errorToast(error);
      return [];
    }
  };
}

function rowErrorsOf(details: unknown): string[] {
  const value = details as { fileErrors?: string[]; rowErrors?: Array<{ line: number; errors: string[] }> } | undefined;
  return [...(value?.fileErrors ?? []), ...(value?.rowErrors ?? []).map((row) => `Line ${row.line}: ${row.errors.join(" ")}`)];
}
