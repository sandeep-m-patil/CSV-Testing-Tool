import type { CollectedElement, DetectedAction } from "@repo/browser";
import type { LocatorHints } from "@repo/browser";
import { isInScope, type ModuleScope } from "./scope";

export interface IndexedAction {
  index: number;
  operation: string;
  action: DetectedAction;
  element: CollectedElement | null;
  selector: LocatorHints;
  label: string;
}

export function actionKey(action: DetectedAction): string {
  return `${action.action}|${action.target.cssSelector ?? action.target.text ?? action.target.label ?? action.target.url ?? ""}`;
}

/**
 * Build the indexed action space for the current page:
 * each candidate (operation + observed element) gets a stable index,
 * plus locator-priority hints so the browser can execute the chosen one.
 */
export function buildActionSpace(elements: CollectedElement[], actions: DetectedAction[]): IndexedAction[] {
  const bySelector = new Map<string, CollectedElement>();
  for (const element of elements) {
    if (element.cssSelector) bySelector.set(element.cssSelector, element);
  }

  const space: IndexedAction[] = [];
  for (const action of actions) {
    const element = action.target.cssSelector ? bySelector.get(action.target.cssSelector) ?? null : null;
    space.push({
      index: space.length + 1,
      operation: action.action,
      action,
      element,
      selector: {
        testId: action.target.testId ?? element?.testId ?? null,
        role: action.target.role ?? element?.role ?? null,
        name: action.target.name ?? element?.name ?? null,
        label: action.target.label ?? element?.label ?? null,
        placeholder: action.target.placeholder ?? element?.placeholder ?? null,
        cssSelector: action.target.cssSelector ?? element?.cssSelector ?? null,
        xpath: element?.xpath ?? null,
      },
      label: actionLabel(action),
    });
  }
  return space;
}

function actionLabel(action: DetectedAction): string {
  const target =
    action.target.label ?? action.target.text ?? action.target.name ?? action.target.placeholder ?? action.target.url ?? action.target.elementType;
  return `${action.action}${target ? ` on "${target}"` : ""}`;
}

export interface ActorContext {
  baseUrl: string;
  scope: ModuleScope;
  moduleName: string;
  moduleKeywords: string[];
  roleUsername: string | null;
  rolePassword: string | null;
  testData: Array<Record<string, string>>;
  visitedUrls: Set<string>;
  executedKeys: Set<string>;
  skippedUrls: Set<string>;
  onLoginPage: boolean;
  fillCount: number;
  navigationDepth: number;
  navigationDepthBudget: number;
  /** Jev's login-screen verdict per URL, so each page costs at most one call. */
  loginChecks: Map<string, boolean>;
  /** Jev signs in at most once per role; after that the heuristics take over. */
  isJevLoginAttempted: boolean;
}

export type DecisionKind = "fill" | "submit-login" | "submit-form" | "navigate" | "click" | "review" | "none";

export interface ActorDecision {
  kind: DecisionKind;
  index: number | null;
  value?: string;
  reason: string;
}

const LOGIN_SUBMIT = /^(log in|login|sign in|signin|signin button)$/i;
const SUBMIT_TEXT = /^(save|submit|create|add|ok|confirm|update|continue|next|send|store|register)$/i;
const PASSWORD_HINT = /(pass|pwd|secret|otp)|type\s*=\s*"?password/i;
const USERNAME_HINT = /(user(name)?|email|login|username)/i;

