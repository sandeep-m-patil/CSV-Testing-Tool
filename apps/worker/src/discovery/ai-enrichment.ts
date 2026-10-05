import type { AIProvider } from "@repo/ai";
import { sanitizePageContext } from "@repo/ai";
import type { AiElement, AiPageContext, AiPageInterpretation } from "@repo/schemas";
import type { AnalyzedPage } from "@repo/browser";

const MAX_ELEMENTS = 200;
const AI_TIMEOUT_MS = 15_000;
const TEXT_ELEMENTS = new Set(["textbox", "input", "combobox", "select", "textarea"]);

export interface PageInsight {
  pageType: string;
  purpose: string;
  fields: AiPageInterpretation["fields"];
  actions: AiPageInterpretation["actions"];
  /** Provider that answered, or `heuristic` when the model was unusable. */
  source: string;
}

/**
 * Only visible, non-interactive-identifying element attributes reach the model.
 * Selectors, xpaths and test ids are excluded on purpose: the model may describe
 * intent, never emit something the executor will act on.
 */
function toAiElements(analyzed: AnalyzedPage): AiElement[] {
  return analyzed.snapshot.elements
    .filter((element) => element.visible)
    .slice(0, MAX_ELEMENTS)
    .map((element) => ({
      role: element.role ?? undefined,
      elementType: element.elementType,
      label: element.label ?? undefined,
      name: element.name ?? undefined,
      placeholder: element.placeholder ?? undefined,
      text: element.text ?? undefined,
      testId: undefined,
    }));
}

function buildContext(analyzed: AnalyzedPage): AiPageContext {
  return sanitizePageContext({
    url: analyzed.snapshot.url,
    title: analyzed.snapshot.title.slice(0, 300),
    pageType: analyzed.classification.pageType,
    elements: toAiElements(analyzed),
  });
}

/**
 * Deterministic interpretation derived from the snapshot, used verbatim when no
 * model is configured and whenever a provider fails or times out. Discovery must
 * never stall or fail because of an optional dependency.
 */
export function heuristicInsight(analyzed: AnalyzedPage): PageInsight {
  const classification = analyzed.classification;
  const fields = classification.formFields.map((field) => ({
    name: field.label.slice(0, 200),
    label: field.label.slice(0, 200) || undefined,
    inputType: field.elementType,
    required: field.required,
  }));
  const actions = analyzed.actions.slice(0, 50).map((action) => ({
    name: (action.target.label ?? action.target.text ?? action.target.name ?? action.action).slice(0, 200),
    type: mapActionType(action.action),
    targetUrl: action.target.url,
  }));

  const hasPassword = analyzed.snapshot.elements.some((element) => element.inputType === "password");

  return {
    pageType: classification.pageType,
    purpose: classification.isLogin || hasPassword
      ? "Authenticate a user into the application."
      : classification.hasForm
        ? `Submit data through the ${classification.name} form.`
        : `View ${classification.name}.`,
    fields,
    actions,
    source: "heuristic",
  };
}

function mapActionType(action: string): AiPageInterpretation["actions"][number]["type"] {
  if (action === "SUBMIT") return "submit";
  if (action === "NAVIGATE") return "navigate";
  if (action === "OPEN_DIALOG") return "other";
  if (action === "CLOSE_DIALOG") return "cancel";
  if (action === "FILL" || action === "SELECT") return "other";
  if (action === "CLICK") return "other";
  return "other";
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`AI provider timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Asks the configured model what this page is for, then returns a validated
 * interpretation. Any failure, malformed response or timeout falls back to the
 * heuristic so discovery continues with the same page node.
 *
 * The result is advisory: it is stored as page intent and never used to choose
 * what to click or whether a test passed.
 */
export async function interpretPageWithFallback(
  ai: AIProvider,
  analyzed: AnalyzedPage,
): Promise<PageInsight> {
  if (ai.kind === "mock") return heuristicInsight(analyzed);

  try {
    const interpretation = await withTimeout(ai.interpretPage(buildContext(analyzed)), AI_TIMEOUT_MS);
    const merged = {
      pageType: interpretation.pageType,
      purpose: interpretation.purpose,
      fields: interpretation.fields.length > 0 ? interpretation.fields : heuristicInsight(analyzed).fields,
      actions: interpretation.actions,
      source: ai.kind,
    };
    return merged;
  } catch {
    return heuristicInsight(analyzed);
  }
}

/** True when the snapshot looks like a form worth asking the model about. */
export function isFormLike(analyzed: AnalyzedPage): boolean {
  return analyzed.classification.hasForm && analyzed.snapshot.elements.some((element) => TEXT_ELEMENTS.has(element.elementType));
}