"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
    ArrowLeft, Clock, Calendar, Award, ListChecks, Users, BookOpen,
    Search, Eye, RefreshCw, Trophy, GraduationCap, X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { formatDateTime } from "@/lib/datetime";
import {
    findContestById, getContestQuestionsFull, getContestRanking,
    type Contest, type ContestQuestionDetail, type ContestRankingResponse,
} from "@/lib/api/contests";
import { QuestionPreview } from "@/components/contest/question-preview";

const statusLabel: Record<string, string> = { active: "Live", not_started: "Upcoming", finished: "Concluded" };
const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20",
    not_started: "bg-foreground/10 text-muted-foreground border border-(--card-border)",
    finished: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20",
};

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="glass-card p-4 flex items-center gap-3">
            <div className="p-2.5 bg-foreground/5 rounded-xl border border-(--card-border) text-muted-foreground">{icon}</div>
            <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground">{value}</p>
            </div>
        </div>
    );
}

export default function ContestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const contestId = params.contestId as string;

    // Contest metadata (no GET /contests/{id} on the backend — locate via the lists).
    const { data: contest, error: contestError, isLoading: contestLoading } = useSWR<Contest | null>(
        contestId ? `contest-meta:${contestId}` : null,
        () => findContestById(contestId),
    );

    // Full question list for the contest.
    const { data: questions, error: qError, isLoading: qLoading, mutate: refetchQuestions } = useSWR<ContestQuestionDetail[]>(
        contestId ? `contest-questions:${contestId}` : null,
        () => getContestQuestionsFull(contestId),
    );

    const isPast = contest?.status === "finished";

    // Leaderboard / ranking — only meaningful for past contests. Scoped to admin's
    // class on the backend, so it may legitimately be empty.
    const { data: ranking } = useSWR<ContestRankingResponse | null>(
        contestId && isPast ? `contest-ranking:${contestId}` : null,
        () => getContestRanking(contestId, { limit: 10 }).catch(() => null),
    );

    // --- Filters ---
    // NOTE: the contest-questions endpoint returns subject + topic but NOT chapter,
    // so chapter-level filtering isn't offered here (would require a backend change).
    const [search, setSearch] = useState("");
    const [subjectFilter, setSubjectFilter] = useState("");
    const [difficultyFilter, setDifficultyFilter] = useState("");
    const [previewMode, setPreviewMode] = useState<"admin" | "student">("admin");

    const subjectOptions = useMemo(() => {
        const map = new Map<string, string>();
        (questions || []).forEach(q => { if (q.subject_id && q.subject_name) map.set(q.subject_id, q.subject_name); });
        return [{ label: "All subjects", value: "" }, ...Array.from(map, ([value, label]) => ({ label, value }))];
    }, [questions]);

    const difficultyOptions = [
        { label: "All difficulties", value: "" },
        { label: "Easy", value: "1" },
        { label: "Medium", value: "2" },
        { label: "Hard", value: "3" },
    ];

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (questions || []).filter(q => {
            if (subjectFilter && q.subject_id !== subjectFilter) return false;
            if (difficultyFilter && String(q.difficulty) !== difficultyFilter) return false;
            if (term && !q.question_text.toLowerCase().includes(term)) return false;
            return true;
        });
    }, [questions, search, subjectFilter, difficultyFilter]);

    const totalMarks = useMemo(() => (questions || []).reduce((s, q) => s + (q.marks || 0), 0), [questions]);
    const marksPerQ = useMemo(() => {
        const set = new Set((questions || []).map(q => q.marks));
        return set.size === 1 ? [...set][0] : null; // uniform marking scheme?
    }, [questions]);

    // ---- Loading / error / not-found ----
    if (contestLoading) {
        return (
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-28 w-full rounded-2xl" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                </div>
            </div>
        );
    }

    if (contestError || (!contest && !contestLoading)) {
        return (
            <div className="p-6 max-w-6xl mx-auto">
                <button onClick={() => router.push("/assessments")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
                    <ArrowLeft className="h-4 w-4" /> Back to contests
                </button>
                <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 text-destructive/50" />
                    <h3 className="text-lg font-bold">Contest not found</h3>
                    <p className="text-sm text-muted-foreground">It may have been removed, or it isn&apos;t visible to your class/exam scope.</p>
                </div>
            </div>
        );
    }

    if (!contest) return null;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Back + read-only badge */}
            <div className="flex items-center justify-between">
                <button onClick={() => router.push("/assessments")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Back to contests
                </button>
                <span className="text-xs px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground border border-(--card-border)">
                    {isPast ? "Read-only overview" : "Read-only details"}
                </span>
            </div>

            {/* Header */}
            <div className="glass-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-foreground">{contest.name}</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[contest.status] || ""}`}>
                                {statusLabel[contest.status] || contest.status}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">{contest.exam_type}</p>
                        {contest.description
                            ? <p className="text-sm text-muted-foreground mt-3 max-w-3xl">{contest.description}</p>
                            : <p className="text-sm text-muted-foreground/60 italic mt-3">No description</p>}
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-x-8 gap-y-2 mt-5 text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" /> {isPast ? "Conducted" : "Starts"}: <span className="text-foreground font-medium">{formatDateTime(contest.starts_at)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" /> Ends: <span className="text-foreground font-medium">{formatDateTime(contest.ends_at)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" /> Duration: <span className="text-foreground font-medium">{Math.round(contest.total_time / 60)} mins</span>
                    </span>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<ListChecks className="h-5 w-5" />} label="Total questions" value={qLoading ? "…" : (questions?.length ?? 0)} />
                <StatCard icon={<Award className="h-5 w-5" />} label="Total marks" value={qLoading ? "…" : totalMarks} />
                <StatCard
                    icon={<GraduationCap className="h-5 w-5" />}
                    label="Marking scheme"
                    value={qLoading ? "…" : marksPerQ !== null ? `+${marksPerQ} / question` : "Mixed"}
                />
                <StatCard
                    icon={<Users className="h-5 w-5" />}
                    label="Participants"
                    value={isPast ? (ranking?.total ?? 0) : "—"}
                />
            </div>

            {/* Leaderboard summary (past contests) */}
            {isPast && ranking && ranking.users.length > 0 && (
                <div className="glass-card p-6">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-4">
                        <Trophy className="h-5 w-5 text-yellow-500" /> Leaderboard
                        <span className="text-xs font-normal text-muted-foreground">(top {ranking.users.length} of {ranking.total})</span>
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground border-b border-(--card-border)">
                                    <th className="py-2 pr-4 font-medium">Rank</th>
                                    <th className="py-2 pr-4 font-medium">Name</th>
                                    <th className="py-2 pr-4 font-medium text-right">Score</th>
                                    <th className="py-2 pr-4 font-medium text-right">Accuracy</th>
                                    <th className="py-2 font-medium text-right">Rating Δ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranking.users.map(u => (
                                    <tr key={u.user_id} className="border-b border-(--card-border)/50 last:border-0">
                                        <td className="py-2.5 pr-4 font-bold text-foreground">#{u.rank}</td>
                                        <td className="py-2.5 pr-4 text-foreground">{u.user_name}</td>
                                        <td className="py-2.5 pr-4 text-right text-foreground font-medium">{u.score}</td>
                                        <td className="py-2.5 pr-4 text-right text-muted-foreground">{Math.round(u.accuracy)}%</td>
                                        <td className={`py-2.5 text-right font-medium ${u.rating_delta > 0 ? "text-green-500" : u.rating_delta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                            {u.rating_delta > 0 ? "+" : ""}{u.rating_delta}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Questions section */}
            <div className="glass-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                        <BookOpen className="h-5 w-5" /> Questions
                        <span className="text-sm font-normal text-muted-foreground">
                            {filtered.length}{questions && filtered.length !== questions.length ? ` of ${questions.length}` : ""}
                        </span>
                    </h2>
                    {/* Admin <-> student preview toggle */}
                    <div className="flex rounded-xl border border-(--card-border) overflow-hidden text-xs">
                        <button
                            onClick={() => setPreviewMode("admin")}
                            className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${previewMode === "admin" ? "bg-brand-600 text-white" : "text-muted-foreground hover:bg-foreground/5"}`}>
                            <Eye className="h-3.5 w-3.5" /> Admin view
                        </button>
                        <button
                            onClick={() => setPreviewMode("student")}
                            className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${previewMode === "student" ? "bg-brand-600 text-white" : "text-muted-foreground hover:bg-foreground/5"}`}>
                            <GraduationCap className="h-3.5 w-3.5" /> Student preview
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                    <div className="relative md:col-span-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search questions…"
                            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-background border border-(--input) text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <CustomSelect options={subjectOptions} value={subjectFilter} onChange={setSubjectFilter} placeholder="Subject" />
                    <CustomSelect options={difficultyOptions} value={difficultyFilter} onChange={setDifficultyFilter} placeholder="Difficulty" />
                </div>

                {/* List */}
                {qLoading ? (
                    <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
                ) : qError ? (
                    <div className="text-center py-10 flex flex-col items-center gap-3">
                        <RefreshCw className="h-7 w-7 text-destructive/50" />
                        <p className="text-sm text-muted-foreground">Failed to load questions.</p>
                        <button onClick={() => refetchQuestions()} className="text-sm text-brand-600 hover:underline">Retry</button>
                    </div>
                ) : (questions?.length ?? 0) === 0 ? (
                    <div className="text-center py-10 flex flex-col items-center gap-2">
                        <ListChecks className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">This contest has no questions.</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-10 flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No questions match your filters.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map((q, i) => (
                            <QuestionPreview key={q.id} question={q} index={i + 1} mode={previewMode} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
