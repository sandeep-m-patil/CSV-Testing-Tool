import { describe, expect, it } from "vitest";
import { buildModuleScope, isInScope, pageAddress } from "./scope";

describe("buildModuleScope", () => {
  it("keeps the base URL's path instead of widening to the whole origin", () => {
    const scope = buildModuleScope({ baseUrl: "https://host.test/app" });
    expect(scope.startUrl).toBe("https://host.test/app");
    expect(scope.prefixes).toEqual(["/app"]);
  });

  it("scopes a file-like base URL to its folder", () => {
    const scope = buildModuleScope({ baseUrl: "https://host.test/app/index.html" });
    expect(scope.startUrl).toBe("https://host.test/app/index.html");
    expect(scope.prefixes).toEqual(["/app"]);
  });

  it("opens a hash-routed base URL as given", () => {
    const scope = buildModuleScope({ baseUrl: "https://host.test/#/login" });
    expect(scope.startUrl).toBe("https://host.test/#/login");
    expect(scope.prefixes).toEqual(["/"]);
  });

  it("lets a module's own start path override the base path", () => {
    const scope = buildModuleScope({ baseUrl: "https://host.test/app", startPath: "/materials" });
    expect(scope.startUrl).toBe("https://host.test/materials");
    expect(scope.prefixes).toEqual(["/materials"]);
  });
});

describe("isInScope", () => {
  const scope = buildModuleScope({ baseUrl: "http://example.test" });

  it("accepts the www and https variants of the same site", () => {
    expect(isInScope(scope, "https://www.example.test/products")).toBe(true);
  });

  it("rejects other hosts, including sibling subdomains", () => {
    expect(isInScope(scope, "https://evil.test/")).toBe(false);
    expect(isInScope(scope, "https://api.example.test/")).toBe(false);
  });

  it("treats a different port as a different application", () => {
    const local = buildModuleScope({ baseUrl: "http://localhost:4000" });
    expect(isInScope(local, "http://localhost:5000/")).toBe(false);
  });

  it("excludes paths outside the base path", () => {
    const app = buildModuleScope({ baseUrl: "https://host.test/app" });
    expect(isInScope(app, "https://host.test/app/orders")).toBe(true);
    expect(isInScope(app, "https://host.test/blog")).toBe(false);
  });
});

describe("pageAddress", () => {
  it("drops an in-page anchor", () => {
    expect(pageAddress("https://host.test/menu#news")).toBe("https://host.test/menu");
  });

  it("keeps a client-side hash route", () => {
    expect(pageAddress("https://host.test/#/orders")).toBe("https://host.test/#/orders");
    expect(pageAddress("https://host.test/#!/orders")).toBe("https://host.test/#!/orders");
  });
});
