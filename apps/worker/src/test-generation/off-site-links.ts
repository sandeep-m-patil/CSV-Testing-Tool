import { and, eq } from "drizzle-orm";
import { discoveredActions } from "@repo/db/schema";
import type { DiscoveryContext } from "../discovery/runner";
import { isInScope } from "../discovery/scope";
import type { DiscoveredControl } from "./fields";

/**
 * Link captions on a page that lead outside the module scope (a footer
 * "Powered by", social links). Generated cases must not test someone else's
 * site, so those links are dropped before scenarios are built.
 */
export async function offSiteLinkCaptions(ctx: DiscoveryContext, pageId: string): Promise<Set<string>> {
  const rows = await ctx.db
    .select({ target: discoveredActions.target })
    .from(discoveredActions)
    .where(and(eq(discoveredActions.pageId, pageId), eq(discoveredActions.action, "NAVIGATE")));

  const captions = new Set<string>();
  for (const { target } of rows) {
    const link = target as { url?: string; text?: string; name?: string };
    if (!link.url || isInScope(ctx.scope, link.url)) continue;
    for (const caption of [link.text, link.name]) if (caption) captions.add(caption.trim());
  }
  return captions;
}

export function withoutOffSiteLinks(controls: DiscoveredControl[], offSite: Set<string>): DiscoveredControl[] {
  if (offSite.size === 0) return controls;
  return controls.filter((control) => {
    const isLink = ["a", "link"].includes(control.elementType.toLowerCase());
    return !isLink || !offSite.has((control.text ?? control.label ?? "").trim());
  });
}
