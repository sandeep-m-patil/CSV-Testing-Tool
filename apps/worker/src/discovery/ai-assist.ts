import type { Page } from "playwright";
import type { AnalyzedPage } from "@repo/browser";
import { env } from "../env";
import { loginWithAgent } from "../browser-agent/login";
import { hasHeuristicLoginFields, type ActorContext, type IndexedAction } from "./action-space";
import type { DiscoveryContext } from "./runner";

/**
 * Where the browser agent (Playwright + the configured model) makes discovery
 * work on sites the heuristics were not written for. Each helper is a no-op
 * without a real model, so discovery behaves exactly as before on AI_PROVIDER=mock.
 */

const GUARDED_OPERATIONS = new Set(["SUBMIT", "CLICK"]);

export function hasPasswordField(analyzed: AnalyzedPage): boolean {
  return analyzed.snapshot.elements.some((element) => element.inputType === "password");
}

/**
 * The heuristic login check needs English words in the URL or title. On any
 * other site, a visible password field plus the model's verdict decides.
 * Cached per URL so a page costs at most one call.
 */
export async function confirmLoginWithAgent(ctx: DiscoveryContext, page: Page, actor: ActorContext): Promise<boolean> {
  if (!ctx.agent) return false;
  const url = page.url();
  const cached = actor.loginChecks.get(url);
  if (cached !== undefined) return cached;
  try {
    const isLogin = await ctx.agent.checkPage(page, "Is this a sign-in screen asking for account credentials?");
    actor.loginChecks.set(url, isLogin);
    return isLogin;
  } catch (error) {
    await ctx.store.log("warn", `AI login check failed: ${errorText(error)}`);
    actor.loginChecks.set(url, false);
    return false;
  }
}

export function shouldLoginWithAgent(ctx: DiscoveryContext, actor: ActorContext, space: IndexedAction[]): boolean {
  return Boolean(ctx.agent) && actor.onLoginPage && !actor.isAgentLoginAttempted && actor.rolePassword !== null
    && !hasHeuristicLoginFields(space, actor);
}

/** Signs in through the browser agent. Returns true when it reports the user is signed in. */
export async function attemptAgentLogin(ctx: DiscoveryContext, page: Page, actor: ActorContext): Promise<boolean> {
  actor.isAgentLoginAttempted = true;
  if (!ctx.agent || actor.rolePassword === null) return false;
  await ctx.store.log("event", `Login form not recognised by heuristics; the ${ctx.agent.label} is signing in.`);
  try {
    const result = await loginWithAgent(ctx.agent, page, { username: actor.roleUsername, password: actor.rolePassword });
    // History holds element labels and value *names* only, never the values.
    const summary = result.actions.length > 0 ? `: ${result.actions.join("; ")}` : "";
    await ctx.store.log(result.status === "done" ? "event" : "warn", `AI login ${result.status}${summary}${result.reason ? ` (${result.reason})` : ""}`);
    return result.status === "done";
  } catch (error) {
    await ctx.store.log("warn", `AI login failed: ${errorText(error)}`);
    return false;
  }
}

/**
 * Asks the model before a submit-like click whether it would place an order,
 * pay, send, delete, approve or publish. Fails open to the existing behaviour
 * (the static `dangerous` filter still applies) so an AI outage never stalls
 * discovery.
 */
export async function isIrreversibleByAgent(
  ctx: DiscoveryContext,
  page: Page,
  step: { chosen: IndexedAction; actor: ActorContext },
): Promise<boolean> {
  if (!ctx.agent || !env.AGENT_GUARD_IRREVERSIBLE || step.actor.onLoginPage) return false;
  if (!GUARDED_OPERATIONS.has(step.chosen.operation)) return false;
  try {
    if (!(await ctx.agent.isIrreversible(page, step.chosen.label))) return false;
    await ctx.store.log("warn", `Skipped ${step.chosen.label}: the AI judged it irreversible (order, payment, message, delete, approve or publish).`);
    return true;
  } catch (error) {
    await ctx.store.log("warn", `AI irreversibility check failed: ${errorText(error)}`);
    return false;
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
