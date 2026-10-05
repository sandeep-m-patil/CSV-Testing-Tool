import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@repo/browser";
import { pageIdentity, stateFingerprint, stateName } from "./page-identity";

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: "https://shop.test/materials/123",
    title: "Material 123",
    heading: "Steel Plate",
    elements: [
      {
        elementType: "link",
        role: "link",
        name: "back",
        text: "Back",
        placeholder: null,
        label: null,
        testId: null,
        cssSelector: "a.back",
        xpath: "/html/body/a",
        ariaAttributes: {},
        visible: true,
        enabled: true,
        href: "/materials",
        inputType: null,
        formField: false,
      },
    ],
    forms: 0,
    dialogs: 0,
    tables: 0,
    ...overrides,
  };
}

describe("pageIdentity", () => {
  it("collapses a concrete record onto its route pattern", () => {
    expect(pageIdentity(snapshot(), "detail").routePattern).toBe("/materials/:id");
  });

  it("gives two different records of the same route the same page fingerprint", () => {
    const first = pageIdentity(snapshot({ url: "https://shop.test/materials/123" }), "detail");
    const second = pageIdentity(snapshot({ url: "https://shop.test/materials/456", title: "Material 456" }), "detail");
    expect(second.pageFingerprint).toBe(first.pageFingerprint);
  });

  it("keeps a static route out of the dynamic pattern", () => {
    expect(pageIdentity(snapshot({ url: "https://shop.test/materials" }), "list").routePattern).toBe("/materials");
  });

  it("drops tracking parameters from the canonical URL", () => {
    const identity = pageIdentity(snapshot({ url: "https://shop.test/materials/123?utm_source=email&id=2" }), "detail");
    expect(identity.canonicalUrl).toBe("https://shop.test/materials/123?id=2");
  });

  it("changes the DOM fingerprint when the rendered shape changes", () => {
    const base = pageIdentity(snapshot(), "detail");
    const withTable = pageIdentity(snapshot({ tables: 1 }), "detail");
    expect(withTable.domFingerprint).not.toBe(base.domFingerprint);
  });

  it("keeps the DOM fingerprint stable when only a field value changes", () => {
    const empty = pageIdentity(snapshot(), "form");
    const filled = pageIdentity(snapshot({ heading: "Steel Plate" }), "form");
    expect(filled.domFingerprint).toBe(empty.domFingerprint);
  });
});

describe("stateFingerprint", () => {
  it("differs when a dialog is open on the same page", () => {
    const identity = pageIdentity(snapshot(), "detail");
    const closed = stateFingerprint(snapshot(), identity.domFingerprint);
    const open = stateFingerprint(snapshot({ dialogs: 1 }), identity.domFingerprint);
    expect(open).not.toBe(closed);
  });

  it("is stable across two observations of the same state", () => {
    const identity = pageIdentity(snapshot(), "detail");
    expect(stateFingerprint(snapshot({ url: "https://shop.test/materials/999" }), identity.domFingerprint)).toBe(
      stateFingerprint(snapshot(), identity.domFingerprint),
    );
  });
});

describe("stateName", () => {
  it("labels an open dialog state", () => {
    expect(stateName("Materials", snapshot({ dialogs: 1 }))).toBe("Materials — dialog open");
  });

  it("labels a form state", () => {
    expect(stateName("Materials", snapshot({ forms: 1 }))).toBe("Materials — form state");
  });
});