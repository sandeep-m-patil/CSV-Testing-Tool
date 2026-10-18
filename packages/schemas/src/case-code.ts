/** Stable per-module test-case codes, e.g. "LOGIN-TC-024". */

const SLUG_LENGTH = 12;
const CODE_DIGITS = 3;
const FALLBACK_SLUG = "MOD";

export function moduleCodeSlug(moduleName: string): string {
  const slug = moduleName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, SLUG_LENGTH);
  return slug.length > 0 ? slug : FALLBACK_SLUG;
}

/** The next code after the highest one in use. Never reuses a number, so old results stay traceable. */
export function nextCaseCode(moduleName: string, existingCodes: ReadonlyArray<string | null>): string {
  const slug = moduleCodeSlug(moduleName);
  // `\\d` in a template literal: a single backslash would be dropped, matching a literal "d".
  const pattern = new RegExp(`^${slug}-TC-(\\d+)$`);
  const highest = existingCodes.reduce((max, code) => {
    const match = code ? pattern.exec(code) : null;
    return match ? Math.max(max, Number.parseInt(match[1]!, 10)) : max;
  }, 0);
  return `${slug}-TC-${String(highest + 1).padStart(CODE_DIGITS, "0")}`;
}
