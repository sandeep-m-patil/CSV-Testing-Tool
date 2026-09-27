import { classifyAction, isLogoutCommand } from "@repo/core";
import type { CollectedElement, DetectedAction } from "./types";

const SUBMIT_TYPES = new Set(["submit", "button", "image"]);
const isSubmitText = (text: string): boolean =>
  /^(save|submit|create|add|ok|confirm|update|continue|next|send|store|register|sign up)$/i.test(text.trim());

/**
 * Deterministically derive candidate actions from a collected element set.
 * Safety classification comes from @repo/core (blocked / dangerous patterns).
 */
export function detectActions(elements: CollectedElement[]): DetectedAction[] {
  const actions: DetectedAction[] = [];

  for (const element of elements) {
    if (!element.visible || !element.enabled) continue;

    const display = element.label || element.text || element.name || element.placeholder || "";
    if (display && isLogoutCommand(display)) {
      actions.push({
        action: "NAVIGATE",
        target: { elementType: element.elementType, text: display, url: element.href ?? undefined, cssSelector: element.cssSelector },
        dangerous: false,
        blocked: true,
        reason: "logout",
      });
      continue;
    }

    const safety = classifyAction(display);

    switch (element.elementType) {
      case "link":
        if (element.href) {
          actions.push({
            action: "NAVIGATE",
            target: {
              elementType: "link",
              role: "link",
              name: element.label ?? element.text ?? undefined,
              text: element.text ?? undefined,
              url: element.href,
              testId: element.testId ?? undefined,
              cssSelector: element.cssSelector,
            },
            dangerous: safety.dangerous,
            blocked: safety.blocked,
            reason: safety.reason,
          });
        }
        break;

      case "input":
      case "textbox":
      case "textarea":
        actions.push({
          action: "FILL",
          target: {
            elementType: element.elementType,
            role: element.role ?? undefined,
            name: element.name ?? undefined,
            label: element.label ?? undefined,
            placeholder: element.placeholder ?? undefined,
            testId: element.testId ?? undefined,
            cssSelector: element.cssSelector,
          },
          dangerous: false,
          blocked: false,
        });
        break;

      case "select":
        actions.push({
          action: "SELECT",
          target: {
            elementType: "select",
            role: element.role ?? undefined,
            label: element.label ?? undefined,
            name: element.name ?? undefined,
            cssSelector: element.cssSelector,
          },
          dangerous: false,
          blocked: false,
        });
        break;

      case "checkbox": {
        const isCheckedGuess = (element.inputType ?? element.role ?? "") === "checkbox";
        actions.push({
          action: isCheckedGuess ? "CHECK" : "CHECK",
          target: {
            elementType: "checkbox",
            label: element.label ?? undefined,
            cssSelector: element.cssSelector,
          },
          dangerous: false,
          blocked: false,
        });
        break;
      }

      case "radio":
        actions.push({
          action: "CHECK",
          target: { elementType: "radio", label: element.label ?? undefined, cssSelector: element.cssSelector },
          dangerous: false,
          blocked: false,
        });
        break;

      case "button": {
        const text = display;
        const inputType = element.inputType ?? "";
        const isSubmit = SUBMIT_TYPES.has(inputType) && (isSubmitText(text) || inputType === "submit" || inputType === "image");
        actions.push({
          action: isSubmit ? "SUBMIT" : "CLICK",
          target: {
            elementType: "button",
            role: element.role ?? undefined,
            name: element.name ?? undefined,
            text: text || undefined,
            testId: element.testId ?? undefined,
            cssSelector: element.cssSelector,
          },
          dangerous: safety.dangerous,
          blocked: safety.blocked,
          reason: safety.reason,
        });
        break;
      }

      case "tab":
        actions.push({
          action: "CLICK",
          target: { elementType: "tab", role: "tab", text: element.text ?? undefined, cssSelector: element.cssSelector },
          dangerous: false,
          blocked: false,
        });
        break;

      case "menuitem":
      case "menu":
        actions.push({
          action: "CLICK",
          target: { elementType: element.elementType, text: element.text ?? undefined, cssSelector: element.cssSelector },
          dangerous: safety.dangerous,
          blocked: safety.blocked,
          reason: safety.reason,
        });
        break;

      case "dialog":
        actions.push({
          action: "CLOSE_DIALOG",
          target: { elementType: "dialog", name: element.name ?? undefined, cssSelector: element.cssSelector },
          dangerous: false,
          blocked: false,
        });
        break;

      default:
        break;
    }
  }

  return dedupeActions(actions);
}

function dedupeActions(actions: DetectedAction[]): DetectedAction[] {
  const seen = new Set<string>();
  const result: DetectedAction[] = [];
  for (const action of actions) {
    const key = `${action.action}|${action.target.cssSelector ?? action.target.text ?? action.target.label ?? action.target.url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}