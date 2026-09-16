import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / Math.max(pageSize, 1)));
  if (!total) {
    return null;
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500 font-semibold">
      <div>
        Showing {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </button>
        <span className="px-2 tabular-nums">Page {page} of {totalPages}</span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