export function decideOneAction(space: IndexedAction[], ctx: ActorContext): ActorDecision {
  const executable = space.filter(
    (item) => !item.action.blocked && !item.action.dangerous && !ctx.executedKeys.has(actionKey(item.action)),
  );

  if (executable.length === 0) return { kind: "none", index: null, reason: "no executable actions left on page" };

  // 1) Login sequence: username → password → submit
  if (ctx.onLoginPage && ctx.roleUsername && ctx.rolePassword) {
    const userNameField = findField(executable, "FILL", (label) => USERNAME_HINT.test(label) && !PASSWORD_HINT.test(label));
    const passwordField = findField(executable, "FILL", (label) => PASSWORD_HINT.test(label));
    if (userNameField && !ctx.executedKeys.has(actionKey(userNameField.action))) {
      return { kind: "fill", index: userNameField.index, value: ctx.roleUsername, reason: "login step 1: fill username" };
    }
    if (passwordField && !ctx.executedKeys.has(actionKey(passwordField.action))) {
      return { kind: "fill", index: passwordField.index, value: ctx.rolePassword, reason: "login step 2: fill password" };
    }
    const loginSubmit = findSubmit(executable, LOGIN_SUBMIT);
    if (loginSubmit) {
      return { kind: "submit-login", index: loginSubmit.index, reason: "login step 3: submit credentials" };
    }
  }

  // 2) Fill remaining empty form fields (data first, deterministic values after)
  const fillables = executable.filter((item) => item.operation === "FILL" && item.selector.role !== "checkbox");
  const unfilled = fillables.filter((item) => {
    const valueKey = `fill:${actionKey(item.action)}`;
    return !ctx.executedKeys.has(valueKey);
  });
  const nextFill = unfilled[0];

  if (nextFill) {
    const value = resolveFillValue(nextFill, ctx);
    return {
      kind: "fill",
      index: nextFill.index,
      value,
      reason: `fill form field "${nextFill.label}"`,
    };
  }

  // 3) Submit a fully-filled form (non-dangerous submit only)
  const submit = findSubmit(executable, SUBMIT_TEXT) ?? findSubmit(executable, /./); // fall back to any reviewed submit
  if (submit && !submit.action.dangerous && !submit.action.blocked) {
    return { kind: "submit-form", index: submit.index, reason: `submit form via "${submit.label}"` };
  }

  // 4) Navigate: highest-scoring unvisited in-page candidate (mimics the navigation queue)
  const navCandidates = space
    .filter(
      (item) =>
        item.operation === "NAVIGATE" &&
        !item.action.blocked &&
        item.action.target.url &&
        isInScope(ctx.scope, item.action.target.url) &&
        !ctx.visitedUrls.has(item.action.target.url) &&
        !ctx.executedKeys.has(actionKey(item.action)) &&
        ctx.navigationDepth < ctx.navigationDepthBudget,
    )
    .sort((a, b) => navScore(b) - navScore(a));

  if (navCandidates.length > 0 && navCandidates[0]) {
    return { kind: "navigate", index: navCandidates[0].index, reason: `navigate to "${navCandidates[0].label}"` };
  }

  // 5) Benign click (tab / menu / non-submit button) to surface modal content
  const clickable = executable.find((item) => item.operation === "CLICK");
  if (clickable) {
    return { kind: "click", index: clickable.index, reason: `click "${clickable.label}"` };
  }

  return { kind: "none", index: null, reason: "page exhausted" };
}

/**
 * True when the deterministic login sequence can find both credential fields.
 * When it cannot (non-English labels, phone-number logins, custom widgets),
 * discovery hands the login to Jev instead of filling the form with guesses.
 */
export function hasHeuristicLoginFields(space: IndexedAction[], ctx: ActorContext): boolean {
  if (!ctx.roleUsername) return false;
  const userNameField = findField(space, "FILL", (label) => USERNAME_HINT.test(label) && !PASSWORD_HINT.test(label));
  const passwordField = findField(space, "FILL", (label) => PASSWORD_HINT.test(label));
  return Boolean(userNameField && passwordField);
}

function navScore(item: IndexedAction): number {
  const label = (item.action.target.text ?? item.action.target.label ?? "").toLowerCase();
  const url = (item.action.target.url ?? "").toLowerCase();
  let score = 0;
  if (/(dashboard|home|menu|index|overview)/.test(label + url)) score += 3;
  if (/(create|add|new|list|browse|search)/.test(label)) score += 2;
  if (/(delete|remove|logout|signout)/.test(label)) score -= 8;
  return score;
}

function findField(items: IndexedAction[], operation: string, match: (label: string) => boolean): IndexedAction | undefined {
  return items.find(
    (item) =>
      item.operation === operation &&
      item.selector.role !== "checkbox" &&
      match(`${item.selector.label ?? ""} ${item.selector.name ?? ""} ${item.selector.placeholder ?? ""} ${item.element?.inputType ?? ""}`),
  );
}

function findSubmit(items: IndexedAction[], match: RegExp): IndexedAction | undefined {
  return items.find(
    (item) =>
      (item.operation === "SUBMIT" || item.operation === "CLICK") &&
      match.test(`${item.selector.label ?? ""} ${item.action.target.text ?? ""}`),
  );
}

function resolveFillValue(item: IndexedAction, ctx: ActorContext): string {
  const inputType = (item.element?.inputType ?? "").toLowerCase();
  const fieldText = `${item.selector.label ?? ""} ${item.selector.placeholder ?? ""} ${item.selector.name ?? ""}`.toLowerCase();

  if (inputType === "password") return ctx.rolePassword ?? "autotest-unknown";
  if (USERNAME_HINT.test(fieldText) && ctx.roleUsername) return ctx.roleUsername;

  for (const row of ctx.testData) {
    const fields = Object.keys(row);
    const exact = fields.find((key) => fieldText.includes(key.toLowerCase()) || key.toLowerCase().includes(fieldText));
    if (exact && row[exact]) return row[exact];
  }

  const seed = item.label.replace(/[^a-z0-9]+/gi, "_").slice(0, 24).toLowerCase() || "field";
  const tag = `${seed}_auto`;

  if (inputType === "email") return `${seed}@test.local`;
  if (inputType === "url") return `http://example.test/${seed}`;
  if (inputType === "number") return `${(ctx.fillCount % 9) + 1}${String((ctx.fillCount % 90) + 10)}`.slice(0, 2);
  if (inputType === "date") return "2026-12-01";
  if (inputType === "checkbox") return "true";
  if (inputType === "select") return "option";
  if (/(description|textarea)/.test(fieldText)) return `${ctx.moduleName} auto-generated test value ${tag}`;
  return tag;
}