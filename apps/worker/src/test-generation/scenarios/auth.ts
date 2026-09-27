import type { Expectation, GeneratedCase } from "../../test-execution/types";
import { ScenarioBuilder } from "../scenario-builder";
import {
  INVALID_EMAIL,
  MIN_LENGTH_PASSWORD,
  MISSING_DOMAIN_EMAIL,
  MISSING_USERNAME_EMAIL,
  SHORT_PASSWORD,
  SPACED_EMAIL,
  SPACED_PASSWORD,
  SQL_PAYLOAD,
  UNREGISTERED_EMAIL,
  VALID_EMAIL,
  VALID_PASSWORD,
  WRONG_PASSWORD,
  XSS_PAYLOAD,
  longInput,
  truncated,
} from "../scenario-data";

export const EMAIL_HINT = "role:email";
export const PASSWORD_HINT = "role:password";
export const SUBMIT_HINT = "role:submit";

type Fill = "valid" | "invalid" | "empty" | "unregistered" | "noUsername" | "noDomain" | "spaced" | "short" | "sql" | "xss" | "long" | "upper";
type Submit = "submit" | "enter" | "none";

interface AuthSpec {
  name: string;
  type: string;
  priority: string;
  testData: string;
  expected: string;
  email: Fill;
  password: Fill;
  submit: Submit;
  expect: Expectation | "manual";
  maskingOnly?: boolean;
}

const EMAIL_VALUES: Record<Fill, string> = {
  valid: VALID_EMAIL,
  invalid: INVALID_EMAIL,
  empty: "",
  unregistered: UNREGISTERED_EMAIL,
  noUsername: MISSING_USERNAME_EMAIL,
  noDomain: MISSING_DOMAIN_EMAIL,
  spaced: SPACED_EMAIL,
  short: SHORT_PASSWORD,
  sql: SQL_PAYLOAD,
  xss: XSS_PAYLOAD,
  long: longInput(),
  upper: VALID_EMAIL.toUpperCase(),
};

const PASSWORD_VALUES: Record<Fill, string> = {
  valid: VALID_PASSWORD,
  invalid: WRONG_PASSWORD,
  empty: "",
  unregistered: WRONG_PASSWORD,
  noUsername: WRONG_PASSWORD,
  noDomain: WRONG_PASSWORD,
  spaced: SPACED_PASSWORD,
  short: SHORT_PASSWORD,
  sql: SQL_PAYLOAD,
  xss: XSS_PAYLOAD,
  long: longInput(),
  upper: WRONG_PASSWORD,
};

