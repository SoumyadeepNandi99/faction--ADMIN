"use client";

/**
 * Segmentation controls for the Founder Analytics dashboard.
 *
 * Unlike the previous version (which filtered already-fetched rows in the
 * browser), these filters are pushed to the server: they become query params on
 * every `/api/analytics/*` call, so the SQL itself scopes by date range, class,
 * target exam(s) and subscription type. Changing a control refetches the
 * affected metric groups via SWR.
 */

import { CalendarRange, Filter, X } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { CustomMultiSelect } from "@/components/ui/custom-multi-select";
import { EXAM_TYPE_OPTIONS, SUBSCRIPTION_OPTIONS, hasActiveFilters, type Filters } from "@/lib/api/analytics";

export { EMPTY_FILTERS, hasActiveFilters, type Filters } from "@/lib/api/analytics";

export function FilterBar({
    filters,
    onChange,
    classOptions,
}: {
    filters: Filters;
    onChange: (f: Filters) => void;
    classOptions: { label: string; value: string }[];
}) {
    const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
    const active = hasActiveFilters(filters);

    return (
        <div className="glass-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Filter className="h-4 w-4 text-brand-500" />
                Filters
                <span className="text-xs font-normal text-muted-foreground">— applied in SQL (IST)</span>
                {active && (
                    <button
                        onClick={() => onChange({ from: "", to: "", classId: "", examTypes: [], subscriptionType: "" })}
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
                    <span className="text-xs text-muted-foreground">Class</span>
                    <CustomSelect
                        value={filters.classId}
                        onChange={v => set({ classId: v })}
                        options={[{ label: "All Classes", value: "" }, ...classOptions]}
                        placeholder="All Classes"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Target Exam</span>
                    <CustomMultiSelect
                        value={filters.examTypes}
                        onChange={v => set({ examTypes: v })}
                        options={EXAM_TYPE_OPTIONS}
                        placeholder="All Exams"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Subscription</span>
                    <CustomSelect
                        value={filters.subscriptionType}
                        onChange={v => set({ subscriptionType: v })}
                        options={[{ label: "All Plans", value: "" }, ...SUBSCRIPTION_OPTIONS]}
                        placeholder="All Plans"
                    />
                </div>
            </div>
        </div>
    );
}
