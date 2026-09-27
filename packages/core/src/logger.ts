import { inspect } from "node:util";
import { Writable } from "node:stream";
import pino from "pino";

const redactPaths = [
  "password",
  "*.password",
  "secretData",
  "*.secretData",
  "token",
  "*.token",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
];

const MAX_VALUE_LENGTH = 400;
const MAX_STACK_LINES = 5;
const MAX_ARRAY_ITEMS = 8;

const LEVEL_COLORS: Record<string, string> = {
  trace: "90",
  debug: "90",
  info: "36",
  warn: "33",
  error: "31",
  fatal: "31",
};

/** Fields that are rendered in a fixed column order so dev output lines up. */
const FIELD_ORDER = ["scope", "workerId", "sessionId", "moduleId", "runId", "name", "err"];

/** Constant fields that only add noise to the pretty output. */
const HIDDEN_FIELDS = ["level", "levelLabel", "time", "msg", "service", "pid", "hostname"];

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function usesColors(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… (+${text.length - max} chars)`;
}

function firstLines(text: string, max: number): string {
  const lines = text.split("\n");
  if (lines.length <= max) return text;
  return `${lines.slice(0, max).join("\n")}\n… (+${lines.length - max} more lines)`;
}

function isSerializedError(value: unknown): value is { message: string; stack?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { message?: unknown }).message === "string" &&
    ("stack" in value || "type" in value)
  );
}

function formatValue(value: unknown): string {
  // pino serialises errors to plain objects before they reach the destination.
  if (isSerializedError(value)) {
    const stack = typeof value.stack === "string" ? firstLines(value.stack, MAX_STACK_LINES) : value.message;
    return truncateText(stack, MAX_VALUE_LENGTH);
  }
  if (value instanceof Error) {
    return truncateText(firstLines(value.stack ?? value.message, MAX_STACK_LINES), MAX_VALUE_LENGTH);
  }
  if (typeof value === "string") {
    return truncateText(value, MAX_VALUE_LENGTH);
  }
  if (Array.isArray(value)) {
    const shown = value.slice(0, MAX_ARRAY_ITEMS).map((item) => formatValue(item));
    const suffix = value.length > MAX_ARRAY_ITEMS ? `, +${value.length - MAX_ARRAY_ITEMS} more` : "";
    return `[${shown.join(", ")}${suffix}]`;
  }
  return truncateText(inspect(value, { depth: 2, breakLength: Number.POSITIVE_INFINITY, compact: true }), MAX_VALUE_LENGTH);
}

function paint(text: string, color: string): string {
  return usesColors() ? `\u001b[${color}m${text}\u001b[0m` : text;
}

function formatPretty(entry: Record<string, unknown>): string {
  const level = typeof entry.level === "number" ? String(entry.level) : "info";
  const levelName = (entry.levelLabel as string | undefined) ?? LEVELS[level] ?? "info";
  const message = typeof entry.msg === "string" ? firstLines(entry.msg, MAX_STACK_LINES) : "";

  const parts: string[] = [];
  for (const key of FIELD_ORDER) {
    if (entry[key] === undefined || entry[key] === null) continue;
    parts.push(`${key}=${formatValue(entry[key])}`);
  }
  for (const [key, value] of Object.entries(entry)) {
    if (FIELD_ORDER.includes(key) || HIDDEN_FIELDS.includes(key) || value === null) continue;
    parts.push(`${key}=${formatValue(value)}`);
  }

  const head = `${paint(formatTime(entry.time), "90")} ${paint(levelName.toUpperCase().padEnd(5), LEVEL_COLORS[levelName] ?? "90")}`;
  return [head, message, ...parts].filter((part) => part !== "").join(" ");
}

/** Accepts both pino's isoTime string and epoch milliseconds. */
function formatTime(time: unknown): string {
  if (typeof time === "number") return new Date(time).toISOString().slice(11, 23);
  if (typeof time === "string" && time.length >= 23) return time.slice(11, 23);
  return "--:--:--.---";
}

const LEVELS: Record<string, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

/** Human-readable single-line output for local development. */
function prettyDestination() {
  return new Writable({
    write(chunk, _encoding, callback) {
      const line = chunk.toString();
      let output = line.trimEnd();
      try {
        output = formatPretty(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // Not JSON, print as-is.
      }
      process.stdout.write(`${output}\n`);
      callback();
    },
  });
}

const baseOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: redactPaths, censor: "[REDACTED]" },
  base: { service: process.env.SERVICE_NAME ?? "autotest" },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const usePretty = process.env.NODE_ENV !== "production" && process.env.LOG_PRETTY !== "false";

export const logger = usePretty ? pino(baseOptions, prettyDestination()) : pino(baseOptions);

export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
