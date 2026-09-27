"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZES = [25, 50, 100, 200] as const;
/** Sentinel meaning "render every row on one page". */
export const PAGE_SIZE_ALL = 0;

type PageSize = (typeof PAGE_SIZES)[number] | typeof PAGE_SIZE_ALL;

export interface PaginationControls {
  page: number;
  setPage: (page: number) => void;
  pageSize: PageSize;
  setPageSize: (size: PageSize) => void;
  totalPages: number;
  totalRows: number;
  rangeStart: number;
  rangeEnd: number;
  pageSizeOptions: PageSize[];
}

function parsePageSize(value: string): PageSize {
  const parsed = Number.parseInt(value, 10);
  if (parsed === PAGE_SIZE_ALL) return PAGE_SIZE_ALL;
  return (PAGE_SIZES as readonly number[]).includes(parsed) ? (parsed as PageSize) : 25;
}

/**
 * Client-side pager. Rows are already fetched in one payload, so paging here
 * avoids a round trip while still keeping the DOM small enough to scroll.
 */
export function usePagination<T>(rows: T[], initialSize: PageSize = 25) {
  const [pageSize, setPageSizeState] = useState<PageSize>(initialSize);
  const [page, setPage] = useState(1);

  const totalPages = pageSize === PAGE_SIZE_ALL ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));

  // A filter change or a delete can shrink the result set under the current page.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = pageSize === PAGE_SIZE_ALL ? 0 : (page - 1) * pageSize;
  const end = pageSize === PAGE_SIZE_ALL ? rows.length : Math.min(start + pageSize, rows.length);
  const visible = useMemo(() => rows.slice(start, end), [rows, start, end]);

  function setPageSize(value: PageSize) {
    setPageSizeState(value);
    setPage(1);
  }

  return {
    visible,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalRows: rows.length,
    rangeStart: rows.length === 0 ? 0 : start + 1,
    rangeEnd: end,
    pageSizeOptions: [...PAGE_SIZES, PAGE_SIZE_ALL] as PageSize[],
  };
}

export function Pagination({
  page,
  setPage,
  totalPages,
  pageSize,
  setPageSize,
  pageSizeOptions,
  totalRows,
  rangeStart,
  rangeEnd,
}: PaginationControls) {
  if (totalRows === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm">
      <p className="text-muted-foreground">
        Showing <span className="tabular-nums text-foreground">{rangeStart}</span>–
        <span className="tabular-nums text-foreground">{rangeEnd}</span> of{" "}
        <span className="tabular-nums text-foreground">{totalRows}</span>
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-muted-foreground">
          Rows
          <select
            value={pageSize}
            onChange={(event) => setPageSize(parsePageSize(event.target.value))}
            aria-label="Rows per page"
            className="h-9 rounded-md border bg-card px-2 text-sm text-foreground"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option === PAGE_SIZE_ALL ? "All" : option}
              </option>
            ))}
          </select>
        </label>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              Prev
            </Button>
            <span className="px-2 tabular-nums text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
