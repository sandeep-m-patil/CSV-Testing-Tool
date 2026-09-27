/** Canonical inputs reused across generated scenarios so CSV rows stay consistent. */

export const VALID_EMAIL = "demo@autotest.dev";
export const VALID_PASSWORD = "demo1234";
export const UNREGISTERED_EMAIL = "nobody@nowhere.invalid";
export const INVALID_EMAIL = "not-an-email";
export const MISSING_USERNAME_EMAIL = "@gmail.com";
export const MISSING_DOMAIN_EMAIL = "user@";
export const SPACED_EMAIL = "  demo@autotest.dev  ";
export const WRONG_PASSWORD = "Wr0ngPass!999";
export const MIN_LENGTH_PASSWORD = "abc12345";
export const SHORT_PASSWORD = "a1";
export const SPACED_PASSWORD = " pass1234 ";
export const SQL_PAYLOAD = "' OR '1'='1";
export const XSS_PAYLOAD = "<script>alert(1)</script>";
export const LONG_INPUT_LENGTH = 500;

export const EMAIL_HINTS = ["email", "e-mail", "mail", "username", "user name", "userid", "login id"];
export const PASSWORD_HINTS = ["password", "passwd", "pwd", "pass word", "secret", "passphrase"];

export const SUBMIT_HINTS = ["submit", "sign in", "log in", "login", "continue", "next", "save", "send"];

export const ERROR_SELECTORS = [
  '[role="alert"]',
  ".error",
  ".error-message",
  ".alert-error",
  ".alert-danger",
  ".invalid-feedback",
  ".form-error",
  ".field-error",
  "[aria-invalid='true']",
  "output:empty",
].join(", ");

export const ERROR_TEXT_PATTERN =
  /invalid|required|incorrect|failed|does not exist|not found|try again|denied|unauthorized|too short|must be|enter a|enter your|credentials/i;

export const CRASH_TEXT_PATTERN =
  /application error|something went wrong|internal server error|cannot read propert|uncaught|fatal error/i;

export function longInput(): string {
  return "a".repeat(LONG_INPUT_LENGTH);
}

export function truncated(value: string, length: number): string {
  return value.slice(0, length);
}
