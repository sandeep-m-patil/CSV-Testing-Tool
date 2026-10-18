import { ExpectationSchema, type Expectation } from "./executable-step";

/**
 * Text form of a VERIFY expectation:
 *   stayed_on_page                     navigated_away
 *   error_message_present              app_responsive
 *   text_present = Welcome back        url_contains = /dashboard
 *   element_visible text:Log out       text_contains label:Total = 42
 *   element_count text:Remove = 3      attribute:type role:password = password
 *   any_of(navigated_away; error_message_present)
 */

const PAGE_KINDS = ["navigated_away", "stayed_on_page"];
const BARE_KINDS = ["error_message_present", "app_responsive"];
const VALUE_KINDS = ["url_contains", "text_present", "url_equals", "title_equals", "title_contains"];
const TARGET_KINDS = ["element_visible", "element_hidden", "element_enabled", "element_disabled"];
const TARGET_VALUE_KINDS = ["text_equals", "text_contains", "value_equals"];
const ALIASES: Record<string, string> = { error_message: "error_message_present", responsive: "app_responsive" };
const ATTRIBUTE_PREFIX = "attribute:";
const VALUE_SEPARATOR = " = ";
const GROUP = /^(any_of|all_of)\((.*)\)$/s;

/** An expectation, or an error message. `lastPage` is the page a navigation check compares against. */
export function parseExpectation(text: string, lastPage: string): Expectation | string {
  const trimmed = text.trim();
  const group = GROUP.exec(trimmed);
  if (group) return parseGroup(group[1] as "any_of" | "all_of", group[2] ?? "", lastPage);
  const space = trimmed.indexOf(" ");
  const rawKind = (space < 0 ? trimmed : trimmed.slice(0, space)).toLowerCase();
  const kind = ALIASES[rawKind] ?? rawKind;
  const rest = space < 0 ? "" : trimmed.slice(space + 1).trim();
  if (!kind) return "VERIFY needs an expectation, e.g. \"VERIFY stayed_on_page\".";
  const built = buildExpectation(kind, rest, lastPage);
  if (typeof built === "string") return built;
  const checked = ExpectationSchema.safeParse(built);
  return checked.success ? checked.data : `Invalid "${kind}" expectation: ${checked.error.issues[0]?.message ?? "check its arguments"}`;
}

function parseGroup(kind: "any_of" | "all_of", body: string, lastPage: string): Expectation | string {
  const options: Expectation[] = [];
  for (const part of splitTopLevel(body)) {
    const option = parseExpectation(part, lastPage);
    if (typeof option === "string") return option;
    options.push(option);
  }
  return options.length > 0 ? { kind, options } : `${kind} needs at least one expectation.`;
}

function buildExpectation(kind: string, rest: string, lastPage: string): unknown {
  if (PAGE_KINDS.includes(kind)) return lastPage ? { kind, fromUrl: lastPage } : `${kind} needs a GOTO step before it.`;
  if (BARE_KINDS.includes(kind)) return { kind };
  if (VALUE_KINDS.includes(kind)) return { kind, value: rest.startsWith("= ") ? rest.slice(2) : rest };
  if (TARGET_KINDS.includes(kind)) return { kind, target: rest };
  const [target, value] = splitValue(rest);
  if (TARGET_VALUE_KINDS.includes(kind)) return value === undefined ? `${kind} needs "target = value".` : { kind, target, value };
  if (kind === "element_count") return { kind, target, equals: Number(value) };
  if (kind.startsWith(ATTRIBUTE_PREFIX)) {
    return value === undefined ? `${kind} needs "target = value".` : { kind: "input_attribute", target, attribute: kind.slice(ATTRIBUTE_PREFIX.length), equals: value };
  }
  return `Unknown expectation "${kind}".`;
}

export function formatExpectation(expect: Expectation): string {
  switch (expect.kind) {
    case "any_of":
    case "all_of":
      return `${expect.kind}(${expect.options.map(formatExpectation).join("; ")})`;
    case "navigated_away":
    case "stayed_on_page":
    case "error_message_present":
    case "app_responsive":
      return expect.kind;
    case "input_attribute":
      return `${ATTRIBUTE_PREFIX}${expect.attribute} ${expect.target}${VALUE_SEPARATOR}${expect.equals}`;
    case "element_count":
      return `${expect.kind} ${expect.target}${VALUE_SEPARATOR}${expect.equals}`;
    default:
      return formatArgs(expect);
  }
}

function formatArgs(expect: Expectation): string {
  const target = "target" in expect ? ` ${expect.target}` : "";
  const value = "value" in expect ? `${VALUE_SEPARATOR}${expect.value}` : "";
  return `${expect.kind}${target}${value}`;
}

function splitValue(text: string): [string, string | undefined] {
  const at = text.indexOf(VALUE_SEPARATOR);
  return at < 0 ? [text.trim(), undefined] : [text.slice(0, at).trim(), text.slice(at + VALUE_SEPARATOR.length)];
}

/** Splits on ";" that is not inside a nested group's parentheses. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of body) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === ";" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}
