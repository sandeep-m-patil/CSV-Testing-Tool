import type { ScenarioBuilder } from "./scenario-builder";
import type { ClassifiedField } from "./fields";

/**
 * Valid sample input per field type. Typing "Test Value 1" into a date, number
 * or email field makes the browser (or the app) reject the form for the wrong
 * reason, so a "submits with valid data" case would fail on every real site.
 */

const VALUE_BY_INPUT_TYPE: Record<string, string> = {
  email: "autotest@example.com",
  password: "AutoTest#2026",
  number: "5",
  range: "5",
  tel: "5550100123",
  url: "https://example.com",
  date: "2026-12-01",
  "datetime-local": "2026-12-01T10:00",
  time: "10:00",
  month: "2026-12",
  week: "2026-W49",
  color: "#336699",
};

/** Input types a free-text payload (long text, SQL, script) can be typed into. */
const FREE_TEXT_TYPES = new Set(["text", "search", "textarea"]);
/** Never filled by generated cases: no file to attach, nothing to type. */
const SKIPPED_TYPES = new Set(["file", "hidden", "image", "reset", "submit", "button"]);

export function validValueFor(field: ClassifiedField, index: number): string {
  if (field.role === "email") return VALUE_BY_INPUT_TYPE.email!;
  if (field.role === "password") return VALUE_BY_INPUT_TYPE.password!;
  const byType = field.inputType ? VALUE_BY_INPUT_TYPE[field.inputType] : undefined;
  return byType ?? `Test Value ${index + 1}`;
}

export function isFillable(field: ClassifiedField): boolean {
  if (!field.isEnabled) return false;
  if (field.inputType && SKIPPED_TYPES.has(field.inputType)) return false;
  return ["text", "email", "password", "select", "checkbox", "radio"].includes(field.role);
}

/** True for a field that accepts arbitrary text, so payload cases mean something. */
export function isFreeText(field: ClassifiedField): boolean {
  return field.role === "text" && FREE_TEXT_TYPES.has(field.inputType ?? "text");
}

/** Types a value into a field the way its control expects (select, tick, or type). */
export function applyValue(builder: ScenarioBuilder, field: ClassifiedField, value: string): ScenarioBuilder {
  if (field.role === "select") return builder.select(field.hint, value);
  if (field.role === "checkbox" || field.role === "radio") return value === "" ? builder : builder.check(field.hint);
  return builder.fill(field.hint, value);
}

/** Fills every field with valid data, except `override` which gets its own value. */
export function fillAll(
  builder: ScenarioBuilder,
  fields: ClassifiedField[],
  override?: { field: ClassifiedField; value: string },
): ScenarioBuilder {
  fields.forEach((field, index) => {
    const value = override?.field === field ? override.value : validValueFor(field, index);
    // A select left at "" picks its first real option at run time.
    applyValue(builder, field, field.role === "select" && override?.field !== field ? "" : value);
  });
  return builder;
}
