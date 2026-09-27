import { desc, eq, and, like, type SQL } from "drizzle-orm";
import { projects } from "@repo/db/schema";
import { CreateProjectInputSchema } from "@repo/schemas";
import { created, ok, parseBody, route } from "@/lib/api";
import { assertSameOrigin } from "@/lib/csrf";
import { requireSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";

export const GET = route(async (request) => {
  const session = await requireSession();
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? null;
  const page = Number(url.searchParams.get("page") ?? "1");
  const perPage = Math.min(Number(url.searchParams.get("perPage") ?? "20"), 100);

  const conditions: SQL[] = [eq(projects.createdBy, session.userId)];
  if (search && search.trim().length > 0) {
    conditions.push(like(projects.name, `%${search.trim()}%`));
  }

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.updatedAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ count: projects.id })
      .from(projects)
      .where(and(...conditions)),
  ]);

  return ok({ projects: rows }, { total: totalRow.length ?? 0, page, perPage });
});

export const POST = route(async (request) => {
  assertSameOrigin(request);
  const session = await requireSession();
  const input = CreateProjectInputSchema.parse(await parseBody(request));

  const [project] = await db
    .insert(projects)
    .values({ name: input.name, description: input.description || null, createdBy: session.userId })
    .returning();

  return created({ project });
});