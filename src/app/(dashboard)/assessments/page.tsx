"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Award, Plus, Calendar, Clock, Sparkles, BookOpen, RefreshCw, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listContestsForAdmin, type Contest } from "@/lib/api/contests";
import { formatDateTime } from "@/lib/datetime";

const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20",
    not_started: "bg-foreground/10 text-muted-foreground",
    finished: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
};
const statusLabel: Record<string, string> = { active: "Live", not_started: "Upcoming", finished: "Concluded" };

export default function AssessmentsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

    // List ALL contests (across every class/exam) via the admin endpoint, which
    // falls back to the scoped lists automatically if it isn't deployed yet.
    const swrKey = `admin-contests:${activeTab}`;
    const { data, isLoading: loading, error, mutate } = useSWR(swrKey, () =>
        listContestsForAdmin({ type: activeTab, limit: 200 }).then(r => r.contests)
    );
    const contests: Contest[] = data || [];

    const getTypeIcon = (type: string) => {
        if (type?.includes("NEET")) return <Sparkles className="h-5 w-5 text-green-500" />;
        if (type?.includes("ADVANCED")) return <Award className="h-5 w-5 text-accent-purple" />;
        return <BookOpen className="h-5 w-5 text-brand-500" />;
    };

    return (
        <>
            <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Assessments & Contests</h1>
                        <p className="text-muted-foreground">Create, schedule, and manage competitive contests for students.</p>
                    </div>
                    <button onClick={() => router.push("/assessments/create")}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer">
                        <Plus className="h-4 w-4" /> Create Contest
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 glass-card p-1 w-fit rounded-xl">
                    {(["upcoming", "past"] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === tab ? "bg-brand-500 text-white shadow-sm shadow-brand-500/20" : "text-muted-foreground hover:text-foreground"}`}>
                            {tab === "upcoming" ? "Upcoming / Live" : "Past Contests"}
                        </button>
                    ))}
                    <button onClick={() => mutate()} className="p-2 ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="glass-card p-6 flex flex-col gap-4">
                                <div className="flex justify-between"><Skeleton className="h-12 w-48" /><Skeleton className="h-6 w-20 rounded-full" /></div>
                                <Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-full" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    /* Fix #2: distinct error state */
                    <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
                        <RefreshCw className="h-8 w-8 text-destructive/50" />
                        <h3 className="text-lg font-bold text-foreground">Failed to Load Contests</h3>
                        <p className="text-muted-foreground text-sm">Could not fetch contests from the server.</p>
                        <button onClick={() => mutate()}
                            className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                            Retry
                        </button>
                    </div>
                ) : contests.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <Award className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No Contests Found</h3>
                        <p className="text-muted-foreground mt-1 text-sm">Create a contest to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {contests.map(c => (
                            <div
                                key={c.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => router.push(`/assessments/${c.id}`)}
                                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/assessments/${c.id}`); } }}
                                className="glass-card flex flex-col p-6 relative overflow-hidden group cursor-pointer hover:border-brand-500/40 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition-colors"
                            >
                                {c.status === "active" && <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full pointer-events-none" />}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-foreground/5 rounded-xl border border-(--panel-border)">{getTypeIcon(c.exam_type)}</div>
                                        <div>
                                            <h3 className="font-bold text-lg text-foreground group-hover:text-brand-500 transition-colors line-clamp-1">{c.name}</h3>
                                            <p className="text-xs text-muted-foreground font-mono">{c.exam_type}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${statusColors[c.status] || ""}`}>
                                            {c.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                                            {statusLabel[c.status] || c.status}
                                        </span>
                                        {/* Fix #8: has_attempted badge */}
                                        {c.has_attempted && (
                                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                                                <CheckCircle2 className="h-3.5 w-3.5" /> Attempted
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {c.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{c.description}</p>}
                                <div className="grid grid-cols-2 gap-4 mb-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-foreground font-medium">{Math.round(c.total_time / 60)} mins</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-foreground font-medium">{formatDateTime(c.starts_at)}</span>
                                    </div>
                                </div>
                                {/* Fix #3: show ends_at (IST) */}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Ends {formatDateTime(c.ends_at)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </>
    );
}
