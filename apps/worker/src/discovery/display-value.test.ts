import { describe, expect, it } from "vitest";
import { displayFillValue } from "./display-value";

describe("displayFillValue", () => {
  it("masks anything typed into a password field", () => {
    expect(displayFillValue("Citta@12345", { inputType: "password", secrets: [] })).toBe("••••••");
  });

  it("masks a stored credential typed into any field", () => {
    expect(displayFillValue("EMP-00001", { inputType: "text", secrets: ["EMP-00001", "Citta@12345"] })).toBe("••••••");
  });

  it("keeps ordinary test data readable", () => {
    expect(displayFillValue("Material A", { inputType: "text", secrets: ["Citta@12345"] })).toBe("Material A");
  });
});
