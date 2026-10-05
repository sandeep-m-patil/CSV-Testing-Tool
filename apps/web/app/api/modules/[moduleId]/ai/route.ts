import { asc, eq } from "drizzle-orm";
import { discoveredPages, stateTransitions, uiStates } from "@repo/db/schema";
import { AppError } from "@repo/core";
import { AiPageContextSchema } from "@repo/schemas";
import { sanitizePageContext } from "@repo/ai";
import { ok, parseBody, route } from "@/lib/api";
import { requireSession } from "@/lib/auth/get-session";
import { requireModuleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createWebAIProvider, describeAIConfig } from "@/lib/ai";
import { buildPageContext } from "@/lib/ai-context";

type Params = { params: Promise<Record<string, string>> };

/**
 * Application Model and AI status for a module: every discovered page with its
 * route pattern, role and recorded AI intent, plus which provider is in use.
 * Never returns a key, only whether the selected provider is configured.
 */
export const GET = route(async (_request, context: Params) => {
  const session = await requireSession();
  const routeParams = await context.params;
  const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const [pages, states, transitions] = await Promise.all([
    db
      .select({
        id: discoveredPages.id,
        name: discoveredPages.name,
        url: discoveredPages.url,
        routePattern: discoveredPages.routePattern,
        pageType: discoveredPages.pageType,
        role: discoveredPages.role,
        aiPageType: discoveredPages.aiPageType,
        aiPurpose: discoveredPages.aiPurpose,
        aiSource: discoveredPages.aiSource,
      })
      .from(discoveredPages)
      .where(eq(discoveredPages.moduleId, moduleId))
      .orderBy(asc(discoveredPages.order)),
    db
      .select({ id: uiStates.id, pageId: uiStates.pageId, name: uiStates.name, isModal: uiStates.isModal })
      .from(uiStates)
      .where(eq(uiStates.moduleId, moduleId)),
    db
      .select({
        fromPageId: stateTransitions.fromPageId,
        toPageId: stateTransitions.toPageId,
        label: stateTransitions.label,
      })
      .from(stateTransitions)
      .where(eq(stateTransitions.moduleId, moduleId)),
  ]);

  return ok({
    ai: describeAIConfig(getEnv()),
    applicationModel: { pages, uiStates: states, transitions },
  });
});

/**
 * Asks the configured model to interpret one discovered page.
 *
 * The page snapshot is rebuilt from what discovery already stored rather than
 * accepted from the caller, so the model only ever sees data this platform
 * collected itself, and the payload is redacted before it leaves the process.
 */
export const POST = route(async (request, routeContext: Params) => {
  const session = await requireSession();
  const routeParams = await routeContext.params;
  const moduleId = routeParams['moduleId']!;
  await requireModuleAccess(moduleId, session);

  const body = await parseBody(request);
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  if (pageId.length === 0) {
    throw new AppError("VALIDATION_ERROR", "pageId is required", 400);
  }

  const [page] = await db.select().from(discoveredPages).where(eq(discoveredPages.id, pageId)).limit(1);
  if (!page || page.moduleId !== moduleId) {
    throw new AppError("NOT_FOUND", "Discovered page not found", 404);
  }

  const ai = createWebAIProvider(getEnv());
  const pageContext = await buildPageContext(db, page);
  const validated = AiPageContextSchema.parse(pageContext);

  try {
    const interpretation = await ai.interpretPage(sanitizePageContext(validated));
    return ok({
      interpretation,
      source: ai.kind,
      providerLabel: ai.label,
      page: { id: page.id, name: page.name, url: page.url, routePattern: page.routePattern },
    });
  } catch (error) {
    // A provider outage must not look like a server bug to the caller.
    throw new AppError(
      "AI_UNAVAILABLE",
      `AI provider ${ai.kind} is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      503,
    );
  }
});