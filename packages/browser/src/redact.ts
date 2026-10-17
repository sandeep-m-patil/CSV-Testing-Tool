import type { Frame, Page } from "playwright";
import { ensureRuntimeHelpers } from "./element-collector";

const MASK_STYLE_ID = "autotest-mask-style";

/**
 * Masks sensitive input values (passwords, tokens, API keys) in the DOM before
 * any screenshot / trace capture, so evidence never contains secrets.
 *
 * Covers every frame and every open shadow root: discovery fills fields in
 * both, and a page stylesheet does not reach into a shadow root or an iframe,
 * so masking only the top document would leave a typed secret on screen.
 */
export async function maskSensitiveInputs(page: Page, secrets: string[] = []): Promise<void> {
  const filteredSecrets = secrets.filter((secret) => typeof secret === "string" && secret.length >= 3);
  await Promise.all(page.frames().map((frame) => maskFrame(frame, filteredSecrets)));
}

export async function unmaskSensitiveInputs(page: Page): Promise<void> {
  await Promise.all(page.frames().map((frame) => unmaskFrame(frame)));
}

async function maskFrame(frame: Frame, secrets: string[]): Promise<void> {
  // The nested helpers in maskDocument are wrapped in esbuild's `__name` under
  // tsx; a missing helper would throw inside the swallowed catch and leave
  // secrets visible.
  await ensureRuntimeHelpers(frame).catch(() => undefined);
  await frame.evaluate(maskDocument, { secrets, styleId: MASK_STYLE_ID }).catch(() => {
    // best effort — the frame may have navigated or detached
  });
}

/** Runs in the page: must stay self-contained. */
function maskDocument({ secrets: values, styleId }: { secrets: string[]; styleId: string }): void {
  const maskCss = `
    input[type="password"],
    input[autocomplete="current-password"],
    input[autocomplete="new-password"],
    [data-protected="true"] {
      -webkit-text-security: disc !important;
      text-security: disc !important;
    }
  `;
  const sensitiveName = /(pass|pwd|secret|token|api[-_]?key|otp|ssn)/i;

  const maskRoot = (root: Document | ShadowRoot): void => {
    if (!root.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = maskCss;
      (root instanceof Document ? root.head ?? root.documentElement : root).appendChild(style);
    }
    for (const input of Array.from(root.querySelectorAll<HTMLInputElement>("input, textarea"))) {
      const meta = `${input.name} ${input.id} ${input.getAttribute("aria-label") ?? ""} ${input.placeholder}`;
      const isSecretValue = input.value !== "" && values.some((secret) => secret === input.value);
      if (input.type === "password" || sensitiveName.test(meta) || isSecretValue) {
        input.setAttribute("data-protected", "true");
      }
    }
    for (const node of Array.from(root.querySelectorAll("*"))) {
      if (node.shadowRoot) maskRoot(node.shadowRoot);
    }
  };
  maskRoot(document);
}

async function unmaskFrame(frame: Frame): Promise<void> {
  await ensureRuntimeHelpers(frame).catch(() => undefined);
  await frame
    .evaluate((styleId) => {
      const unmaskRoot = (root: Document | ShadowRoot): void => {
        root.getElementById(styleId)?.remove();
        for (const input of Array.from(root.querySelectorAll("[data-protected]"))) {
          input.removeAttribute("data-protected");
        }
        for (const node of Array.from(root.querySelectorAll("*"))) {
          if (node.shadowRoot) unmaskRoot(node.shadowRoot);
        }
      };
      unmaskRoot(document);
    }, MASK_STYLE_ID)
    .catch(() => {
      // ignore
    });
}
