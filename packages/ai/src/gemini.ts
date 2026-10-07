import {
  AiPageInterpretationSchema,
  AiWorkflowAnalysisSchema,
  type AiPageContext,
  type AiPageInterpretation,
  type AiTestCaseContext,
  type AiTestCaseSuggestions,
  type AiWorkflowAnalysis,
} from "@repo/schemas";
import type { AIProvider } from "./types";
import { sanitizePageContext } from "./sanitize";
import { buildTestCaseTask, parseTestCaseSuggestions } from "./test-case-task";

export interface GeminiOptions {
  apiKey: string;
  model: string;
  /** Overridable for Vertex AI or regional endpoints; defaults to the public API. */
  baseUrl?: string;
  fetcher?: typeof fetch;
}

const API_VERSION = "v1beta";
const DEFAULT_BASE_URL = `https://generativelanguage.googleapis.com/${API_VERSION}`;
const DEFAULT_TEMPERATURE = 0.1;
/** Slightly higher than classification: case generation benefits from variety. */
const CASE_GENERATION_TEMPERATURE = 0.3;
const MAX_ERROR_BODY = 300;

/**
 * Shared with the OpenAI adapter. Gemini decides *what should be tested* and
 * classifies pages. It must never emit Playwright code, selectors or
 * coordinates, and must never receive secrets - redaction happens before the
 * context reaches this layer.
 */
const SYSTEM_PROMPT = [
  "You are the discovery intelligence layer of an autonomous web application testing platform.",
  "You receive a STRUCTURED, DETERMINISTIC snapshot of a page (URL, title, accessible elements).",
  "You never control the browser directly and never see screenshots.",
  "Return strictly valid JSON matching the requested schema.",
  "Never invent fields or actions that are not present in the provided elements.",
  "Do not include passwords, tokens, or secrets of any kind in your output.",
  "Never emit Playwright code, CSS selectors, or coordinates.",
].join(" ");

interface GeminiGenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

async function generateJson(
  options: GeminiOptions,
  task: unknown,
  temperature: number = DEFAULT_TEMPERATURE,
): Promise<unknown> {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetcher(
    `${baseUrl}/models/${encodeURIComponent(options.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(task) }] }],
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini error ${response.status}: ${body.slice(0, MAX_ERROR_BODY)}`);
  }

  const json = (await response.json()) as GeminiGenerateResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }
  return JSON.parse(text) as unknown;
}

export class GeminiProvider implements AIProvider {
  readonly kind = "gemini" as const;
  readonly label: string;

  private readonly options: GeminiOptions;

  constructor(options: GeminiOptions) {
    this.label = `Gemini (${options.model})`;
    this.options = options;
  }

  async interpretPage(context: AiPageContext): Promise<AiPageInterpretation> {
    const parsedContext = sanitizePageContext(context);
    const raw = await generateJson(this.options, {
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
    const raw = await generateJson(this.options, {
      task: "analyze_workflows",
      module: context.moduleName,
      pages: context.pages.slice(0, 40),
      transitions: context.transitions.slice(0, 80),
      output: "name, purpose, workflows[{name, steps[string]}]",
    });
    return AiWorkflowAnalysisSchema.parse(raw);
  }

  async generateTestCases(context: AiTestCaseContext): Promise<AiTestCaseSuggestions> {
    const raw = await generateJson(this.options, buildTestCaseTask(context), CASE_GENERATION_TEMPERATURE);
    return parseTestCaseSuggestions(raw);
  }
}