import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSafeFetch } from "./ssrf-guard";

const RESOLVE_PUBLIC = async (): Promise<string[]> => ["93.184.216.34"];
const RESOLVE_PRIVATE = async (): Promise<string[]> => ["10.0.0.5"];

function headResponse(init: { status: number; location?: string }): Response {
  return new Response(null, { status: init.status, headers: init.location ? { location: init.location } : {} });
}

function mockFetchSequence(responses: Response[]): ReturnType<typeof vi.fn> {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra fetch");
    return next;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("assertSafeFetch", () => {
  it("allows a public https target", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([headResponse({ status: 200 })]));
    await expect(
      assertSafeFetch("https://example.com/", { allowPrivateTargets: false, resolver: RESOLVE_PUBLIC }),
    ).resolves.toBeUndefined();
  });

  it("rejects a URL whose host resolves to a private address", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([]));
    await expect(
      assertSafeFetch("https://sneaky.example/", { allowPrivateTargets: false, resolver: RESOLVE_PRIVATE }),
    ).rejects.toThrow(/private address/i);
  });

  it("rejects a redirect that points at the metadata service", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSequence([headResponse({ status: 302, location: "http://169.254.169.254/latest/meta-data" })]),
    );
    await expect(
      assertSafeFetch("https://example.com/", { allowPrivateTargets: false, resolver: RESOLVE_PUBLIC }),
    ).rejects.toThrow(/private network/i);
  });

  it("follows a redirect that stays on public hosts", async () => {
    const fetchMock = mockFetchSequence([
      headResponse({ status: 301, location: "https://www.example.com/" }),
      headResponse({ status: 200 }),
    ]);
    vi.stubGlobal("fetch", fetchMock);
    await assertSafeFetch("https://example.com/", { allowPrivateTargets: false, resolver: RESOLVE_PUBLIC });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after the redirect budget", async () => {
    let count = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        count += 1;
        return headResponse({ status: 302, location: `https://example.com/hop-${count}` });
      }),
    );
    await expect(
      assertSafeFetch("https://example.com/", { allowPrivateTargets: false, resolver: RESOLVE_PUBLIC, maxRedirects: 2 }),
    ).rejects.toThrow(/redirects/i);
    expect(count).toBe(3);
  });

  it("permits loopback when private targets are explicitly allowed", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([headResponse({ status: 200 })]));
    await expect(
      assertSafeFetch("http://localhost:3000/", { allowPrivateTargets: true, resolver: async () => [] }),
    ).resolves.toBeUndefined();
  });

  it("reports an unresolvable host", async () => {
    vi.stubGlobal("fetch", mockFetchSequence([]));
    await expect(
      assertSafeFetch("https://example.com/", {
        allowPrivateTargets: false,
        resolver: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
    ).rejects.toThrow(/could not be resolved/i);
  });

  it("rejects a non-http protocol before any network call", async () => {
    const fetchMock = mockFetchSequence([]);
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      assertSafeFetch("file:///etc/passwd", { allowPrivateTargets: false, resolver: RESOLVE_PUBLIC }),
    ).rejects.toThrow(/http/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});