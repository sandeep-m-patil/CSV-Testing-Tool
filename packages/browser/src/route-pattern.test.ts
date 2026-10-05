import { describe, expect, it } from "vitest";
import { canonicalUrl, isDynamicSegment, normalizeRoute } from "./route-pattern";

describe("isDynamicSegment", () => {
  it("treats a numeric id as dynamic", () => {
    expect(isDynamicSegment("123")).toBe(true);
  });

  it("treats a uuid as dynamic", () => {
    expect(isDynamicSegment("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("treats a mongo object id as dynamic", () => {
    expect(isDynamicSegment("507f1f77bcf86cd799439011")).toBe(true);
  });

  it("treats a long hex token as dynamic", () => {
    expect(isDynamicSegment("9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0")).toBe(true);
  });

  it("treats an iso date as dynamic", () => {
    expect(isDynamicSegment("2026-01-15")).toBe(true);
  });

  it("keeps a static route name static", () => {
    expect(isDynamicSegment("materials")).toBe(false);
  });

  it("keeps a version segment static", () => {
    expect(isDynamicSegment("v1")).toBe(false);
  });

  it("keeps an empty segment static", () => {
    expect(isDynamicSegment("")).toBe(false);
  });
});

describe("normalizeRoute", () => {
  it("collapses numeric ids to a single pattern", () => {
    expect(normalizeRoute("/materials/123")).toBe("/materials/:id");
    expect(normalizeRoute("/materials/456")).toBe(normalizeRoute("/materials/123"));
  });

  it("ignores query string and hash", () => {
    expect(normalizeRoute("https://app.test/materials/123?filter=open#top")).toBe("/materials/:id");
  });

  it("preserves every static segment", () => {
    expect(normalizeRoute("/api/v1/materials/123")).toBe("/api/v1/materials/:id");
  });

  it("collapses several dynamic segments", () => {
    expect(normalizeRoute("/orders/12/lines/7")).toBe("/orders/:id/lines/:id");
  });

  it("normalizes a trailing slash away", () => {
    expect(normalizeRoute("/materials/123/")).toBe("/materials/:id");
  });

  it("returns the root for the site root", () => {
    expect(normalizeRoute("https://app.test/")).toBe("/");
    expect(normalizeRoute("/")).toBe("/");
  });

  it("accepts a relative path", () => {
    expect(normalizeRoute("materials/9")).toBe("/materials/:id");
  });

  it("leaves a fully static route untouched", () => {
    expect(normalizeRoute("/settings/profile")).toBe("/settings/profile");
  });
});

describe("canonicalUrl", () => {
  it("drops the hash", () => {
    expect(canonicalUrl("https://app.test/materials/1#anchor")).toBe("https://app.test/materials/1");
  });

  it("drops tracking parameters", () => {
    expect(canonicalUrl("https://app.test/materials?utm_source=email&id=7")).toBe("https://app.test/materials?id=7");
  });

  it("sorts remaining query parameters", () => {
    expect(canonicalUrl("https://app.test/list?b=2&a=1")).toBe("https://app.test/list?a=1&b=2");
  });

  it("treats reordered query parameters as the same url", () => {
    expect(canonicalUrl("https://app.test/list?a=1&b=2")).toBe(canonicalUrl("https://app.test/list?b=2&a=1"));
  });

  it("keeps a bare path unchanged", () => {
    expect(canonicalUrl("/materials/1")).toBe("/materials/1");
  });
});