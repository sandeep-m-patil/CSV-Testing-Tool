import { describe, expect, it } from "vitest";
import { isTestingAuthorized, siteKey, testingAuthorizationError, withAuthorizedHost } from "./test-authorization";

const CONFIRMED_AT = new Date("2026-10-18T09:00:00Z");

describe("siteKey", () => {
  it("treats www and the bare host as one site", () => {
    expect(siteKey("https://www.Shop.test/cart")).toBe("shop.test");
    expect(siteKey("http://shop.test")).toBe("shop.test");
  });

  it("keeps the port, so two local apps stay separate", () => {
    expect(siteKey("http://localhost:4000/login")).toBe("localhost:4000");
  });

  it("rejects non-web and malformed URLs", () => {
    expect(siteKey("file:///etc/passwd")).toBeNull();
    expect(siteKey("not a url")).toBeNull();
  });
});

describe("isTestingAuthorized", () => {
  const project = { authorizationConfirmedAt: CONFIRMED_AT, authorizedHosts: ["shop.test"] };

  it("allows a confirmed site", () => {
    expect(isTestingAuthorized(project, "https://www.shop.test/checkout")).toBe(true);
  });

  it("refuses a different subdomain or host", () => {
    expect(isTestingAuthorized(project, "https://admin.shop.test/")).toBe(false);
    expect(isTestingAuthorized(project, "https://other.test/")).toBe(false);
  });

  it("refuses everything until authorization is confirmed", () => {
    expect(isTestingAuthorized({ authorizationConfirmedAt: null, authorizedHosts: ["shop.test"] }, "https://shop.test/")).toBe(false);
  });

  it("explains the refusal with the site that needs confirming", () => {
    expect(testingAuthorizationError(project, "https://staging.shop.test/")).toContain("staging.shop.test");
  });
});

describe("withAuthorizedHost", () => {
  it("adds a site once", () => {
    const once = withAuthorizedHost(["shop.test"], "https://staging.shop.test/");
    expect(withAuthorizedHost(once, "https://staging.shop.test/x")).toEqual(["shop.test", "staging.shop.test"]);
  });
});
