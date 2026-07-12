"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Trophy, Users, Target, AlertTriangle, Search, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { fetchLegendsProgress, AnalyticsFetchError, type LegendsProgressRow } from "@/lib/api/analytics";
import { SquadModal } from "@/components/legends/squad-modal";

const STREAM_OPTIONS = [
    { label: "All streams", value: "" },
    { label: "JEE (target 300)", value: "JEE" },
    { label: "NEET (target 600)", value: "NEET" },
    { label: "Foundation (target 400)", value: "FOUNDATION" },
];

const STREAM_BADGE: Record<string, string> = {
    JEE: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
    NEET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    FOUNDATION: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export default function LegendsPage() {
    const [stream, setStream] = useState("");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<LegendsProgressRow | null>(null);

    const { data, error, isLoading } = useSWR(
        `analytics:legends:${stream || "all"}`,
        () => fetchLegendsProgress(stream),
        { revalidateOnFocus: false, shouldRetryOnError: false },
    );

    const errText =
        error instanceof AnalyticsFetchError
            ? error.code === "not_configured"
                ? "Legends progress needs the analytics DB connection (ANALYTICS_DATABASE_URL). It isn't configured on the server yet."
                : error.detail || "Couldn't load Legends progress."
            : error
              ? "Couldn't load Legends progress."
              : null;

    const rows: LegendsProgressRow[] = data ?? [];

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r => (r.name ?? "").toLowerCase().includes(q));
    }, [rows, search]);

    const summary = useMemo(() => {
        const participants = rows.length;
        const totalSolves = rows.reduce((a, r) => a + r.progress, 0);
        const completed = rows.filter(r => r.progress >= r.target).length;
        return { participants, totalSolves, completed };
    }, [rows]);

    return (
        <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
                    <Trophy className="h-7 w-7 text-brand-500" /> Legends Progress
                </h1>
                <p className="text-muted-foreground text-sm">
                    Each student&apos;s Faction Legends World Cup progress — correct questions solved
                    since the challenge launched, scoped to their stream (JEE&nbsp;→&nbsp;P+C+M,
                    NEET&nbsp;→&nbsp;P+C+B, Foundation&nbsp;→&nbsp;all four).
                </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-brand-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground">{isLoading ? "—" : summary.participants.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Participants{stream ? ` · ${stream}` : ""}</div>
                    </div>
                </div>
                <div className="glass-card p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                        <Target className="h-5 w-5 text-brand-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground">{isLoading ? "—" : summary.totalSolves.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Total solves this challenge</div>
                    </div>
                </div>
                <div className="glass-card p-5 flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                        <Trophy className="h-5 w-5 text-brand-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground">{isLoading ? "—" : summary.completed.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Completed their XI (hit target)</div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-56">
                    <CustomSelect value={stream} onChange={setStream} options={STREAM_OPTIONS} />
                </div>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search students by name…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-foreground/5 border border-(--input) rounded-lg pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="glass-card p-0 overflow-hidden">
                {errText ? (
                    <div className="flex items-start gap-2 m-4 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-3 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{errText}</span>
                    </div>
                ) : isLoading ? (
                    <div className="p-4 flex flex-col gap-3">
                        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground">
                        {rows.length === 0 ? "No students have made progress in this challenge yet." : "No students match your search."}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground border-b border-(--panel-border)">
                                    <th className="px-4 py-3 font-medium w-12">#</th>
                                    <th className="px-4 py-3 font-medium">Student</th>
                                    <th className="px-4 py-3 font-medium">Class</th>
                                    <th className="px-4 py-3 font-medium">Stream</th>
                                    <th className="px-4 py-3 font-medium">Progress</th>
                                    <th className="px-4 py-3 font-medium w-56">Toward target</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r, i) => (
                                    <tr
                                        key={r.userId}
                                        onClick={() => setSelected(r)}
                                        className="border-b border-(--panel-border) last:border-0 hover:bg-brand-500/[0.06] transition-colors cursor-pointer"
                                        title="View squad"
                                    >
                                        <td className="px-4 py-3 text-muted-foreground font-mono">{i + 1}</td>
                                        <td className="px-4 py-3 font-medium text-brand-600 dark:text-brand-400 hover:underline">{r.name || "Unknown"}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{r.className ? `Class ${r.className}` : "—"}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STREAM_BADGE[r.stream] ?? "bg-foreground/10 text-muted-foreground"}`}>
                                                {r.stream === "FOUNDATION" ? "Foundation" : r.stream}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-foreground">{r.progress.toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2 rounded-full bg-foreground/10 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${r.progress >= r.target ? "bg-emerald-500" : "bg-brand-500"}`}
                                                        style={{ width: `${r.pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap w-20 text-right">
                                                    {r.progress} / {r.target}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Methodology note — be transparent about the reconstruction. */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground/80">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                    Progress = correct solves in the student&apos;s stream subjects since the event went
                    live. The in-app bar counts from the moment each student first opened the event
                    (a per-device value the backend doesn&apos;t store); since the event only became
                    reachable at launch, this matches what students see almost exactly. Tap any student
                    to see their exact Dream XI (unlocked &amp; locked cards).
                </span>
            </div>

            {selected && <SquadModal row={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}
