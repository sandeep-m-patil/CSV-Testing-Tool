import type { GeneratedCase } from "../../test-execution/types";
import type { ClassifiedField, DiscoveredControl } from "../fields";
import { findByRole } from "../fields";
import { buildAuthScenarios } from "./auth";
import {
  buildCartScenarios,
  buildNavigationScenarios,
  buildProductDetailScenarios,
  hasAddToCart,
  looksLikeCart,
} from "./commerce";
import { buildGenericScenarios, hasFillableFields } from "./generic";

export interface ScenarioTarget {
  pageUrl: string;
  pageName: string;
  fields: ClassifiedField[];
  controls: DiscoveredControl[];
}

/** An auth form is recognised by an identifier field paired with a password field. */
export function isAuthForm(fields: ClassifiedField[]): boolean {
  return findByRole(fields, "email") !== undefined && findByRole(fields, "password") !== undefined;
}

/**
 * Chooses the scenario set for a page. Commerce pages are matched first: a
 * product or basket page has no fillable inputs, so the form builders would
 * return nothing and the page would fall back to a bare smoke case.
 */
export function buildScenariosForPage(target: ScenarioTarget): GeneratedCase[] {
  const { pageUrl, pageName, fields, controls } = target;

  if (hasAddToCart(controls)) {
    return buildProductDetailScenarios(pageUrl, pageName, controls);
  }
  if (isAuthForm(fields)) {
    return buildAuthScenarios(pageUrl);
  }
  if (looksLikeCart(controls)) {
    return buildCartScenarios(pageUrl, pageName, controls);
  }
  // A page with no fillable inputs cannot be covered by the form builders, so
  // fall back to checking that its navigation links resolve.
  if (!hasFillableFields(fields)) {
    return buildNavigationScenarios(pageUrl, controls);
  }
  return buildGenericScenarios(pageUrl, pageName, fields);
}

export { buildAuthScenarios, buildCartScenarios, buildGenericScenarios, buildNavigationScenarios, buildProductDetailScenarios };
