import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { FRAME_BOUNDARY, sameOriginAs, snapshotPage } from "./page-snapshot";
import { maskSensitiveInputs } from "./redact";

/** Real Chromium: shadow roots and frames are browser behaviour, not something to fake. */
const BROWSER_TEST_TIMEOUT_MS = 30_000;

const PAGE_HTML = `
  <h1>Checkout</h1>
  <shop-search id="search"></shop-search>
  <iframe name="details" srcdoc="<form><input name='card_holder'><input type='password' name='pin'><button>Pay now</button></form>"></iframe>
  <script>
    const root = document.getElementById("search").attachShadow({ mode: "open" });
    root.innerHTML = '<div><input name="q" aria-label="Search"><button>Go</button></div>';
  </script>`;

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.setContent(PAGE_HTML);
  await page.frame({ name: "details" })?.waitForLoadState();
}, BROWSER_TEST_TIMEOUT_MS);

afterAll(async () => {
  await browser?.close();
});

async function selectorOf(name: string): Promise<string> {
  const snapshot = await snapshotPage(page);
  const element = snapshot.elements.find((candidate) => candidate.name === name);
  if (!element) throw new Error(`"${name}" was not collected`);
  return element.cssSelector;
}

describe("snapshotPage", () => {
  it("collects a control inside an open shadow root with a selector that reaches it", async () => {
    const selector = await selectorOf("q");
    expect(selector).toContain("#search >> ");
    expect(await page.locator(selector).count()).toBe(1);
  });

  it("collects a control inside a same-origin iframe with a framed selector", async () => {
    const selector = await selectorOf("card_holder");
    expect(selector).toContain(FRAME_BOUNDARY);
    await page.locator(selector).fill("Ada Lovelace");
    expect(await page.frame({ name: "details" })?.locator('input[name="card_holder"]').inputValue()).toBe("Ada Lovelace");
  });
});

describe("maskSensitiveInputs", () => {
  it("protects secrets inside iframes and shadow roots, not just the top document", async () => {
    await page.locator('#search >> input[name="q"]').fill("hunter2-secret");
    await maskSensitiveInputs(page, ["hunter2-secret"]);
    const frame = page.frame({ name: "details" });
    expect(await frame?.locator('input[name="pin"]').getAttribute("data-protected")).toBe("true");
    expect(await page.locator('#search >> input[name="q"]').getAttribute("data-protected")).toBe("true");
  });
});

describe("sameOriginAs", () => {
  const isAllowed = sameOriginAs("https://shop.test/checkout");

  it("accepts same-origin and inline frames", () => {
    expect(isAllowed("https://shop.test/embedded/terms")).toBe(true);
    expect(isAllowed("about:srcdoc")).toBe(true);
  });

  it("rejects third-party frames such as hosted payment fields", () => {
    expect(isAllowed("https://js.payments.test/elements")).toBe(false);
  });
});
