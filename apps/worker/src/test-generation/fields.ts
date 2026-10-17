import { EMAIL_HINTS, PASSWORD_HINTS, SUBMIT_HINTS } from "./scenario-data";
import { elementHint } from "./element-hint";

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
  /** False for a disabled or read-only control; absent means enabled. */
  enabled?: boolean;
}

export interface ClassifiedField {
  role: FieldRole;
  /** 0-based position among fields sharing the same role. */
  ordinal: number;
  label: string;
  /** HTML input type, lower-cased, when the control is an `<input>`. */
  inputType: string | null;
  /** Hint for this exact control; falls back to the positional role hint. */
  hint: string;
  /** Disabled or read-only controls cannot be filled or clicked. */
  isEnabled: boolean;
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

/** Inputs whose name/label may decide they hold a credential; a date or number field never does. */
const TEXT_LIKE_INPUT_TYPES = new Set(["text", "search", ""]);

function classifyControl(control: DiscoveredControl): FieldRole {
  const type = control.elementType.toLowerCase();
  const inputType = control.inputType?.toLowerCase();
  if (type === "select") return "select";
  if (type === "checkbox" || inputType === "checkbox") return "checkbox";
  if (type === "radio" || inputType === "radio") return "radio";
  // The browser's own type is authoritative; names and labels are only a guess.
  if (inputType === "password") return "password";
  if (inputType === "email") return "email";
  // A link never submits a form; a header "Log in" link must not become one.
  if (type === "a" || type === "link") return "button";
  if (type === "button") return matches(haystack(control), SUBMIT_HINTS) ? "submit" : "button";
  if (type === "input" && !TEXT_LIKE_INPUT_TYPES.has(inputType ?? "text")) return "text";
  if (type === "input" || type === "textarea" || type === "textbox") {
    const hay = haystack(control);
    if (matches(hay, PASSWORD_HINTS)) return "password";
    if (matches(hay, EMAIL_HINTS)) return "email";
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
    const positional = ordinal > 0 ? `role:${role}:${ordinal}` : `role:${role}`;
    out.push({
      role,
      ordinal,
      label: labelFor(control, `${role} ${ordinal + 1}`),
      inputType: control.inputType?.toLowerCase() ?? null,
      hint: elementHint(control) ?? positional,
      isEnabled: control.enabled !== false,
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
