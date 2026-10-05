import { AiPageContextSchema, type AiPageContext } from "@repo/schemas";

/**
 * Attribute values that must never reach an AI provider. Requirement 12.8:
 * "AI never receives secrets". An element's `name`, `text` or `placeholder` can
 * legitimately mirror whatever the user typed into it, so the page snapshot is
 * scrubbed before it leaves the process.
 */
/**
 * Keywords that mark an attribute as credential-bearing. Matched against a
 * normalized copy of the value rather than the raw string, because real
 * identifiers are usually joined: `user_password`, `authToken`, `x-api-key`.
 * A raw `\b` boundary would miss every one of those, since `_` is a word
 * character in JavaScript regexes.
 */
const SECRET_KEYWORDS = [
  "pass",
  "password",
  "passwd",
  "passphrase",
  "passcode",
  "pwd",
  "secret",
  "token",
  "apikey",
  "auth",
  "credential",
  "session",
  "cookie",
  "bearer",
  "signature",
];

const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const SSN_LIKE = /\d{3}-\d{2}-\d{4}/;
const MAX_FIELD_LENGTH = 200;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isSecretLike(value: string): boolean {
  if (EMAIL_LIKE.test(value) || SSN_LIKE.test(value)) return true;
  const words = normalize(value).split(" ");
  return words.some((word) => SECRET_KEYWORDS.includes(word));
}

function scrub(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.slice(0, MAX_FIELD_LENGTH);
  return isSecretLike(trimmed) ? "[redacted]" : trimmed;
}

/**
 * Returns a copy of the page context with credential-shaped values replaced.
 * Structure, roles and element types are preserved so the model can still
 * reason about the page; only the values are withheld.
 */
export function sanitizePageContext(context: AiPageContext): AiPageContext {
  const parsed = AiPageContextSchema.parse(context);
  return {
    url: parsed.url,
    title: scrub(parsed.title) ?? "",
    ...(parsed.pageType ? { pageType: parsed.pageType } : {}),
    elements: parsed.elements.map((element) => ({
      ...element,
      label: scrub(element.label),
      name: scrub(element.name),
      placeholder: scrub(element.placeholder),
      text: scrub(element.text),
    })),
  };
}