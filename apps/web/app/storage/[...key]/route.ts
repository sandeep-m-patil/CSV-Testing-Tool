/**
 * Legacy public path for evidence. It shares the authorized handler so there is
 * exactly one place that decides who may read a screenshot.
 */
export const runtime = "nodejs";
export { GET } from "@/app/api/storage/[...key]/route";
