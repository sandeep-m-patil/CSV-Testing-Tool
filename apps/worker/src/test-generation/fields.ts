import { EMAIL_HINTS, PASSWORD_HINTS, SUBMIT_HINTS } from "./scenario-data";

/**
 * Classifies a discovered page's controls into semantic roles. Roles become the
 * portable locator hints stored in generated test cases (e.g. `role:email`).
 */

export type FieldRole = "email" | "password" | "text" | "select" | "checkbox" | "radio" | "submit" | "button";

export interface DiscoveredControl {
  elementType: string;
  name: string | null;
  label: string | null;
  placeholder: string | null;
  /** Visible caption of a button or link, e.g. "Add to Cart". */
  text: string | null;
  testId: string | null;
  cssSelector: string | null;
  ariaAttributes: unknown;
  /** HTML input type (`password`, `email`...), when the element is an input. */
  inputType?: string | null;
}

export interface ClassifiedField {
  role: FieldRole;
  /** 0-based position among fields sharing the same role. */
  ordinal: number;
  label: string;
}

function haystack(control: DiscoveredControl): string {
  return [control.name, control.label, control.placeholder, control.testId, control.text]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();
}

function matches(hay: string, hints: string[]): boolean {
  return hints.some((hint) => hay.includes(hint));
}

function classifyControl(control: DiscoveredControl): FieldRole {
  const type = control.elementType.toLowerCase();
  if (type === "select") return "select";
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (type === "button" || type === "a" || type === "link") {
    return matches(haystack(control), SUBMIT_HINTS) ? "submit" : "button";
  }
  if (type === "input" || type === "textarea") {
    const hay = haystack(control);
    if (matches(hay, PASSWORD_HINTS)) return "password";
    if (matches(hay, EMAIL_HINTS)) return "email";
    if (type === "textarea") return "text";
    return "text";
  }
  return "text";
}

function labelFor(control: DiscoveredControl, fallback: string): string {
  return control.label ?? control.placeholder ?? control.text ?? control.name ?? fallback;
}

/** Returns controls mapped to a role, preserving DOM order and numbering repeats. */
export function classifyFields(controls: DiscoveredControl[]): ClassifiedField[] {
  const counters = new Map<FieldRole, number>();
  const out: ClassifiedField[] = [];

  for (const control of controls) {
    const role = classifyControl(control);
    const ordinal = counters.get(role) ?? 0;
    counters.set(role, ordinal + 1);
    out.push({
      role,
      ordinal,
      label: labelFor(control, `${role} ${ordinal + 1}`),
    });
  }
  return out;
}

export function findByRole(fields: ClassifiedField[], role: FieldRole): ClassifiedField | undefined {
  return fields.find((field) => field.role === role);
}

export function hintFor(field: ClassifiedField): string {
  return field.ordinal > 0 ? `role:${field.role}:${field.ordinal}` : `role:${field.role}`;
}
