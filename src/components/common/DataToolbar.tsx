import { useMemo, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Toolbar({
  query,
  onQuery,
  placeholder = "ค้นหา...",
  filters,
  right,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder?: string;
  filters?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="h-9 rounded-xl pl-9"
        />
      </div>
      {filters}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  icon = true,
  className = "w-[150px]",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
  icon?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 rounded-xl ${className}`}>
        {icon && <SlidersHorizontal className="size-3.5 text-muted-foreground" />}
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-left font-medium transition-colors hover:text-foreground"
    >
      {label}
      <ArrowUpDown
        className={`size-3 transition-opacity ${active ? "opacity-100 text-primary" : "opacity-40"}`}
      />
      {active && <span className="sr-only">{dir}</span>}
    </button>
  );
}

export function usePagination<T>(items: T[], perPage = 8) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, pages);
  const slice = useMemo(
    () => items.slice((current - 1) * perPage, current * perPage),
    [items, current, perPage],
  );
  return { page: current, pages, slice, setPage, total: items.length, perPage };
}

export function Pagination({
  page,
  pages,
  total,
  perPage,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
      <span>
        แสดง {from}–{to} จาก {total} รายการ
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-lg"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .map((p, idx, arr) => (
            <span key={p} className="flex items-center gap-1">
              {idx > 0 && (arr[idx - 1] ?? 0) < p - 1 && <span className="px-1">…</span>}
              <Button
                variant={p === page ? "default" : "outline"}
                size="icon"
                className="size-8 rounded-lg text-xs"
                onClick={() => onPage(p)}
              >
                {p}
              </Button>
            </span>
          ))}
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-lg"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
