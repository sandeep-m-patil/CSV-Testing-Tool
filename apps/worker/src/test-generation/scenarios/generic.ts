import type { GeneratedCase } from "../../test-execution/types";
import { ScenarioBuilder } from "../scenario-builder";
import { SQL_PAYLOAD, XSS_PAYLOAD, longInput } from "../scenario-data";
import type { ClassifiedField } from "../fields";
import { applyValue, fillAll, isFillable, isFreeText } from "../field-values";

const TYPEABLE_ROLES = ["text", "email", "password", "select"] as const;
/** Keeps one generated case readable; forms longer than this are rare. */
const MAX_FIELDS_PER_CASE = 15;
const FALLBACK_SUBMIT_HINT = "role:submit";

/**
 * True when the page exposes something a user could type into. Links and
 * buttons are classified too, so callers must not test `fields.length` here.
 */
export function hasFillableFields(fields: ClassifiedField[]): boolean {
  return fields.some((field) => (TYPEABLE_ROLES as readonly string[]).includes(field.role) && isFillable(field));
}

/** The form's own submit control as discovery saw it, else the generic resolver. */
function submitHintFor(fields: ClassifiedField[]): string {
  return fields.find((field) => field.role === "submit")?.hint ?? FALLBACK_SUBMIT_HINT;
}

interface FormTarget {
  pageUrl: string;
  label: string;
  inputs: ClassifiedField[];
  submit: string;
}

/**
 * Baseline coverage applied to any discovered form that is not an auth form.
 * Each step targets the exact control discovery found, with a value its type
 * accepts, so the happy path fails only when the application does.
 */
export function buildGenericScenarios(pageUrl: string, pageName: string, fields: ClassifiedField[]): GeneratedCase[] {
  if (!hasFillableFields(fields)) return [];
  const form: FormTarget = {
    pageUrl,
    label: `${pageName} form`,
    inputs: fields.filter(isFillable).slice(0, MAX_FIELDS_PER_CASE),
    submit: submitHintFor(fields),
  };
  return [happyPath(form), emptyRequired(form), ...payloadCases(form)];
}

function happyPath(form: FormTarget): GeneratedCase {
  return fillAll(new ScenarioBuilder(form.pageUrl), form.inputs)
    .submit(form.submit)
    .verify({ kind: "app_responsive" })
    .build({
      name: `${form.label} submits with valid data`,
      type: "HAPPY_PATH",
      priority: "HIGH",
      testData: `valid values for ${form.inputs.map((field) => field.label).join(", ")}`,
      expectedResult: "Form submits and the application stays responsive",
    });
}

function emptyRequired(form: FormTarget): GeneratedCase {
  const builder = new ScenarioBuilder(form.pageUrl);
  // Only typed fields can be blanked; a select or checkbox is simply left alone.
  form.inputs.filter((field) => field.role !== "select" && field.role !== "checkbox" && field.role !== "radio")
    .forEach((field) => applyValue(builder, field, ""));
  return builder
    .submit(form.submit)
    .verify({ kind: "stayed_on_page", fromUrl: form.pageUrl })
    .build({
      name: `${form.label} rejects empty required fields`,
      type: "VALIDATION",
      priority: "HIGH",
      testData: "all fields blank",
      expectedResult: "Required-field validation is displayed and the form does not submit",
    });
}

/**
 * Long-input and injection cases need a free-text field; typing them into a
 * date or number input tests the browser, not the application. The other
 * fields get valid values so the payload actually reaches the server.
 */
function payloadCases(form: FormTarget): GeneratedCase[] {
  const target = form.inputs.find(isFreeText);
  if (!target) return [];
  const withPayload = (value: string) =>
    fillAll(new ScenarioBuilder(form.pageUrl), form.inputs, { field: target, value }).submit(form.submit).verify({ kind: "app_responsive" });

  return [
    withPayload(longInput()).build({
      name: `${form.label} handles excessively long input`,
      type: "BOUNDARY",
      priority: "MEDIUM",
      testData: `500-character value in "${target.label}"`,
      expectedResult: "Application handles the input without crashing",
    }),
    withPayload(SQL_PAYLOAD).build({
      name: `${form.label} handles SQL injection input`,
      type: "AUTHORIZATION",
      priority: "CRITICAL",
      testData: `' OR '1'='1 in "${target.label}"`,
      expectedResult: "Input is treated as data; the application remains secure and responsive",
    }),
    withPayload(XSS_PAYLOAD).build({
      name: `${form.label} handles script injection input`,
      type: "AUTHORIZATION",
      priority: "CRITICAL",
      testData: `<script>alert(1)</script> in "${target.label}"`,
      expectedResult: "Input is not executed as script; the application stays responsive",
    }),
  ];
}
