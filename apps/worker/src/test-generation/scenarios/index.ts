import type { GeneratedCase } from "../../test-execution/types";
import type { ClassifiedField } from "../fields";
import { findByRole } from "../fields";
import { buildAuthScenarios } from "./auth";
import { buildGenericScenarios } from "./generic";

export interface ScenarioTarget {
  pageUrl: string;
  pageName: string;
  fields: ClassifiedField[];
}

/** An auth form is recognised by an identifier field paired with a password field. */
export function isAuthForm(fields: ClassifiedField[]): boolean {
  return findByRole(fields, "email") !== undefined && findByRole(fields, "password") !== undefined;
}

export function buildScenariosForPage(target: ScenarioTarget): GeneratedCase[] {
  if (isAuthForm(target.fields)) {
    return buildAuthScenarios(target.pageUrl);
  }
  return buildGenericScenarios(target.pageUrl, target.pageName, target.fields);
}

export { buildAuthScenarios, buildGenericScenarios };
