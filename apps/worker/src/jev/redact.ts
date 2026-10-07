/**
 * Redaction for anything sent to Jev.
 *
 * Jev reads visible page text to decide, and after login that text can hold
 * customer data. Known secrets are replaced first, before truncation, so a
 * secret cut in half by the length cap can never leak as a prefix. Emails and
 * long digit runs (card, phone, account numbers) are withheld as data; the
 * words around them survive so Jev can still reason about the page.
 */

const REDACTED = "[redacted]";
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_NUMBER = /\d[\d\s-]{6,}\d/g;
/** Shorter values are not meaningful secrets and would shred ordinary words. */
const MIN_SECRET_LENGTH = 3;

export function scrubForJev(value: string, secrets: readonly string[], maxLength: number): string {
  let out = value;
  for (const secret of secrets) {
    if (secret.length >= MIN_SECRET_LENGTH) out = out.split(secret).join(REDACTED);
  }
  return out.replace(EMAIL, "[email]").replace(LONG_NUMBER, "[number]").slice(0, maxLength);
}