/** Mirrors a conventional manual login test matrix (happy path, negative, boundary, security, UI). */
const AUTH_SPECS: AuthSpec[] = [
  { name: "Login with valid credentials", type: "HAPPY_PATH", priority: "HIGH", testData: "valid email + valid password", expected: "User logs in successfully and is taken away from the login page", email: "valid", password: "valid", submit: "submit", expect: { kind: "navigated_away", fromUrl: "" } },
  { name: "Invalid email with valid password", type: "NEGATIVE", priority: "HIGH", testData: "malformed email + valid password", expected: "Login fails with a validation or error message", email: "invalid", password: "valid", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Valid email with invalid password", type: "NEGATIVE", priority: "HIGH", testData: "valid email + wrong password", expected: "Login fails with an error message", email: "valid", password: "invalid", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Invalid email and invalid password", type: "NEGATIVE", priority: "MEDIUM", testData: "malformed email + wrong password", expected: "Login fails", email: "invalid", password: "invalid", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Unregistered email", type: "NEGATIVE", priority: "HIGH", testData: "email not in system + valid password", expected: "Login fails and does not reveal whether the account exists", email: "unregistered", password: "valid", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Email field empty", type: "VALIDATION", priority: "HIGH", testData: "blank email + valid password", expected: "Email validation message displayed", email: "empty", password: "valid", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Password field empty", type: "VALIDATION", priority: "HIGH", testData: "valid email + blank password", expected: "Password validation message displayed", email: "valid", password: "empty", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Both fields empty", type: "VALIDATION", priority: "HIGH", testData: "blank email + blank password", expected: "Required-field messages displayed", email: "empty", password: "empty", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Email with invalid format", type: "VALIDATION", priority: "MEDIUM", testData: "abc.com + valid password", expected: "Invalid email format message displayed", email: "invalid", password: "valid", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Email without username", type: "VALIDATION", priority: "MEDIUM", testData: "@gmail.com + valid password", expected: "Email validation displayed", email: "noUsername", password: "valid", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Email without domain", type: "VALIDATION", priority: "MEDIUM", testData: "user@ + valid password", expected: "Email validation displayed", email: "noDomain", password: "valid", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Email with leading and trailing spaces", type: "BOUNDARY", priority: "MEDIUM", testData: "\"  demo@autotest.dev  \" + valid password", expected: "Spaces are trimmed or rejected per the documented requirement", email: "spaced", password: "valid", submit: "submit", expect: "manual" },
  { name: "Password containing spaces", type: "BOUNDARY", priority: "MEDIUM", testData: "valid email + \" pass1234 \"", expected: "Accepted or rejected per the documented password rules", email: "valid", password: "spaced", submit: "submit", expect: "manual" },
  { name: "Valid password at minimum length", type: "BOUNDARY", priority: "MEDIUM", testData: `valid email + 8-character password (${MIN_LENGTH_PASSWORD})`, expected: "Login succeeds if the minimum length is accepted, otherwise a clear validation message", email: "valid", password: "valid", submit: "submit", expect: { kind: "any_of", options: [{ kind: "navigated_away", fromUrl: "" }, { kind: "error_message_present" }] } },
  { name: "Password below minimum length", type: "VALIDATION", priority: "MEDIUM", testData: `valid email + 2-character password (${SHORT_PASSWORD})`, expected: "Password validation message displayed", email: "valid", password: "short", submit: "submit", expect: { kind: "stayed_on_page", fromUrl: "" } },
  { name: "Password field is masked", type: "HAPPY_PATH", priority: "HIGH", testData: "enter a password and inspect the field", expected: "Password characters are masked (input type is password)", email: "valid", password: "valid", submit: "none", maskingOnly: true, expect: { kind: "input_attribute", target: PASSWORD_HINT, attribute: "type", equals: "password" } },
  { name: "Show and hide password toggle", type: "HAPPY_PATH", priority: "LOW", testData: "click the password visibility control twice", expected: "Password visibility toggles and returns to masked", email: "valid", password: "valid", submit: "none", expect: "manual" },
  { name: "Email case sensitivity", type: "NEGATIVE", priority: "MEDIUM", testData: "UPPERCASED email + valid password", expected: "Behaviour matches authentication rules; the form responds either way", email: "upper", password: "valid", submit: "submit", expect: { kind: "any_of", options: [{ kind: "navigated_away", fromUrl: "" }, { kind: "error_message_present" }] } },
  { name: "Press Enter to submit", type: "HAPPY_PATH", priority: "MEDIUM", testData: "fill both fields then press Enter", expected: "Login is submitted; the form responds", email: "valid", password: "valid", submit: "enter", expect: { kind: "any_of", options: [{ kind: "navigated_away", fromUrl: "" }, { kind: "error_message_present" }] } },
  { name: "SQL injection in email field", type: "AUTHORIZATION", priority: "CRITICAL", testData: "' OR '1'='1 + valid password", expected: "Login rejected and the application remains secure and responsive", email: "sql", password: "valid", submit: "submit", expect: { kind: "any_of", options: [{ kind: "stayed_on_page", fromUrl: "" }, { kind: "error_message_present" }] } },
  { name: "SQL injection in password field", type: "AUTHORIZATION", priority: "CRITICAL", testData: "valid email + ' OR '1'='1", expected: "Login rejected and the application remains secure and responsive", email: "valid", password: "sql", submit: "submit", expect: { kind: "any_of", options: [{ kind: "stayed_on_page", fromUrl: "" }, { kind: "error_message_present" }] } },
  { name: "Script injection in email field", type: "AUTHORIZATION", priority: "CRITICAL", testData: "<script>alert(1)</script> + valid password", expected: "Input is not executed as script and does not authenticate; the application stays responsive", email: "xss", password: "valid", submit: "submit", expect: { kind: "any_of", options: [{ kind: "stayed_on_page", fromUrl: "" }, { kind: "error_message_present" }] } },
  { name: "Excessively long input", type: "BOUNDARY", priority: "MEDIUM", testData: `500-character email and password`, expected: "Application handles the input without crashing", email: "long", password: "long", submit: "submit", expect: { kind: "app_responsive" } },
];

function materialise(pageUrl: string, spec: AuthSpec): GeneratedCase {
  const builder = new ScenarioBuilder(pageUrl);

  if (!spec.maskingOnly) {
    builder.fill(EMAIL_HINT, EMAIL_VALUES[spec.email]);
    builder.fill(PASSWORD_HINT, PASSWORD_VALUES[spec.password]);
    if (spec.submit === "submit") builder.submit(SUBMIT_HINT);
    if (spec.submit === "enter") builder.press(PASSWORD_HINT, "Enter");
  }

  const isManual = spec.expect === "manual";
  if (spec.expect !== "manual") {
    builder.verify(resolveExpectation(spec.expect, pageUrl));
  }

  return builder.build({
    name: spec.name,
    type: spec.type,
    priority: spec.priority,
    testData: spec.testData,
    expectedResult: spec.expected,
    isManual,
  });
}

/** Fills in the real page URL that the executor must compare navigation against. */
function resolveExpectation(expect: Expectation, pageUrl: string): Expectation {
  if (expect.kind === "navigated_away" || expect.kind === "stayed_on_page") {
    return { ...expect, fromUrl: pageUrl };
  }
  if (expect.kind === "any_of") {
    const options: Expectation[] = expect.options.map((option: Expectation) => resolveExpectation(option, pageUrl));
    return { kind: "any_of", options };
  }
  return expect;
}

export function buildAuthScenarios(pageUrl: string): GeneratedCase[] {
  return AUTH_SPECS.map((spec) => materialise(pageUrl, spec));
}

export { truncated };
