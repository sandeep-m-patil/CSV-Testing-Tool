import { describe, expect, it } from "vitest";
import {
  CreateTestDataSetInputSchema,
  normaliseTestDataSetInput,
  parseCsvBlock,
  parseKeyValueBlock,
} from "./test-data";

describe("parseKeyValueBlock", () => {
  it("reads one pair per line", () => {
    expect(parseKeyValueBlock("name=Buffer A\nsupplier=BioLabs")).toEqual({ name: "Buffer A", supplier: "BioLabs" });
  });

  it("keeps an equals sign inside the value", () => {
    expect(parseKeyValueBlock("formula=a=b")).toEqual({ formula: "a=b" });
  });

  it("ignores blanks, comments and malformed lines", () => {
    expect(parseKeyValueBlock("\n# note\nno-separator\nname=A")).toEqual({ name: "A" });
  });
});

describe("parseCsvBlock", () => {
  it("uses the first row as the header and lowercases it", () => {
    const { columns, rows } = parseCsvBlock("Name,Supplier\nBuffer A,BioLabs");
    expect(columns).toEqual(["name", "supplier"]);
    expect(rows).toEqual([{ name: "Buffer A", supplier: "BioLabs" }]);
  });

  it("handles quoted fields containing commas", () => {
    const { rows } = parseCsvBlock('name,notes\n"A, one","says ""hi"""');
    expect(rows[0]).toEqual({ name: "A, one", notes: 'says "hi"' });
  });

  it("handles CRLF line endings", () => {
    const { rows } = parseCsvBlock("name,supplier\r\nBuffer A,BioLabs\r\n");
    expect(rows).toHaveLength(1);
  });

  it("fills missing cells with an empty string rather than undefined", () => {
    const { rows } = parseCsvBlock("a,b,c\n1,2");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("names blank headers positionally and suffixes repeated ones", () => {
    const { columns } = parseCsvBlock("name,,name");
    expect(columns).toEqual(["name", "column_2", "name_2"]);
  });

  it("keeps a repeated header's data addressable instead of overwriting it", () => {
    const { columns, rows } = parseCsvBlock("name,name\nfirst,second");
    expect(rows[0]).toEqual({ [columns[0]!]: "first", [columns[1]!]: "second" });
  });

  it("returns nothing for empty input", () => {
    expect(parseCsvBlock("   ")).toEqual({ columns: [], rows: [] });
  });
});

describe("CreateTestDataSetInputSchema", () => {
  it("rejects a key/value dataset with no pairs", () => {
    const result = CreateTestDataSetInputSchema.safeParse({ name: "x", dataType: "KEY_VALUE", keyValues: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a CSV dataset with no text", () => {
    const result = CreateTestDataSetInputSchema.safeParse({ name: "x", dataType: "CSV_TEMPLATE" });
    expect(result.success).toBe(false);
  });

  it("accepts the shape the browser actually sends", () => {
    const result = CreateTestDataSetInputSchema.safeParse({
      name: "materials",
      dataType: "CSV_TEMPLATE",
      csv: "name,supplier\nBuffer A,BioLabs",
    });
    expect(result.success).toBe(true);
  });
});

describe("normaliseTestDataSetInput", () => {
  it("turns a key/value block into stored key/value data", () => {
    const data = normaliseTestDataSetInput({ name: "n", dataType: "KEY_VALUE", keyValues: "a=1" });
    expect(data).toEqual({ type: "key_value", values: { a: "1" } });
  });

  it("turns pasted CSV into stored columns and rows", () => {
    const data = normaliseTestDataSetInput({ name: "n", dataType: "CSV_TEMPLATE", csv: "Name,Supplier\nA,B" });
    expect(data).toEqual({ type: "csv", columns: ["name", "supplier"], rows: [{ name: "A", supplier: "B" }] });
  });
});
