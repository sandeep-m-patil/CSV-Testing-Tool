import { z } from "zod";
import type { KeyValueRow, TestDataSet } from "./config";

/**
 * Dataset input, normalised server-side.
 *
 * The browser sends what the user actually typed — a blob of `key=value` lines
 * or pasted CSV text — while storage keeps structured columns and rows. Parsing
 * lives here so the client and server cannot disagree about the shape, which is
 * what previously made every CSV save fail validation.
 */
export const CreateTestDataSetInputSchema = z
  .object({
    name: z.string().trim().min(1, "Dataset name is required").max(120),
    dataType: z.enum(["KEY_VALUE", "CSV_TEMPLATE"]),
    keyValues: z.string().optional(),
    csv: z.string().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.dataType === "KEY_VALUE" && !input.keyValues?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["keyValues"], message: "Add at least one key=value line" });
    }
    if (input.dataType === "CSV_TEMPLATE" && !input.csv?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["csv"], message: "Paste or upload CSV with a header row" });
    }
  });
export type CreateTestDataSetInput = z.infer<typeof CreateTestDataSetInputSchema>;

/** Structured form accepted by the database and returned by the API. */
export const StoredTestDataSchema = z.union([
  z.object({ type: z.literal("key_value"), values: z.record(z.string(), z.string()) }),
  z.object({ type: z.literal("csv"), columns: z.array(z.string()), rows: z.array(z.record(z.string(), z.string())) }),
]);
export type StoredTestData = z.infer<typeof StoredTestDataSchema>;

const MAX_ROWS = 1000;
const MAX_COLUMNS = 100;

/** `key=value` per line, ignoring blanks and `#` comments. */
export function parseKeyValueBlock(raw: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (key.length > 0) values[key] = trimmed.slice(separator + 1).trim();
  }
  return values;
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF, and a header row. */
export function parseCsvBlock(raw: string): { columns: string[]; rows: Record<string, string>[] } {
  const table = parseTable(raw);
  if (table.length === 0) return { columns: [], rows: [] };

  const columns = makeUnique(table[0]!.map((cell, index) => normaliseHeader(cell, index)));
  const rows: Record<string, string>[] = [];
  for (const line of table.slice(1)) {
    if (line.length === 0 || line.length > MAX_ROWS) continue;
    const row: Record<string, string> = {};
    columns.forEach((column, index) => {
      row[column] = (line[index] ?? "").trim();
    });
    rows.push(row);
  }
  return { columns, rows: rows.slice(0, MAX_ROWS) };
}

/**
 * Suffixes repeated column names.
 *
 * Two identical headers would otherwise collapse into one key, so the second
 * column's data would overwrite the first and a step referencing either would
 * silently read the wrong value.
 */
function makeUnique(columns: string[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((column) => {
    const count = (seen.get(column) ?? 0) + 1;
    seen.set(column, count);
    return count === 1 ? column : `${column}_${count}`;
  });
}

/**
 * Turns a header cell into a usable column name.
 *
 * A blank or duplicated header would produce a column no step can reference, so
 * both are replaced with a positional name rather than silently colliding.
 */
function normaliseHeader(cell: string, index: number): string {
  const trimmed = cell.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return trimmed.length > 0 ? trimmed.slice(0, 64) : `column_${index + 1}`;
}

function parseTable(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let isQuoted = false;

  for (let index = 0; index < raw.length && rows.length <= MAX_ROWS; index += 1) {
    const char = raw[index]!;
    const next = raw[index + 1];

    if (isQuoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        isQuoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      isQuoted = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\r") continue;
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}

/** Converts validated browser input into the structured shape that is stored. */
export function normaliseTestDataSetInput(input: CreateTestDataSetInput): StoredTestData {
  if (input.dataType === "KEY_VALUE") {
    return { type: "key_value", values: parseKeyValueBlock(input.keyValues ?? "") };
  }
  return { type: "csv", ...parseCsvBlock(input.csv ?? "") };
}

const KEY_VALUE_TYPE = "key_value" as const;
const CSV_TYPE = "csv" as const;

/** Narrows a stored dataset to the CSV shape, which is the only data-driven one. */
export function isCsvDataSet(data: TestDataSet["data"]): data is { type: typeof CSV_TYPE; columns: string[]; rows: KeyValueRow[] } {
  return data.type === CSV_TYPE && Array.isArray(data.rows);
}

export function isKeyValueDataSet(data: TestDataSet["data"]): data is { type: typeof KEY_VALUE_TYPE; values: KeyValueRow } {
  return data.type === KEY_VALUE_TYPE;
}
