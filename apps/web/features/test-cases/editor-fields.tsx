import { CircleAlert, CircleCheck } from "lucide-react";
import { hasCheckableOutcome, TestCasePrioritySchema, TestCaseSeveritySchema, TestCaseTypeSchema, type StepDslResult } from "@repo/schemas";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { titleCase } from "@/lib/utils";
import { STEPS_PLACEHOLDER, type EditorValues } from "./editor-form";

type Setter = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => void;

interface FieldProps {
  values: EditorValues;
  set: Setter;
}

function TextField({ values, set, field, label, placeholder }: FieldProps & { field: keyof EditorValues; label: string; placeholder?: string }) {
  const id = `case-${field}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={values[field]} placeholder={placeholder} onChange={(event) => set(field, event.target.value)} />
    </div>
  );
}

function ChoiceField({ values, set, field, label, options, allowBlank }: FieldProps & { field: keyof EditorValues; label: string; options: readonly string[]; allowBlank?: boolean }) {
  const id = `case-${field}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={values[field]} onChange={(event) => set(field, event.target.value)}>
        {allowBlank && <option value="">Not set</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {titleCase(option.toLowerCase().replace(/_/g, " "))}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Identity, classification and context of the case. */
export function MetaFields({ values, set, roles, datasets }: FieldProps & { roles: string[]; datasets: Array<{ id: string; name: string }> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField values={values} set={set} field="code" label="Test ID" placeholder="Generated if left blank" />
      <TextField values={values} set={set} field="name" label="Scenario" placeholder="Checks out with a saved card" />
      <ChoiceField values={values} set={set} field="type" label="Type" options={TestCaseTypeSchema.options} />
      <ChoiceField values={values} set={set} field="priority" label="Priority" options={TestCasePrioritySchema.options} />
      <ChoiceField values={values} set={set} field="severity" label="Severity" options={TestCaseSeveritySchema.options} allowBlank />
      <div className="space-y-1.5">
        <Label htmlFor="case-role">Role</Label>
        <Input id="case-role" list="case-role-options" value={values.role} placeholder="Signed out" onChange={(event) => set("role", event.target.value)} />
        <datalist id="case-role-options">
          {roles.map((role) => <option key={role} value={role} />)}
        </datalist>
      </div>
      <TextField values={values} set={set} field="tags" label="Tags" placeholder="smoke, checkout" />
      <DatasetField values={values} set={set} datasets={datasets} />
    </div>
  );
}

function DatasetField({ values, set, datasets }: FieldProps & { datasets: Array<{ id: string; name: string }> }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="case-datasetId">Dataset (run once per row)</Label>
      <Select id="case-datasetId" value={values.datasetId} onChange={(event) => set("datasetId", event.target.value)}>
        <option value="">None</option>
        {datasets.map((dataset) => (
          <option key={dataset.id} value={dataset.id}>
            {dataset.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Free-text context that is shown to reviewers but not executed. */
export function NarrativeFields({ values, set }: FieldProps) {
  const area = (field: keyof EditorValues, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`case-${field}`}>{label}</Label>
      <Textarea id={`case-${field}`} rows={2} value={values[field]} onChange={(event) => set(field, event.target.value)} />
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {area("description", "Description")}
      {area("precondition", "Preconditions")}
      {area("testData", "Test data")}
      {area("expectedResult", "Expected result")}
    </div>
  );
}

/** Steps as editable text, re-parsed on every keystroke so errors appear where they are made. */
export function StepsField({ values, set, parsed }: FieldProps & { parsed: StepDslResult }) {
  const isCheckable = hasCheckableOutcome(parsed.steps);
  return (
    <div className="space-y-2">
      <Label htmlFor="case-steps">Steps</Label>
      <Textarea id="case-steps" rows={10} spellCheck={false} className="font-mono text-xs" placeholder={STEPS_PLACEHOLDER} value={values.stepsText} onChange={(event) => set("stepsText", event.target.value)} />
      {parsed.errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
          {parsed.errors.map((error) => (
            <li key={error.step}>Step {error.step}: {error.message}</li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {isCheckable ? <CircleCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <CircleAlert className="h-3.5 w-3.5 text-warning" aria-hidden="true" />}
        {isCheckable
          ? `${parsed.steps.length} steps, with a checkable outcome.`
          : "No VERIFY step yet: the case is saved as Needs review and will not run until it asserts something."}
      </p>
    </div>
  );
}
