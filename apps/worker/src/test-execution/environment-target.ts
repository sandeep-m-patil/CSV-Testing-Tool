import type { ExecutableStep, Expectation } from "./types";

/**
 * Points a case recorded against one deployment at another. Only URLs on the
 * recorded origin move; links to third-party sites stay as written. A path
 * prefix on either base (e.g. `/app`) is carried across.
 */
export function rebaseUrl(url: string, fromBase: string, toBase: string): string {
  try {
    const source = new URL(url);
    const from = new URL(fromBase);
    if (source.origin !== from.origin) return url;
    const to = new URL(toBase);
    const fromPrefix = from.pathname.replace(/\/+$/, "");
    const toPrefix = to.pathname.replace(/\/+$/, "");
    const relative = fromPrefix && source.pathname.startsWith(fromPrefix) ? source.pathname.slice(fromPrefix.length) || "/" : source.pathname;
    return `${to.origin}${toPrefix}${relative}${source.search}${source.hash}`;
  } catch {
    return url;
  }
}

function rebaseExpectation(expect: Expectation, from: string, to: string): Expectation {
  switch (expect.kind) {
    case "navigated_away":
    case "stayed_on_page":
      return { ...expect, fromUrl: rebaseUrl(expect.fromUrl, from, to) };
    case "url_equals":
      return { ...expect, value: rebaseUrl(expect.value, from, to) };
    case "any_of":
    case "all_of":
      return { ...expect, options: expect.options.map((option) => rebaseExpectation(option, from, to)) };
    default:
      return expect;
  }
}

/** Rewrites navigation targets and URL expectations; a no-op when both bases match. */
export function rebaseSteps(steps: ExecutableStep[], fromBase: string, toBase: string | null): ExecutableStep[] {
  if (!toBase || toBase === fromBase) return steps;
  return steps.map((step) => ({
    ...step,
    target: step.action === "GOTO" || step.action === "VERIFY" ? rebaseUrl(step.target, fromBase, toBase) : step.target,
    ...(step.expect ? { expect: rebaseExpectation(step.expect, fromBase, toBase) } : {}),
  }));
}
