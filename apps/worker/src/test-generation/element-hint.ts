import { FRAME_BOUNDARY } from "@repo/browser";
import type { DiscoveredControl } from "./fields";

/**
 * Locator hint for one specific discovered control, so a generated step acts on
 * the element discovery saw rather than "the Nth text box" on the page. The
 * positional `role:<role>:<n>` hint is computed over a different set of
 * elements at run time than at generation time, so it drifts on any page that
 * mixes field types or has a second form (search bar, newsletter signup).
 *
 * Preference: test id → stable id → name attribute → label/placeholder →
 * button caption. Null when the control carries none of these. A control
 * inside an iframe keeps its full framed selector: label, name and caption
 * lookups only search the top document.
 */

const MAX_CAPTION_LENGTH = 60;
/** Framework-generated ids (`:r1:`, `mui-123`, `ember456`) change between renders. */
const UNSTABLE_ID = /\\|\d{3,}|^#(mui|ember|ext-gen|react|radix|headlessui)/i;
const FIELD_TAGS: Record<string, string> = {
  input: "input",
  checkbox: "input",
  radio: "input",
  textarea: "textarea",
  select: "select",
};

export function elementHint(control: DiscoveredControl): string | null {
  if (control.cssSelector?.includes(FRAME_BOUNDARY)) return `selector:${control.cssSelector}`;
  return testIdHint(control) ?? idHint(control) ?? nameHint(control) ?? captionHint(control);
}

function testIdHint(control: DiscoveredControl): string | null {
  const selector = control.cssSelector ?? "";
  return selector.startsWith("[data-") ? `selector:${selector}` : null;
}

function idHint(control: DiscoveredControl): string | null {
  const selector = control.cssSelector ?? "";
  const isPlainId = /^#[A-Za-z][\w-]*$/.test(selector);
  return isPlainId && !UNSTABLE_ID.test(selector) ? `selector:${selector}` : null;
}

function nameHint(control: DiscoveredControl): string | null {
  const tag = FIELD_TAGS[control.elementType.toLowerCase()];
  const name = control.name?.trim();
  if (!tag || !name) return null;
  return `selector:${tag}[name="${name.replace(/["\\]/g, "\\$&")}"]`;
}

function captionHint(control: DiscoveredControl): string | null {
  const isField = FIELD_TAGS[control.elementType.toLowerCase()] !== undefined || control.elementType.toLowerCase() === "textbox";
  const caption = (isField ? control.label ?? control.placeholder : control.text ?? control.label)?.trim();
  if (!caption || caption.length > MAX_CAPTION_LENGTH || caption.includes("\n")) return null;
  return `${isField ? "label" : "text"}:${caption}`;
}
