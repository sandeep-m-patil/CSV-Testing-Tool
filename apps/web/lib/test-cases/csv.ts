/**
 * RFC 4180 CSV serialisation plus a compact, spreadsheet-friendly step DSL so
 * test cases can be authored in Excel and imported without touching JSON.
 *
 * Step DSL: actions separated by `|`, each `ACTION target [value]`.
 *   GOTO http://host/login | FILL role:email a@b.c | SUBMIT role:submit | VERIFY stayed_on_page
 * VERIFY accepts: navigated_away, stayed_on_page, error_message, app_responsive,
 * attr:<target>:<attribute>=<value>, or any_of:<expectation>,<expectation>
 */

export const CSV_HEADERS = [
  "TC ID",
  "Test Case",
  "Type",
  "Priority",
  "Test Data",
  "Expected Result",
  "Actual Result",
  "Status",
  "Duration (ms)",
  "Screenshot",
  "Steps",
] as const;

export function escapeCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const needsQuotes = /[",\r\n]/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/** Minimal RFC 4180 parser: handles quoted fields, escaped quotes and CRLF. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let isQuoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    const next = input[index + 1];

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
