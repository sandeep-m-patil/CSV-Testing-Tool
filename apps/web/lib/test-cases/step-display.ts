/**
 * Steps store `{{username}}` / `{{password}}` instead of the real credential, so
 * no plaintext secret is persisted, returned by the API or exported to CSV. The
 * UI must not surface those raw tokens either: a reader needs to see what will
 * be typed, without the value ever being a secret in the DOM.
 */
const USERNAME_TOKEN = "{{username}}";
const PASSWORD_TOKEN = "{{password}}";

export const CREDENTIAL_USERNAME_LABEL = "username from Credentials & Data";
export const CREDENTIAL_PASSWORD_LABEL = "••••••••";

/** Renders a step value for display, resolving credential tokens to a label. */
export function formatStepValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (!value.includes(USERNAME_TOKEN) && !value.includes(PASSWORD_TOKEN)) return value;
  return value
    .split(USERNAME_TOKEN)
    .join(CREDENTIAL_USERNAME_LABEL)
    .split(PASSWORD_TOKEN)
    .join(CREDENTIAL_PASSWORD_LABEL);
}
