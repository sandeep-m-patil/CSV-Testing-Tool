import { CircleAlert, FileSpreadsheet } from "lucide-react";
import { TEST_CASE_COLUMNS, TEST_CASE_FIELDS, type ColumnMapping, type CsvTable, type ImportValidation } from "@repo/schemas";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/** Rows shown in the preview; the summary still counts every row. */
const PREVIEW_ROWS = 100;

export function FileStep({ onFile, fileNote }: { onFile: (file: File) => void; fileNote: string | null }) {
  return (
    <div className="space-y-3">
      <Label htmlFor="csv-file" className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-accent/40">
        <FileSpreadsheet className="h-8 w-8" aria-hidden="true" />
        <span className="font-medium text-foreground">Choose a CSV file</span>
        <span>UTF-8, UTF-16 or Windows-1252; comma, semicolon or tab separated; up to 2,000 rows.</span>
      </Label>
      <Input id="csv-file" type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} />
      {fileNote && <p className="text-sm text-destructive" role="alert">{fileNote}</p>}
    </div>
  );
}

export function MappingStep({ table, mapping, onChange }: { table: CsvTable; mapping: ColumnMapping; onChange: (mapping: ColumnMapping) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TEST_CASE_FIELDS.map((field) => {
        const spec = TEST_CASE_COLUMNS[field];
        const isMissing = spec.isRequired && mapping[field] === null;
        return (
          <div key={field} className="space-y-1">
            <Label htmlFor={`map-${field}`}>
              {spec.header}
              {spec.isRequired && <span className="text-destructive"> *</span>}
            </Label>
            <Select id={`map-${field}`} aria-invalid={isMissing} value={mapping[field] ?? ""} onChange={(event) => onChange({ ...mapping, [field]: event.target.value === "" ? null : Number(event.target.value) })}>
              <option value="">Not imported</option>
              {table.headers.map((header, index) => (
                <option key={`${header}-${index}`} value={index}>
                  {header || `Column ${index + 1}`}
                </option>
              ))}
            </Select>
            {spec.hint && <p className="text-xs text-muted-foreground">{spec.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function PreviewStep({ validation }: { validation: ImportValidation }) {
  const withErrors = validation.rows.filter((row) => row.errors.length > 0).length;
  const needsReview = validation.rows.filter((row) => row.errors.length === 0 && row.status === "NEEDS_REVIEW").length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="success">{validation.rows.length - withErrors - needsReview} ready</Badge>
        <Badge variant="warning">{needsReview} need review</Badge>
        <Badge variant={withErrors > 0 ? "destructive" : "muted"}>{withErrors} with errors</Badge>
      </div>
      {validation.fileErrors.length > 0 && <ErrorList title="File" errors={validation.fileErrors} />}
      <div className="max-h-80 overflow-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5">Line</th>
              <th className="px-2 py-1.5">Test ID</th>
              <th className="px-2 py-1.5">Scenario</th>
              <th className="px-2 py-1.5">Result</th>
            </tr>
          </thead>
          <tbody>
            {validation.rows.slice(0, PREVIEW_ROWS).map((row) => (
              <tr key={row.line} className="border-t align-top">
                <td className="px-2 py-1.5 tabular-nums">{row.line}</td>
                <td className="px-2 py-1.5 font-mono">{row.code || "—"}</td>
                <td className="px-2 py-1.5">{row.name || "—"}</td>
                <td className="px-2 py-1.5">{row.errors.length > 0 ? <span className="text-destructive">{row.errors.join(" ")}</span> : row.status === "NEEDS_REVIEW" ? "Needs review (no VERIFY step)" : `${row.input?.steps.length ?? 0} steps`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {validation.rows.length > PREVIEW_ROWS && <p className="text-xs text-muted-foreground">Showing the first {PREVIEW_ROWS} of {validation.rows.length} rows.</p>}
    </div>
  );
}

export function ErrorList({ title, errors }: { title: string; errors: string[] }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
      <p className="mb-1 flex items-center gap-1.5 font-medium">
        <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </p>
      <ul className="list-disc space-y-0.5 pl-5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
