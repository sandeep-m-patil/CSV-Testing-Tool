import Papa from "papaparse";

/**
 * Reading an uploaded CSV file: encoding, delimiter, quoting and multiline
 * cells. Spreadsheet exports arrive as UTF-8 with or without a BOM, UTF-16
 * (Excel "Unicode text"), or Windows-1252 (older Excel "CSV"), and with commas,
 * semicolons (European locales) or tabs as the delimiter.
 */

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 2000;

export type CsvEncoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";

export interface DecodedCsv {
  text: string;
  encoding: CsvEncoding;
}

/** Bytes to text, honouring a BOM and falling back to Windows-1252 for invalid UTF-8. */
export function decodeCsvBytes(bytes: Uint8Array): DecodedCsv {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: decode("utf-8", bytes.subarray(3)), encoding: "utf-8" };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: decode("utf-16le", bytes.subarray(2)), encoding: "utf-16le" };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: decode("utf-16be", bytes.subarray(2)), encoding: "utf-16be" };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: decode("windows-1252", bytes), encoding: "windows-1252" };
  }
}

function decode(encoding: string, bytes: Uint8Array): string {
  return new TextDecoder(encoding).decode(bytes);
}

export interface CsvTable {
  headers: string[];
  /** Data rows, each padded to the header width. */
  rows: string[][];
  /** 1-based file line each data row starts on, for error messages. */
  lines: number[];
  delimiter: string;
  /** Problems with the file as a whole (unterminated quote, too many rows...). */
  errors: string[];
}

/** Text to a header row plus data rows. Quoted fields may contain delimiters, quotes and newlines. */
export function parseCsvTable(text: string): CsvTable {
  const clean = text.replace(/^﻿/, "");
  const result = Papa.parse<string[]>(clean, { skipEmptyLines: "greedy", delimitersToGuess: [",", ";", "\t", "|"] });
  const errors = result.errors.map((error) => `Row ${(error.row ?? 0) + 1}: ${error.message}`);
  const [headerRow = [], ...body] = result.data;
  const headers = headerRow.map((header) => header.trim());
  if (headers.every((header) => header === "")) errors.unshift("The file has no header row.");
  if (body.length > MAX_CSV_ROWS) errors.push(`The file has ${body.length} rows; at most ${MAX_CSV_ROWS} can be imported at once.`);

  const rows = body.slice(0, MAX_CSV_ROWS).map((row) => headers.map((_, index) => row[index] ?? ""));
  return { headers, rows, lines: lineNumbers(clean, rows.length), delimiter: result.meta.delimiter, errors };
}

/**
 * Line on which each data row starts. Multiline quoted cells make the row
 * number and the line number differ, and users look for the line in an editor.
 */
function lineNumbers(text: string, count: number): number[] {
  const starts: number[] = [];
  let line = 1;
  let isQuoted = false;
  let isRowStart = true;
  for (const char of text) {
    if (isRowStart && char !== "\n" && char !== "\r") {
      starts.push(line);
      isRowStart = false;
    }
    if (char === '"') isQuoted = !isQuoted;
    if (char === "\n") {
      line += 1;
      if (!isQuoted) isRowStart = true;
    }
  }
  return starts.slice(1, count + 1);
}
