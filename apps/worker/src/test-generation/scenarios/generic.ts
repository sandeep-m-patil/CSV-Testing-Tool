import type { GeneratedCase } from "../../test-execution/types";
import { ScenarioBuilder } from "../scenario-builder";
import { SQL_PAYLOAD, XSS_PAYLOAD, longInput } from "../scenario-data";
import type { ClassifiedField } from "../fields";
import { hintFor } from "../fields";

const FILLABLE_ROLES = ["text", "email", "password", "select"] as const;

function fillable(fields: ClassifiedField[]): ClassifiedField[] {
  return fields.filter((field) => (FILLABLE_ROLES as readonly string[]).includes(field.role));
}

/**
 * True when the page exposes something a user could type into. Links and
 * buttons are classified too, so callers must not test `fields.length` here.
 */
export function hasFillableFields(fields: ClassifiedField[]): boolean {
  return fillable(fields).length > 0;
}

function hintList(fields: ClassifiedField[]): string[] {
  return fields.map(hintFor);
}

/** Baseline coverage applied to any discovered form that is not an auth form. */
export function buildGenericScenarios(pageUrl: string, pageName: string, fields: ClassifiedField[]): GeneratedCase[] {
  const inputs = fillable(fields);
  if (inputs.length === 0) return [];

  const hints = hintList(inputs);
  const submit = "role:submit";
  const label = `${pageName} form`;

  return [
    new ScenarioBuilder(pageUrl)
      .fill(hints[0]!, "Test Value 1")
      .fill(hints[1] ?? hints[0]!, "Test Value 2")
      .submit(submit)
      .verify({ kind: "app_responsive" })
      .build({
        name: `${label} submits with valid data`,
        type: "HAPPY_PATH",
        priority: "HIGH",
        testData: "populated values for every field",
        expectedResult: "Form submits and the application stays responsive",
      }),

    new ScenarioBuilder(pageUrl)
      .fill(hints[0]!, "")
      .fill(hints[1] ?? hints[0]!, "")
      .submit(submit)
      .verify({ kind: "stayed_on_page", fromUrl: pageUrl })
      .build({
        name: `${label} rejects empty required fields`,
        type: "VALIDATION",
        priority: "HIGH",
        testData: "all fields blank",
        expectedResult: "Required-field validation is displayed and the form does not submit",
      }),

    new ScenarioBuilder(pageUrl)
      .fill(hints[0]!, longInput())
      .submit(submit)
      .verify({ kind: "app_responsive" })
      .build({
        name: `${label} handles excessively long input`,
        type: "BOUNDARY",
        priority: "MEDIUM",
        testData: "500-character value",
        expectedResult: "Application handles the input without crashing",
      }),

    new ScenarioBuilder(pageUrl)
      .fill(hints[0]!, SQL_PAYLOAD)
      .submit(submit)
      .verify({ kind: "app_responsive" })
      .build({
        name: `${label} handles SQL injection input`,
        type: "AUTHORIZATION",
        priority: "CRITICAL",
        testData: "' OR '1'='1",
        expectedResult: "Input is treated as data; the application remains secure and responsive",
      }),

    new ScenarioBuilder(pageUrl)
      .fill(hints[0]!, XSS_PAYLOAD)
      .submit(submit)
      .verify({ kind: "app_responsive" })
      .build({
        name: `${label} handles script injection input`,
        type: "AUTHORIZATION",
        priority: "CRITICAL",
        testData: "<script>alert(1)</script>",
        expectedResult: "Input is not executed as script; the application stays responsive",
      }),
  ];
}
