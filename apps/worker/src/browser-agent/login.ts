import type { Page } from "playwright";
import type { PageAgent } from "./agent";
import { runGoal, type GoalResult } from "./goal";

/**
 * Signs in on a login form the heuristics do not recognise: non-English
 * labels, phone-number logins, "email first, then password" flows, custom
 * widgets. A goal run whose values are the credential, offered by name only.
 */

export interface LoginCredential {
  username: string | null;
  password: string;
}

const LOGIN_GOAL = "Sign in with the given account so that the signed-in area of the application is shown.";
const LOGIN_MAX_STEPS = 8;

export function loginWithAgent(agent: PageAgent, page: Page, credential: LoginCredential): Promise<GoalResult> {
  const values: Record<string, string> = { password: credential.password };
  const valueDescriptions: Record<string, string> = { password: "the account password" };
  if (credential.username) {
    values.username = credential.username;
    valueDescriptions.username = "the account username, email address or login id";
  }
  return runGoal(agent, page, { goal: LOGIN_GOAL, values, valueDescriptions, maxSteps: LOGIN_MAX_STEPS });
}
