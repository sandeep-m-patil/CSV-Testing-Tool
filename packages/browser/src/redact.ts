import type { Page } from "playwright";

const MASK_STYLE_ID = "autotest-mask-style";

/**
 * Masks sensitive input values (passwords, tokens, API keys) in the DOM before
 * any screenshot / trace capture, so evidence never contains secrets.
 */
export async function maskSensitiveInputs(page: Page, secrets: string[] = []): Promise<void> {
  const filteredSecrets = secrets.filter((secret) => typeof secret === "string" && secret.length >= 3);

  await page
    .evaluate(
      ({ secrets: values, styleId }) => {
        if (!document.getElementById(styleId)) {
          const style = document.createElement("style");
          style.id = styleId;
          style.textContent = `
            input[type="password"],
            input[autocomplete="current-password"],
            input[autocomplete="new-password"],
            [data-protected="true"] {
              -webkit-text-security: disc !important;
              text-security: disc !important;
            }
          `;
          document.head.appendChild(style);
        }

        const sensitiveName = /(pass|pwd|secret|token|api[-_]?key|otp|ssn)/i;
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input, textarea"));
        for (const input of inputs) {
          const meta = `${input.name} ${input.id} ${input.getAttribute("aria-label") ?? ""} ${input.placeholder}`;
          if (input.type === "password" || sensitiveName.test(meta)) {
            input.setAttribute("data-protected", "true");
          }
          const current = input.value;
          if (current && values.some((secret) => secret === current)) {
            input.setAttribute("data-protected", "true");
          }
        }
      },
      { secrets: filteredSecrets, styleId: MASK_STYLE_ID },
    )
    .catch(() => {
      // best effort — page may have navigated away
    });
}

export async function unmaskSensitiveInputs(page: Page): Promise<void> {
  await page
    .evaluate((styleId) => {
      document.getElementById(styleId)?.remove();
      for (const input of Array.from(document.querySelectorAll<HTMLInputElement>("[data-protected]"))) {
        input.removeAttribute("data-protected");
      }
    }, MASK_STYLE_ID)
    .catch(() => {
      // ignore
    });
}