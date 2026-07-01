"use client";

/**
 * Client-side filters. Because the analytics are derived from bulk list
 * endpoints (which don't accept arbitrary date/segment filters), filtering is
 * applied in the browser to already-fetched rows. The exam filter is the one
 * exception — some ranking endpoints accept `exam_type`, so sections pass it
 * server-side when relevant.
 */

import { CalendarRange, Filter, X } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";
import { istParts, type AnalyticsUser } from "@/lib/api/analytics";

export interface Filters {
    from: string; // "YYYY-MM-DD" or ""
    to: string; // "YYYY-MM-DD" or ""
    examType: string; // "" = all
    classId: string; // "" = all
    batch: string; // "" = all
}

export const EMPTY_FILTERS: Filters = { from: "", to: "", examType: "", classId: "", batch: "" };

export function hasActiveFilters(f: Filters): boolean {
    return Boolean(f.from || f.to || f.examType || f.classId || f.batch);
}

/** True if `dateKey` (YYYY-MM-DD) falls within [from, to], treating blanks as open-ended. */
export function inDateRange(dateKey: string, from: string, to: string): boolean {
    if (from && dateKey < from) return false;
    if (to && dateKey > to) return false;
    return true;
}

/** Whether a user passes the current filters. Date filter applies to registration date. */
export function matchUser(u: AnalyticsUser, f: Filters): boolean {
    if (f.classId && u.class_id !== f.classId) return false;
    if (f.batch && (u.batch ?? "") !== f.batch) return false;
    if (f.examType && !(u.target_exams ?? []).includes(f.examType)) return false;
    if (f.from || f.to) {
        const p = istParts(u.created_at);
        if (!p || !inDateRange(p.dateKey, f.from, f.to)) return false;
    }
    return true;
}

export function FilterBar({
    filters,
    onChange,
    classOptions,
    batchOptions,
}: {
    filters: Filters;
    onChange: (f: Filters) => void;
    classOptions: { label: string; value: string }[];
    batchOptions: { label: string; value: string }[];
}) {
    const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
    const active = hasActiveFilters(filters);

    return (
        <div className="glass-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Filter className="h-4 w-4 text-brand-500" />
                Filters
                {active && (
                    <button
                        onClick={() => onChange(EMPTY_FILTERS)}
                        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <X className="h-3 w-3" />
                        Clear all
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <CalendarRange className="h-3 w-3" /> From
                    </span>
                    <input
                        type="date"
                        value={filters.from}
                        max={filters.to || undefined}
                        onChange={e => set({ from: e.target.value })}
                        className="rounded-xl bg-foreground/5 border border-(--card-border) px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <CalendarRange className="h-3 w-3" /> To
                    </span>
                    <input
                        type="date"
                        value={filters.to}
                        min={filters.from || undefined}
                        onChange={e => set({ to: e.target.value })}
                        className="rounded-xl bg-foreground/5 border border-(--card-border) px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                </label>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Exam</span>
                    <CustomSelect
                        value={filters.examType}
                        onChange={v => set({ examType: v })}
                        options={[{ label: "All Exams", value: "" }, ...EXAM_TYPE_OPTIONS]}
                        placeholder="All Exams"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Class</span>
                    <CustomSelect
                        value={filters.classId}
                        onChange={v => set({ classId: v })}
                        options={[{ label: "All Classes", value: "" }, ...classOptions]}
                        placeholder="All Classes"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Batch</span>
                    <CustomSelect
                        value={filters.batch}
                        onChange={v => set({ batch: v })}
                        options={[{ label: "All Batches", value: "" }, ...batchOptions]}
                        placeholder="All Batches"
                    />
                </div>
            </div>
        </div>
    );
}
