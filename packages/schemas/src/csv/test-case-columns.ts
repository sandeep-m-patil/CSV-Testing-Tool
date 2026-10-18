/**
 * The test-case CSV interchange format. Export writes these headers; import
 * maps a file's headers onto them, accepting common spreadsheet spellings.
 */

export const TEST_CASE_FIELDS = [
  "code",
  "module",
  "name",
  "description",
  "precondition",
  "role",
  "steps",
  "assertions",
  "testData",
  "expectedResult",
  "type",
  "priority",
  "severity",
  "tags",
] as const;
export type TestCaseField = (typeof TEST_CASE_FIELDS)[number];

interface FieldSpec {
  header: string;
  isRequired: boolean;
  aliases: string[];
  hint: string;
}

export const TEST_CASE_COLUMNS: Record<TestCaseField, FieldSpec> = {
  code: { header: "Test ID", isRequired: true, aliases: ["tc id", "test case id", "id", "case id", "testid"], hint: "Unique per module, e.g. LOGIN-001" },
  module: { header: "Module", isRequired: false, aliases: ["module name", "area"], hint: "Must match the module you import into" },
  name: { header: "Scenario", isRequired: true, aliases: ["test case", "test scenario", "title", "name", "summary"], hint: "What the case checks" },
  description: { header: "Description", isRequired: false, aliases: ["details"], hint: "" },
  precondition: { header: "Preconditions", isRequired: false, aliases: ["precondition", "pre-conditions", "pre conditions"], hint: "" },
  role: { header: "Role", isRequired: false, aliases: ["account", "role / account", "user role", "user"], hint: "Project role the case signs in as" },
  steps: { header: "Steps", isRequired: false, aliases: ["test steps", "actions", "procedure"], hint: "One step per line: GOTO, FILL, CLICK..." },
  assertions: { header: "Assertions", isRequired: false, aliases: ["verify", "checks", "verifications"], hint: "VERIFY lines, e.g. VERIFY text_present = Saved" },
  testData: { header: "Test Data", isRequired: false, aliases: ["data", "input data"], hint: "" },
  expectedResult: { header: "Expected Result", isRequired: false, aliases: ["expected outcome", "expected", "expected results"], hint: "" },
  type: { header: "Type", isRequired: false, aliases: ["case type", "category"], hint: "HAPPY_PATH, NEGATIVE, VALIDATION..." },
  priority: { header: "Priority", isRequired: false, aliases: [], hint: "LOW, MEDIUM, HIGH, CRITICAL" },
  severity: { header: "Severity", isRequired: false, aliases: [], hint: "LOW, MEDIUM, HIGH, CRITICAL" },
  tags: { header: "Tags", isRequired: false, aliases: ["labels", "tag"], hint: "Separated by commas or semicolons" },
};

/** For each field, the index of the file column it reads from, or null. */
export type ColumnMapping = Record<TestCaseField, number | null>;

function normalize(header: string): string {
  return header.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

/** Matches headers by name or alias; the user adjusts anything this gets wrong. */
export function autoMapColumns(headers: readonly string[]): ColumnMapping {
  const normalized = headers.map(normalize);
  const mapping = {} as ColumnMapping;
  for (const field of TEST_CASE_FIELDS) {
    const spec = TEST_CASE_COLUMNS[field];
    const names = [spec.header, ...spec.aliases].map(normalize);
    const index = normalized.findIndex((header) => names.includes(header));
    mapping[field] = index >= 0 ? index : null;
  }
  return mapping;
}

/** Required fields the mapping leaves unassigned. */
export function missingRequiredColumns(mapping: ColumnMapping): TestCaseField[] {
  return TEST_CASE_FIELDS.filter((field) => TEST_CASE_COLUMNS[field].isRequired && mapping[field] === null);
}
