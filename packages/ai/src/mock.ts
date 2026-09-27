import type { AiPageContext, AiPageInterpretation, AiWorkflowAnalysis } from "@repo/schemas";
import type { AIProvider } from "./types";

/**
 * Deterministic, dependency-free provider used when no LLM is configured.
 * Implements the same contract so discovery never blocks on AI.
 */
export class MockProvider implements AIProvider {
  readonly kind = "mock" as const;
  readonly label = "Mock (deterministic)";

  async interpretPage(context: AiPageContext): Promise<AiPageInterpretation> {
    const lower = `${context.url} ${context.title}`.toLowerCase();

    const formFields = context.elements
      .filter((element) => ["textbox", "input", "combobox", "select", "textarea"].includes(element.elementType ?? ""))
      .map((element) => element.label ?? element.name ?? element.placeholder ?? element.text ?? "unnamed-field")
      .filter((name, index, all) => name.length > 0 && all.indexOf(name) === index);

    const submitButtons = context.elements.filter((element) => {
      const type = element.elementType ?? element.role ?? "";
      const text = element.text ?? element.name ?? "";
      if (type === "button" || element.role === "button") {
        return true;
      }
      return !!(element.role === "link" && /(create|add|new|submit|save)/i.test(text));
    });

    const navigateLinks = context.elements.filter(
      (element) => element.role === "link" && !submitButtons.includes(element),
    );

    const pageType = inferPageType(lower, context.elements.length, formFields.length);
    const purpose = inferPurpose(pageType, context.title, lower);

    return {
      pageType,
      purpose,
      fields: formFields.slice(0, 80).map((name, index) => ({
        name,
        required: false,
        inputType: index === 0 ? "text" : undefined,
      })),
      actions: [
        ...submitButtons.slice(0, 25).map((button) => ({
          name: button.text ?? button.name ?? button.label ?? "Submit",
          type: detectSubmitKind(button.text ?? button.name ?? ""),
        })),
        ...(pageType === "list" ? navigateLinks.slice(0, 20).map((link) => ({
          name: link.text ?? link.label ?? "Open",
          type: "navigate" as const,
        })) : []),
      ],
    };
  }

  async analyzeWorkflows(context: {
    moduleName: string;
    pages: Array<{ name: string; url: string; pageType: string }>;
    transitions: Array<{ label: string; from: string; to: string }>;
  }): Promise<AiWorkflowAnalysis> {
    const createFlows = context.pages
      .filter((page) => page.pageType === "form")
      .map((page, index) => ({
        name: `Create ${page.name} (${index + 1})`,
        steps: context.transitions
          .filter((transition) => transition.to === page.name)
          .map((transition) => transition.label)
          .concat(["Fill required fields", "Submit form", "Verify success page"]),
      }));

    const navigationFlows = context.pages
      .filter((page) => page.pageType === "list" || page.pageType === "dashboard")
      .map((page, index) => ({
        name: `Browse ${page.name} (${index + 1})`,
        steps: [`Navigate to ${page.name}`, "Verify list renders"],
      }));

    return {
      name: `${context.moduleName} discovery analysis`,
      purpose: `Discovered ${context.pages.length} pages and ${context.transitions.length} transitions for ${context.moduleName}.`,
      workflows: [...createFlows, ...navigationFlows].slice(0, 40),
    };
  }
}

export function inferPageType(lower: string, elementCount: number, formFieldCount: number): AiPageInterpretation["pageType"] {
  if (/(login|sign in|signin|authenticate)/.test(lower)) return "login";
  if (/(create|add|edit|new record|form)/.test(lower) && formFieldCount > 0) return "form";
  if (/(dashboard|home|overview|landing)/.test(lower)) return "dashboard";
  if (/(review|approval|approve|queue|pending)/.test(lower)) return "review";
  if (/(list|browse|index|search results|table)/.test(lower)) return "list";
  if (elementCount > 12 && formFieldCount === 0) return "list";
  if (formFieldCount > 0) return "form";
  return "other";
}

export function inferPurpose(pageType: AiPageInterpretation["pageType"], title: string, _lower: string): string {
  if (pageType === "login") return "Authenticate a user into the application.";
  if (pageType === "form") return `Submit a new "${title}" record.`;
  if (pageType === "dashboard") return `Overview of ${title} workspace.`;
  if (pageType === "review") return `Review queue for ${title}.`;
  if (pageType === "list") return `List and search ${title}.`;
  if (pageType === "detail") return `Detail view for ${title}.`;
  return `Page: ${title}`;
}

function detectSubmitKind(text: string): "submit" | "cancel" | "create" | "other" {
  const lower = text.toLowerCase();
  if (/cancel|close|dismiss/.test(lower)) return "cancel";
  if (/create|add|new/.test(lower)) return "create";
  if (/save|submit|ok|confirm/.test(lower)) return "submit";
  return "other";
}