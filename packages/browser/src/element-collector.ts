import type { Page } from "playwright";
import type { CollectedElement, PageSnapshot } from "./types";

export interface PageSnapshotOptions {
  timeoutMs?: number;
}

/**
 * Runs inside the browser. Must be fully self-contained — Playwright serializes it.
 * Gathers interactive/semantic elements with locator-priority metadata.
 */
function collectInPage(): PageSnapshot {
  type AnyEl = Element & { disabled?: boolean };

  const isVisible = (el: Element): boolean => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    return true;
  };

  const buildSelector = (el: Element): string => {
    const testIds = ["data-testid", "data-test-id", "data-qa", "data-cy"];
    for (const attr of testIds) {
      const value = el.getAttribute(attr);
      if (value) return `[${attr}="${value.replace(/"/g, '\\"')}"]`;
    }
    if (el.id) {
      const idSelector = `#${el.id.replace(/[^a-zA-Z0-9_-]/g, "\\$&")}`;
      if (document.querySelectorAll(idSelector).length === 1) return idSelector;
    }
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${part}#${node.id.replace(/[^a-zA-Z0-9_-]/g, "\\$&")}`);
        break;
      }
      const parentEl: HTMLElement | null = node?.parentElement ?? null;
      if (parentEl) {
        const siblings = Array.from(parentEl.children).filter((child: Element) => child.tagName === node!.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(node) + 1;
          part += `:nth-of-type(${index})`;
        }
      }
      parts.unshift(part);
      node = parentEl ?? null;
      depth += 1;
    }
    return parts.join(" > ");
  };

  const getXPath = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      const parentEl: HTMLElement | null = node?.parentElement ?? null;
      if (!parentEl) {
        parts.unshift(`/${tag}`);
        break;
      }
      const siblings = Array.from(parentEl.children).filter((child: Element) => child.tagName === node!.tagName);
      const index = siblings.indexOf(node) + 1;
      parts.unshift(`/${tag}[${index}]`);
      node = parentEl ?? null;
    }
    return parts.join("");
  };

  const getLabelText = (el: HTMLElement): string | null => {
    const htmlEl = el as HTMLInputElement & { labels?: NodeListOf<HTMLElement> };
    if (htmlEl.labels && htmlEl.labels.length > 0) {
      const labelNode = htmlEl.labels[0];
      const text = labelNode ? (labelNode.innerText || "").trim() : "";
      if (text) return text;
    }
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const target = document.getElementById(labelledBy.split(" ")[0] ?? "");
      if (target) {
        const text = (target.innerText || "").trim();
        if (text) return text;
      }
    }
    const label = el.closest("label");
    if (label) {
      const text = (label.innerText || "").trim();
      if (text) return text;
    }
    const type = el.getAttribute("type");
    if (type === "checkbox" || type === "radio") {
      const sibling = el.parentElement ? (el.parentElement.innerText || "").trim() : "";
      if (sibling) return sibling.slice(0, 120);
    }
    return null;
  };

  const getRole = (el: Element): string => {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === "a" && el.hasAttribute("href")) return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "submit" || type === "button" || type === "reset" || type === "image") return "button";
      if (type === "search") return "searchbox";
      if (type === "range") return "slider";
      if (type === "number") return "spinbutton";
      return "textbox";
    }
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") return "heading";
    if (tag === "table") return "table";
    if (tag === "dialog") return "dialog";
    if (tag === "nav") return "navigation";
    if (tag === "ul" || tag === "ol") return "list";
    if (tag === "form") return "form";
    return tag;
  };

  const determineType = (el: Element, role: string): CollectedElement["elementType"] | null => {
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "select";
    if (tag === "table") return "table";
    if (tag === "form") return "form";
    if (tag === "dialog") return "dialog";
    if (role === "link" || (tag === "a" && el.hasAttribute("href"))) return "link";
    if (role === "tab") return "tab";
    if (role === "menuitem") return "menuitem";
    if (role === "menu" || role === "navigation") return "menu";
    if (tag === "img") return "image";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "submit" || type === "button" || type === "reset") return "button";
      return "input";
    }
    if (role === "textbox" || role === "searchbox" || role === "spinbutton" || role === "slider") return "textbox";
    if (role === "combobox") return "select";
    if (role === "checkbox") return "checkbox";
    if (role === "radio") return "radio";
    if (role === "button") return "button";
    if (role === "heading") return "button";
    if (role === "list") return "table";
    if (role === "table") return "table";
    if (role === "dialog") return "dialog";
    if (role === "form") return "form";
    return null;
  };

  const targets = [
    "a[href]",
    "button",
    'input:not([type="hidden"])',
    "select",
    "textarea",
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="menu"]',
    '[role="navigation"]',
    '[role="dialog"]',
    '[role="table"]',
    '[role="heading"]',
    "table",
    "form",
    "img[alt]",
  ].join(",");

  const elements: CollectedElement[] = [];
  const seen = new Set<string>();

  for (const el of Array.from(document.querySelectorAll(targets))) {
    if (!isVisible(el)) continue;
    const role = getRole(el);
    const elementType = determineType(el, role);
    if (!elementType) continue;

    const testId =
      el.getAttribute("data-testid") ||
      el.getAttribute("data-test-id") ||
      el.getAttribute("data-qa") ||
      el.getAttribute("data-cy") ||
      null;
    const label = getLabelText(el as HTMLElement);
    const text = ((el as HTMLElement).innerText || el.textContent || "").trim().slice(0, 300);
    const name = el.getAttribute("name") || null;
    const placeholder = el.getAttribute("placeholder") || null;
    const href = el.tagName === "A" ? el.getAttribute("href") : null;
    const inputType = el.tagName === "INPUT" ? (el.getAttribute("type") || "text").toLowerCase() : null;

    const ariaAttributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("aria-")) ariaAttributes[attr.name] = attr.value;
    }

    const cssSelector = buildSelector(el);
    const xpath = getXPath(el);
    const displayName = label || text || name || placeholder || href || "";
    const signature = `${elementType}:${role}:${displayName}`;
    if (seen.has(signature)) continue;
    seen.add(signature);

    elements.push({
      elementType,
      role,
      name,
      text: text || null,
      placeholder,
      label,
      testId,
      cssSelector,
      xpath,
      ariaAttributes,
      visible: true,
      enabled: !(el as AnyEl).disabled,
      href,
      inputType,
      formField: ["input", "textarea", "select", "checkbox", "radio"].includes(elementType),
    });

    if (elements.length >= 400) break;
  }

  const headingEl = document.querySelector("h1, h2, [role='heading']");
  return {
    url: window.location.href,
    title: document.title || "",
    heading: headingEl ? ((headingEl as HTMLElement).innerText || "").trim().slice(0, 200) : null,
    elements,
    forms: document.querySelectorAll("form").length,
    dialogs: document.querySelectorAll('dialog, [role="dialog"], .modal').length,
    tables: document.querySelectorAll('table, [role="table"]').length,
  };
}

export async function snapshotPage(page: Page, options: PageSnapshotOptions = {}): Promise<PageSnapshot> {
  void options;
  await ensureRuntimeHelpers(page);
  return page.evaluate(collectInPage);
}

export async function safeSnapshot(page: Page, options: PageSnapshotOptions = {}): Promise<PageSnapshot | null> {
  try {
    return await snapshotPage(page, options);
  } catch {
    return null;
  }
}

/**
 * esbuild's keepNames injects `__name(fn, "fnName")` statements that Playwright
 * serializes into the collector's source. The helper lives in module scope, so it
 * is undefined once the serialized function runs inside the page. Provide it as a
 * global so the injected annotation resolves in the page context.
 */
export async function ensureRuntimeHelpers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const globalObject = globalThis as unknown as Record<string, unknown>;
    if (globalObject.__name === undefined) {
      globalObject.__name = (fn: unknown) => fn;
    }
  });
}