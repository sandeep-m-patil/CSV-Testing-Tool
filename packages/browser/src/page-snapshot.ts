import type { Frame, Page } from "playwright";
import { collectInPage, ensureRuntimeHelpers } from "./element-collector";
import type { CollectedElement, PageSnapshot } from "./types";

/**
 * Snapshots a page together with its same-origin iframes. An element inside a
 * frame is addressed as "<iframe> >> internal:control=enter-frame >> <path>",
 * Playwright's own step into a frame's document (what `frameLocator` compiles
 * to), so every consumer that hands the selector to `page.locator()` reaches
 * it without knowing frames exist.
 *
 * Cross-origin frames are skipped on purpose: they are ads, social embeds,
 * captchas and hosted payment fields, none of which a module should drive.
 */

export const FRAME_BOUNDARY = " >> internal:control=enter-frame >> ";
const MAX_ELEMENTS = 400;
const MAX_FRAMES = 10;
const MAX_FRAME_DEPTH = 3;

export interface PageSnapshotOptions {
  timeoutMs?: number;
}

interface FrameWalk {
  prefix: string;
  depth: number;
  isAllowed: (url: string) => boolean;
  /** Shared across the whole walk, so nested frames draw from one budget. */
  budget: { remaining: number };
}

export async function snapshotPage(page: Page, options: PageSnapshotOptions = {}): Promise<PageSnapshot> {
  void options;
  const main = await snapshotFrame(page.mainFrame());
  const framed = await collectChildFrames(page.mainFrame(), {
    prefix: "",
    depth: 0,
    isAllowed: sameOriginAs(page.url()),
    budget: { remaining: MAX_FRAMES },
  });
  return { ...main, elements: [...main.elements, ...framed].slice(0, MAX_ELEMENTS) };
}

export async function safeSnapshot(page: Page, options: PageSnapshotOptions = {}): Promise<PageSnapshot | null> {
  try {
    return await snapshotPage(page, options);
  } catch {
    return null;
  }
}

async function snapshotFrame(frame: Frame): Promise<PageSnapshot> {
  await ensureRuntimeHelpers(frame);
  return frame.evaluate(collectInPage);
}

async function collectChildFrames(parent: Frame, walk: FrameWalk): Promise<CollectedElement[]> {
  if (walk.depth >= MAX_FRAME_DEPTH) return [];
  const collected: CollectedElement[] = [];
  for (const child of parent.childFrames()) {
    if (walk.budget.remaining <= 0) break;
    if (!walk.isAllowed(child.url())) continue;
    const address = await frameAddress(child);
    if (!address) continue;
    walk.budget.remaining -= 1;

    const prefix = `${walk.prefix}${address}${FRAME_BOUNDARY}`;
    const snapshot = await snapshotFrame(child).catch(() => null);
    if (!snapshot) continue;
    collected.push(...snapshot.elements.map((element) => inFrame(element, prefix)));
    collected.push(...(await collectChildFrames(child, { ...walk, prefix, depth: walk.depth + 1 })));
  }
  return collected;
}

function inFrame(element: CollectedElement, prefix: string): CollectedElement {
  // XPath cannot cross into a frame; the prefixed CSS selector is the address.
  return { ...element, cssSelector: `${prefix}${element.cssSelector}`, xpath: "" };
}

/** Selector of the <iframe> element, evaluated in its parent's document. */
async function frameAddress(frame: Frame): Promise<string | null> {
  const handle = await frame.frameElement().catch(() => null);
  if (!handle) return null;
  try {
    return await handle.evaluate(frameElementSelector);
  } catch {
    return null;
  } finally {
    await handle.dispose().catch(() => undefined);
  }
}

/** Runs in the page: must stay self-contained. */
function frameElementSelector(element: Element): string {
  const local = (node: Element): string => {
    const tag = node.tagName.toLowerCase();
    const id = node.getAttribute("id");
    if (id && /^[A-Za-z][\w-]*$/.test(id)) return `${tag}#${id}`;
    for (const attribute of ["name", "title", "data-testid"]) {
      const value = node.getAttribute(attribute);
      if (value) return `${tag}[${attribute}="${value.replace(/["\\]/g, "\\$&")}"]`;
    }
    const root = node.getRootNode() as Document | ShadowRoot;
    return `${tag} >> nth=${Array.from(root.querySelectorAll(tag)).indexOf(node)}`;
  };
  const chain = (node: Element): string => {
    const root = node.getRootNode();
    return root instanceof ShadowRoot ? `${chain(root.host)} >> ${local(node)}` : local(node);
  };
  return chain(element);
}

/** `about:blank`/`about:srcdoc` frames inherit their parent's origin. */
export function sameOriginAs(pageUrl: string): (url: string) => boolean {
  const origin = originOf(pageUrl);
  return (url) => url.startsWith("about:") || (origin !== null && originOf(url) === origin);
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
