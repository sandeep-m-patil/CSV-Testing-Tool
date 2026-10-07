import { describe, expect, it } from "vitest";
import { JevClient, JEV_DEFAULT_API_URL, choiceConfidence, createJevClient, readChoice, readNoul } from "./jev";

type Call = { url: string; init: RequestInit };

function fetcherFrom(responses: Array<() => Response>): { fetcher: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  let index = 0;
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[Math.min(index, responses.length - 1)]!;
    index += 1;
    return next();
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const ok = (answers: unknown) => () => new Response(JSON.stringify({ answers }), { status: 200 });

describe("JevClient", () => {
  it("posts state, model and questions to System One with a bearer key", async () => {
    const { fetcher, calls } = fetcherFrom([ok({ q: { noul: 0.8 } })]);
    const client = new JevClient({ apiKey: "k-123", fetcher });
    await client.ask({ page: { url: "/" } }, { q: { type: "noul", instructions: "Is it?" } });

    expect(calls[0]?.url).toBe(JEV_DEFAULT_API_URL);
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer k-123");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      state: { page: { url: "/" } },
      model: "jev-latest",
      questions: { q: { type: "noul", instructions: "Is it?" } },
    });
  });

  it("retries rate limits and server errors, then succeeds", async () => {
    const { fetcher, calls } = fetcherFrom([() => new Response("slow down", { status: 429 }), ok({ q: { noul: 0.4 } })]);
    const client = new JevClient({ apiKey: "k", fetcher, retryDelayMs: 0 });
    const answers = await client.ask({}, { q: { type: "noul", instructions: "?" } });
    expect(readNoul(answers, "q")).toBe(0.4);
    expect(calls).toHaveLength(2);
  });

  it("does not retry a client error", async () => {
    const { fetcher, calls } = fetcherFrom([() => new Response("bad request", { status: 400 })]);
    const client = new JevClient({ apiKey: "k", fetcher, retryDelayMs: 0 });
    await expect(client.ask({}, {})).rejects.toThrow(/Jev error 400/);
    expect(calls).toHaveLength(1);
  });
});

describe("answer readers", () => {
  it("reads a choice and the probability of the chosen option", () => {
    const pick = readChoice({ t: { choice: "3", probabilities: { "3": 0.7, "4": 0.3 } } }, "t");
    expect(pick.choice).toBe("3");
    expect(choiceConfidence(pick)).toBe(0.7);
  });

  it("rejects a malformed answer instead of guessing", () => {
    expect(() => readNoul({ q: { noul: "yes" } }, "q")).toThrow();
  });
});

describe("createJevClient", () => {
  it("is null without a key, so callers degrade", () => {
    expect(createJevClient({})).toBeNull();
    expect(createJevClient({ apiKey: "k" })).toBeInstanceOf(JevClient);
  });
});
