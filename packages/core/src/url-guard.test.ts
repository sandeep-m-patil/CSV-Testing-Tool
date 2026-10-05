import { describe, expect, it } from "vitest";
import { describeUrlSafety, isPrivateHostname, safeUrlError } from "./url-guard";

describe("isPrivateHostname", () => {
  it("blocks loopback addresses", () => {
    expect(isPrivateHostname("localhost")).toBe(true);
    expect(isPrivateHostname("127.0.0.1")).toBe(true);
    expect(isPrivateHostname("127.10.20.30")).toBe(true);
  });

  it("blocks private IPv4 ranges", () => {
    expect(isPrivateHostname("10.1.2.3")).toBe(true);
    expect(isPrivateHostname("172.16.4.4")).toBe(true);
    expect(isPrivateHostname("192.168.1.10")).toBe(true);
  });

  it("blocks link-local and metadata addresses", () => {
    expect(isPrivateHostname("169.254.169.254")).toBe(true);
  });

  it("blocks unspecified addresses", () => {
    expect(isPrivateHostname("0.0.0.0")).toBe(true);
  });

  it("allows a public host", () => {
    expect(isPrivateHostname("example.com")).toBe(false);
    expect(isPrivateHostname("93.184.216.34")).toBe(false);
  });

  it("does not treat a public IP with a private prefix as private", () => {
    // 172.32.x.x is public; only 172.16-31.x.x is RFC 1918.
    expect(isPrivateHostname("172.32.0.1")).toBe(false);
    expect(isPrivateHostname("11.0.0.1")).toBe(false);
  });
});

describe("describeUrlSafety", () => {
  it("accepts a normal https target", () => {
    const result = describeUrlSafety("https://example.com/app", { allowPrivateTargets: false });
    expect(result.safe).toBe(true);
  });

  it("rejects a non-http protocol", () => {
    const result = describeUrlSafety("file:///etc/passwd", { allowPrivateTargets: false });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("http");
  });

  it("rejects an embedded credential", () => {
    expect(describeUrlSafety("https://user:pw@example.com", { allowPrivateTargets: false }).safe).toBe(false);
  });

  it("rejects loopback when private targets are disallowed", () => {
    const result = describeUrlSafety("http://localhost:3000", { allowPrivateTargets: false });
    expect(result.safe).toBe(false);
  });

  it("permits loopback only when explicitly allowed for local development", () => {
    const result = describeUrlSafety("http://localhost:3000", { allowPrivateTargets: true });
    expect(result.safe).toBe(true);
  });

  it("rejects a malformed URL", () => {
    expect(describeUrlSafety("not a url", { allowPrivateTargets: false }).safe).toBe(false);
  });
});

describe("safeUrlError", () => {
  it("returns null for a safe URL", () => {
    expect(safeUrlError("https://example.com", { allowPrivateTargets: false })).toBeNull();
  });

  it("returns a reason for an unsafe URL", () => {
    expect(safeUrlError("http://169.254.169.254/latest/meta-data", { allowPrivateTargets: false })).toContain("private");
  });
});