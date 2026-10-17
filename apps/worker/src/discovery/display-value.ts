/**
 * The form of a typed value that may appear in discovery logs and evidence
 * captions. Credentials never do: a value typed into a password field, or one
 * matching any stored username or password, is shown as a mask.
 */

const MASK = "••••••";
const MIN_SECRET_LENGTH = 3;

export function displayFillValue(value: string, input: { inputType?: string | null; secrets: readonly string[] }): string {
  if ((input.inputType ?? "").toLowerCase() === "password") return MASK;
  const isSecret = input.secrets.some((secret) => secret.length >= MIN_SECRET_LENGTH && value.includes(secret));
  return isSecret ? MASK : value;
}
