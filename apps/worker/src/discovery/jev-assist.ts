import type { Page } from "playwright";
import type { AnalyzedPage } from "@repo/browser";
import { env } from "../env";
import { loginWithJev } from "../jev/login";
import { hasHeuristicLoginFields, type ActorContext, type IndexedAction } from "./action-space";
import type { DiscoveryContext } from "./runner";

/**
 * Where Jev makes discovery work on sites the heuristics were not written for.
 * Each helper is a no-op without a configured agent, so discovery behaves
 * exactly as before when `TYPESAFE_API_KEY` is unset.
 */

const LOGIN_SCREEN_AT = 0.7;
const IRREVERSIBLE_AT = 0.6;
const GUARDED_OPERATIONS = new Set(["SUBMIT", "CLICK"]);

export function hasPasswordField(analyzed: AnalyzedPage): boolean {
  return analyzed.snapshot.elements.some((element) => element.inputType === "password");
}

/**
 * The heuristic login check needs English words in the URL or title. On any
 * other site, a visible password field plus Jev's verdict decides. Cached per
 * URL so a page costs at most one call.
 */
export async function confirmLoginWithJev(ctx: DiscoveryContext, page: Page, actor: ActorContext): Promise<boolean> {
  if (!ctx.jev) return false;
  const url = page.url();
  const cached = actor.loginChecks.get(url);
  if (cached !== undefined) return cached;
  try {
    const probability = await ctx.jev.checkPage(page, "Is this a sign-in screen asking for account credentials?");
    const isLogin = probability >= LOGIN_SCREEN_AT;
    actor.loginChecks.set(url, isLogin);
    return isLogin;
  } catch (error) {
    await ctx.store.log("warn", `Jev login check failed: ${errorText(error)}`);
    actor.loginChecks.set(url, false);
    return false;
  }
}

export function shouldLoginWithJev(ctx: DiscoveryContext, actor: ActorContext, space: IndexedAction[]): boolean {
  return Boolean(ctx.jev) && actor.onLoginPage && !actor.isJevLoginAttempted && actor.rolePassword !== null
    && !hasHeuristicLoginFields(space, actor);
}

/** Signs in through Jev. Returns true when Jev reports the user is signed in. */
export async function attemptJevLogin(ctx: DiscoveryContext, page: Page, actor: ActorContext): Promise<boolean> {
  actor.isJevLoginAttempted = true;
  if (!ctx.jev || actor.rolePassword === null) return false;
  await ctx.store.log("event", `Login form not recognised by heuristics; ${ctx.jev.label} is signing in.`);
  try {
    const result = await loginWithJev(ctx.jev, page, { username: actor.roleUsername, password: actor.rolePassword });
    // History holds element labels and value *names* only, never the values.
    const summary = result.actions.length > 0 ? `: ${result.actions.join("; ")}` : "";
    await ctx.store.log(result.status === "done" ? "event" : "warn", `Jev login ${result.status}${summary}`);
    return result.status === "done";
  } catch (error) {
    await ctx.store.log("warn", `Jev login failed: ${errorText(error)}`);
    return false;
  }
}

/**
 * Asks Jev before a submit-like click whether it would place an order, pay,
 * send, delete or publish. Fails open to the existing behaviour (the static
 * `dangerous` filter still applies) so a Jev outage never stalls discovery.
 */
export async function isIrreversibleByJev(
  ctx: DiscoveryContext,
  page: Page,
  step: { chosen: IndexedAction; actor: ActorContext },
): Promise<boolean> {
  if (!ctx.jev || !env.JEV_GUARD_IRREVERSIBLE || step.actor.onLoginPage) return false;
  if (!GUARDED_OPERATIONS.has(step.chosen.operation)) return false;
  try {
    const probability = await ctx.jev.irreversibility(page, step.chosen.label);
    if (probability < IRREVERSIBLE_AT) return false;
    await ctx.store.log("warn", `Skipped ${step.chosen.label}: Jev judged it irreversible (p=${probability.toFixed(2)}).`);
    return true;
  } catch (error) {
    await ctx.store.log("warn", `Jev irreversibility check failed: ${errorText(error)}`);
    return false;
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
