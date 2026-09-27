import { AiPageContextSchema, AiPageInterpretationSchema, AiWorkflowAnalysisSchema, type AiPageContext, type AiPageInterpretation, type AiWorkflowAnalysis } from "@repo/schemas";
import type { AIProvider } from "./types";

export interface OpenAICompatibleOptions {
  label: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  fetcher?: typeof fetch;
}

const SYSTEM_PROMPT = [
  "You are the discovery intelligence layer of an autonomous web application testing platform.",
  "You receive a STRUCTURED, DETERMINISTIC snapshot of a page (URL, title, accessible elements).",
  "You never control the browser directly and never see screenshots.",
  "Return strictly valid JSON matching the requested schema.",
  "Never invent fields or actions that are not present in the provided elements.",
  "Do not include passwords, tokens, or secrets of any kind in your output.",
].join(" ");

async function chatJson(
  options: OpenAICompatibleOptions,
  payload: unknown,
): Promise<unknown> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI provider error ${response.status}: ${body.slice(0, 300)}`);
  }

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned empty response");
  }
  return JSON.parse(content) as unknown;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly kind: AIProvider["kind"] = "openai" as const;
  readonly label: string;

  private readonly options: OpenAICompatibleOptions;

  constructor(options: OpenAICompatibleOptions) {
    this.label = options.label;
    this.options = options;
  }

  async interpretPage(context: AiPageContext): Promise<AiPageInterpretation> {
    const parsedContext = AiPageContextSchema.parse(context);
    const raw = await chatJson(this.options, {
      task: "interpret_page",
      schema: "pageType, purpose, fields[{name,label?,inputType?,required}], actions[{name,type,targetUrl?}]",
      page: parsedContext,
    });
    return AiPageInterpretationSchema.parse(raw);
  }

  async analyzeWorkflows(context: {
    moduleName: string;
    pages: Array<{ name: string; url: string; pageType: string }>;
    transitions: Array<{ label: string; from: string; to: string }>;
  }): Promise<AiWorkflowAnalysis> {
    const raw = await chatJson(this.options, {
      task: "analyze_workflows",
      module: context.moduleName,
      pages: context.pages.slice(0, 40),
      transitions: context.transitions.slice(0, 80),
      output: "name, purpose, workflows[{name, steps[string]}]",
    });
    return AiWorkflowAnalysisSchema.parse(raw);
  }
}