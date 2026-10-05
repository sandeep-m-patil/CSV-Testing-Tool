import { and, asc, eq } from "drizzle-orm";
import { discoveredActions, discoveredElements, type DiscoveredPageRow } from "@repo/db/schema";
import type { Db } from "@repo/db";
import type { AiElement, AiPageContext } from "@repo/schemas";

const MAX_ELEMENTS = 200;
const MAX_LABEL_LENGTH = 200;

/**
 * Rebuilds the structured page context an AI provider expects from the rows
 * discovery already stored, rather than from the request body.
 *
 * Selectors, xpaths and aria attributes are deliberately omitted: the model is
 * asked to describe intent, never to choose what to click. Values that look like
 * credentials are additionally stripped by `sanitizePageContext` before sending.
 */
export async function buildPageContext(
  db: Db,
  page: Pick<DiscoveredPageRow, "id" | "url" | "title" | "name" | "pageType">,
): Promise<AiPageContext> {
  const rows = await db
    .select({
      elementType: discoveredElements.elementType,
      role: discoveredElements.role,
      name: discoveredElements.name,
      text: discoveredElements.text,
      placeholder: discoveredElements.placeholder,
      label: discoveredElements.label,
      visible: discoveredElements.visible,
    })
    .from(discoveredElements)
    .where(and(eq(discoveredElements.pageId, page.id), eq(discoveredElements.visible, true)))
    .orderBy(asc(discoveredElements.createdAt))
    .limit(MAX_ELEMENTS);

  const elements: AiElement[] = rows.map((row) => ({
    elementType: row.elementType,
    role: row.role ?? undefined,
    name: truncate(row.name),
    text: truncate(row.text),
    placeholder: truncate(row.placeholder),
    label: truncate(row.label),
  }));

  return {
    url: page.url,
    title: truncate(page.title) ?? page.name.slice(0, MAX_LABEL_LENGTH),
    pageType: page.pageType,
    elements,
  };
}

/** Distinct action types observed on a page, used for coverage reporting. */
export async function listPageActionTypes(db: Db, pageId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: discoveredActions.action })
    .from(discoveredActions)
    .where(eq(discoveredActions.pageId, pageId));
  return rows.map((row) => row.action);
}

function truncate(value: string | null): string | undefined {
  if (value === null) return undefined;
  return value.slice(0, MAX_LABEL_LENGTH);
}