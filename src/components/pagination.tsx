"use client";

import { useLocale } from "./locale-provider";

export const PAGE_SIZES = [10, 30, 50, 100, 200] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

interface PaginationProps {
  total: number;
  page: number; // 1-based
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const { t } = useLocale();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startItem = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, total);

  // Page range: show first, last, current ±1, and ellipses
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (safePage > 3) pages.push("...");
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 py-2">
      <div className="flex items-center gap-3 text-[12px] text-text-secondary">
        <span>
          {t("pagination.showing", { from: startItem, to: endItem, total })}
        </span>
        <span className="text-text-muted">·</span>
        <label className="flex items-center gap-1.5">
          {t("pagination.per_page")}
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="border border-border rounded px-1.5 h-[26px] text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="h-7 w-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-[12px] text-text-muted">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`h-7 min-w-[28px] px-2 rounded-md text-[12px] font-medium transition-colors ${
                  p === safePage
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-surface hover:text-text-primary"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="h-7 w-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// Helper hook-like utility: slice array based on page state
export function paginate<T>(items: T[], page: number, pageSize: PageSize): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
