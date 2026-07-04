"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { Award, Plus, Calendar, Clock, Loader2, Sparkles, BookOpen, RefreshCw, X, CheckCircle2, ListChecks, Eye, ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { createContest, getContestQuestionPool, getUsedQuestionIds, getPyqQuestionMap, getSubjectChapterMap, type Contest, type ContestStatus, type ExamType, type PoolQuestion, type PyqInfo, type ChapterRef } from "@/lib/api/contests";
import { formatDateTime } from "@/lib/datetime";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";
import { QuestionPreviewModal } from "@/components/question/question-preview-modal";

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; subject_type: string; class_id: string; }

const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20",
    not_started: "bg-foreground/10 text-muted-foreground",
    finished: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
};
const statusLabel: Record<string, string> = { active: "Live", not_started: "Upcoming", finished: "Concluded" };

const EMPTY_FORM = {
    name: "",
    description: "",
    class_id: "",
    exam_type: "JEE_MAINS" as ExamType,
    total_time: 180, // minutes (converted to seconds on submit)
    starts_at: "",
    status: "not_started" as ContestStatus,
};

// Fix #6: map tab to statuses that belong there
const TAB_STATUSES: Record<"upcoming" | "past", ContestStatus[]> = {
    upcoming: ["not_started", "active"],
    past: ["finished"],
};

export default function AssessmentsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    // Question id open in the full-detail preview (image, options, answer, solution).
    const [previewId, setPreviewId] = useState<string | null>(null);

    // Curriculum + subject-wise question selection
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [activeSubject, setActiveSubject] = useState("");
    const [pool, setPool] = useState<PoolQuestion[]>([]);
    const [poolLoading, setPoolLoading] = useState(false);
    // IDs of questions already used in any contest — filtered out of the pool so
    // a question is never offered for selection twice. Loaded when the modal opens.
    const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
    // selected[questionId] = true ; carries subject grouping for display
    const [selected, setSelected] = useState<Record<string, PoolQuestion>>({});
    // question_id -> PYQ details for every PYQ-tagged question (loaded on modal open).
    // The pool response has no PYQ flag, so we derive it client-side. Used to badge
    // and optionally hide PYQ questions in the pool.
    const [pyqMap, setPyqMap] = useState<Map<string, PyqInfo>>(new Map());
    // Chapter mapping for the active subject: chapters (for the filter dropdown) and
    // topic_id -> chapter (to label each question, since the pool carries only topic_id).
    const [chapters, setChapters] = useState<ChapterRef[]>([]);
    const [topicToChapter, setTopicToChapter] = useState<Map<string, ChapterRef>>(new Map());
    // Pool filters (chapter + PYQ). PYQ defaults to "hide" so previous-year questions
    // are kept out of contests unless the admin opts in.
    const [chapterFilter, setChapterFilter] = useState("");
    const [pyqFilter, setPyqFilter] = useState<"hide" | "only" | "all">("hide");

    const swrKey = `/api/v1/contests/?type=${activeTab}`;
    const { data, isLoading: loading, error, mutate } = useSWR(swrKey, (url: string) =>
        apiClient.get(url).then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : (d.contests || []);
        })
    );
    const contests: Contest[] = data || [];

    // Load classes when the modal opens
    useEffect(() => {
        if (!isModalOpen || classes.length) return;
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            setClasses(Array.isArray(d) ? d : (d.classes || []));
        }).catch(() => { });
    }, [isModalOpen, classes.length]);

    // Load the set of already-used question IDs when the modal opens, so the
    // pool can exclude questions that have already appeared in a contest.
    // Refreshed each time the modal opens to pick up contests created since.
    useEffect(() => {
        if (!isModalOpen) return;
        getUsedQuestionIds().then(setUsedIds).catch(() => setUsedIds(new Set()));
    }, [isModalOpen]);

    // Load the PYQ-tagged question map when the modal opens, so the pool can badge
    // and (by default) hide previous-year questions. Refreshed each open.
    useEffect(() => {
        if (!isModalOpen) return;
        getPyqQuestionMap().then(setPyqMap).catch(() => setPyqMap(new Map()));
    }, [isModalOpen]);

    // Load subjects when class or exam changes — subjects are scoped by BOTH
    // class_id AND exam_type, so both must be set and sent in the query.
    useEffect(() => {
        // Reset the per-subject question selection whenever class/exam changes.
        setActiveSubject("");
        setSelected({});
        if (!form.class_id || !form.exam_type) { setSubjects([]); return; }
        apiClient.get(`/api/v1/subjects/?class_id=${form.class_id}&exam_type=${form.exam_type}`).then(r => {
            const d = r.data;
            const list: SubjectOption[] = Array.isArray(d) ? d : (d.subjects || []);
            setSubjects(list);
            setActiveSubject(list[0]?.id || "");
        }).catch(() => { });
    }, [form.class_id, form.exam_type]);

    // Load the hidden question pool for the active subject, excluding any
    // question already used in a contest (usedIds). Re-runs when usedIds arrives.
    useEffect(() => {
        if (!activeSubject) { setPool([]); return; }
        setPoolLoading(true);
        getContestQuestionPool({ subject_id: activeSubject, limit: 100 })
            .then(res => setPool((res.questions || []).filter(q => !usedIds.has(q.id))))
            .catch(() => setPool([]))
            .finally(() => setPoolLoading(false));
    }, [activeSubject, usedIds]);

    // Load the chapter mapping for the active subject (chapters for the filter +
    // topic_id -> chapter for labelling). Reset the chapter filter when it changes.
    useEffect(() => {
        setChapterFilter("");
        if (!activeSubject) { setChapters([]); setTopicToChapter(new Map()); return; }
        getSubjectChapterMap(activeSubject)
            .then(({ chapters, topicToChapter }) => { setChapters(chapters); setTopicToChapter(topicToChapter); })
            .catch(() => { setChapters([]); setTopicToChapter(new Map()); });
    }, [activeSubject]);

    // Defensive: if the used-set arrives after something was already selected,
    // drop any now-known-used questions so they can't be submitted in the contest.
    useEffect(() => {
        if (!usedIds.size) return;
        setSelected(prev => {
            const next = Object.fromEntries(Object.entries(prev).filter(([id]) => !usedIds.has(id)));
            return Object.keys(next).length === Object.keys(prev).length ? prev : next;
        });
    }, [usedIds]);

    const toggleQuestion = (q: PoolQuestion) => {
        setSelected(prev => {
            const next = { ...prev };
            if (next[q.id]) delete next[q.id];
            else next[q.id] = q;
            return next;
        });
    };

    const selectedList = Object.values(selected);

    // Options for the chapter filter dropdown (subject's chapters + an "all" entry).
    const chapterOptions = useMemo(
        () => [{ label: "All chapters", value: "" }, ...chapters.map(c => ({ label: c.chapterName, value: c.chapterId }))],
        [chapters],
    );
    const pyqOptions = [
        { label: "Hide PYQs", value: "hide" },
        { label: "PYQs only", value: "only" },
        { label: "Show all", value: "all" },
    ];

    // Pool with the chapter + PYQ filters applied. PYQ questions are hidden by
    // default so previous-year questions stay out of contests unless opted in.
    const visiblePool = useMemo(() => {
        return pool.filter(q => {
            const isPyq = pyqMap.has(q.id);
            if (pyqFilter === "hide" && isPyq) return false;
            if (pyqFilter === "only" && !isPyq) return false;
            if (chapterFilter && topicToChapter.get(q.topic_id)?.chapterId !== chapterFilter) return false;
            return true;
        });
    }, [pool, pyqMap, pyqFilter, chapterFilter, topicToChapter]);

    // Fix #7: reset form + selection on close
    const closeModal = () => {
        setIsModalOpen(false);
        setForm(EMPTY_FORM);
        setSubjects([]);
        setActiveSubject("");
        setPool([]);
        setSelected({});
        setChapters([]);
        setTopicToChapter(new Map());
        setChapterFilter("");
        setPyqFilter("hide");
    };

    const handleCreate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!form.class_id) return toast.error("Please select a class.");
        if (selectedList.length === 0) return toast.error("Select at least one question.");
        if (!form.starts_at) return toast.error("Please set a start time.");

        setIsSubmitting(true);
        try {
            const created = await createContest({
                name: form.name,
                description: form.description || null,
                class_id: form.class_id,
                exam_type: form.exam_type,
                status: form.status,
                starts_at: new Date(form.starts_at).toISOString(),
                total_time: Number(form.total_time) * 60, // minutes -> seconds
                question_ids: selectedList.map(q => q.id),
            });
            // Fix #1 & #6: updater fn + only insert if status fits active tab
            const fitsTab = TAB_STATUSES[activeTab].includes(created.status);
            mutate((cur: Contest[] | undefined) => fitsTab ? [created, ...(cur || [])] : (cur || []), false);
            closeModal();
            toast.success("Contest created.");
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to create contest."));
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <button onClick={() => setIsModalOpen(true)}
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

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-4xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
                        {/* Fix #4: X close button in header */}
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <h2 className="text-xl font-bold text-foreground">Create Contest</h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="flex flex-col lg:flex-row gap-6 overflow-hidden">
                            {/* Left: contest meta */}
                            <div className="lg:w-1/2 space-y-4 overflow-y-auto pr-1">
                                <div><label className="block text-xs font-medium text-foreground mb-1">Contest Name *</label>
                                    <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="e.g. All India Mock Test #5" /></div>
                                <div><label className="block text-xs font-medium text-foreground mb-1">Description</label>
                                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none resize-none h-20"
                                        placeholder="Optional..." /></div>
                                {/* Subjects are scoped by class + exam, so pick both before they populate. */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-medium text-foreground mb-1">For Class *</label>
                                        <CustomSelect value={form.class_id} placeholder="Select class"
                                            onChange={(val) => setForm(f => ({ ...f, class_id: val }))}
                                            options={classes.map(c => ({ label: c.name, value: c.id }))} /></div>
                                    <div><label className="block text-xs font-medium text-foreground mb-1">Exam Type *</label>
                                        <CustomSelect value={form.exam_type} onChange={(val) => setForm(f => ({ ...f, exam_type: val as ExamType }))}
                                            options={EXAM_TYPE_OPTIONS} /></div>
                                </div>
                                <div><label className="block text-xs font-medium text-foreground mb-1">Duration (mins)</label>
                                    <input type="number" required min="1" value={form.total_time}
                                        onChange={e => setForm(f => ({ ...f, total_time: Number(e.target.value) }))}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" /></div>
                                {/* Only start time is needed — end is derived from start + duration. */}
                                <div><label className="block text-xs font-medium text-foreground mb-1">Starts At *</label>
                                    <input type="datetime-local" required value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                                    <p className="text-[11px] text-muted-foreground mt-1">Ends automatically after the duration above.</p></div>
                                {/* Fix #5: expose status selector */}
                                <div><label className="block text-xs font-medium text-foreground mb-1">Initial Status</label>
                                    <CustomSelect value={form.status} onChange={(val) => setForm(f => ({ ...f, status: val as ContestStatus }))}
                                        options={[
                                            { label: "Upcoming (Not Started)", value: "not_started" },
                                            { label: "Live (Active)", value: "active" },
                                            { label: "Concluded", value: "finished" },
                                        ]} /></div>
                            </div>

                            {/* Right: subject-wise question picker */}
                            <div className="lg:w-1/2 flex flex-col border border-(--card-border) rounded-xl overflow-hidden">
                                <div className="p-3 border-b border-(--card-border) bg-foreground/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ListChecks className="h-4 w-4 text-brand-500" />
                                        <span className="text-sm font-semibold text-foreground">Questions</span>
                                        {activeSubject && !poolLoading && (
                                            <span className="text-xs text-muted-foreground">
                                                ({visiblePool.length}{visiblePool.length !== pool.length ? ` of ${pool.length}` : ""})
                                            </span>
                                        )}
                                        <span className="ml-auto text-xs text-muted-foreground">{selectedList.length} selected</span>
                                    </div>
                                    {!form.class_id ? (
                                        <p className="text-xs text-muted-foreground">Select a class first.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {subjects.map(s => (
                                                <button type="button" key={s.id} onClick={() => setActiveSubject(s.id)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${activeSubject === s.id ? "bg-brand-500 text-white" : "bg-background text-muted-foreground hover:text-foreground border border-(--card-border)"}`}>
                                                    {s.subject_type}
                                                </button>
                                            ))}
                                            {subjects.length === 0 && <span className="text-xs text-muted-foreground">No subjects for this class.</span>}
                                        </div>
                                    )}
                                    {/* Chapter + PYQ filters — PYQ defaults to "Hide PYQs" so
                                        previous-year questions stay out of contests by default. */}
                                    {activeSubject && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <CustomSelect options={chapterOptions} value={chapterFilter} onChange={setChapterFilter} placeholder="Chapter" />
                                            <CustomSelect options={pyqOptions} value={pyqFilter} onChange={(val) => setPyqFilter(val as "hide" | "only" | "all")} placeholder="PYQs" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[260px] max-h-[420px]">
                                    {poolLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
                                    ) : pool.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center mt-8">
                                            {activeSubject ? "No hidden (contest-eligible) questions for this subject." : "Pick a subject to load questions."}
                                        </p>
                                    ) : visiblePool.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center mt-8">
                                            No questions match the current chapter / PYQ filters.
                                        </p>
                                    ) : (
                                        visiblePool.map(q => {
                                            const isOn = !!selected[q.id];
                                            const chapterName = topicToChapter.get(q.topic_id)?.chapterName;
                                            const pyq = pyqMap.get(q.id);
                                            return (
                                                <div key={q.id}
                                                    className={`w-full flex items-start gap-2 p-2.5 rounded-lg border transition-colors ${isOn ? "border-brand-500/50 bg-brand-500/5" : "border-(--card-border) hover:bg-foreground/5"}`}>
                                                    <button type="button" onClick={() => toggleQuestion(q)}
                                                        aria-label={isOn ? "Deselect question" : "Select question"}
                                                        className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer ${isOn ? "border-brand-500 bg-brand-500" : "border-(--input) hover:border-brand-500"}`}>
                                                        {isOn && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                    </button>
                                                    <div role="button" tabIndex={0} onClick={() => toggleQuestion(q)}
                                                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleQuestion(q); } }}
                                                        className="flex-1 min-w-0 cursor-pointer">
                                                        <span className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                            {chapterName && (
                                                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-foreground/10 text-muted-foreground">{chapterName}</span>
                                                            )}
                                                            {q.question_image && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-semibold">
                                                                    <ImageIcon className="h-2.5 w-2.5" /> Image
                                                                </span>
                                                            )}
                                                            {pyq && (
                                                                <span
                                                                    title={`PYQ${pyq.year ? ` · ${pyq.year}` : ""}${pyq.exam_detail?.length ? ` · ${pyq.exam_detail.join(", ")}` : ""}`}
                                                                    className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                                                                    PYQ{pyq.year ? ` ${pyq.year}` : ""}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="block text-xs text-foreground line-clamp-2">{q.question_text}</span>
                                                        <span className="block text-[10px] text-muted-foreground mt-0.5 font-mono uppercase">{q.type} · {q.marks} mark{q.marks !== 1 ? "s" : ""} · D{q.difficulty}</span>
                                                    </div>
                                                    <button type="button" onClick={() => setPreviewId(q.id)}
                                                        title="Preview full question, image & answer"
                                                        className="shrink-0 self-start flex items-center gap-1 px-1.5 py-1 rounded-md border border-(--card-border) text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                                        <Eye className="h-3 w-3" /> Preview
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="p-3 border-t border-(--card-border) flex justify-end gap-3 bg-foreground/5">
                                    {/* Fix #7: cancel resets form via closeModal */}
                                    <button type="button" onClick={closeModal}
                                        className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-foreground/10 transition-colors cursor-pointer">Cancel</button>
                                    <button type="submit" disabled={isSubmitting}
                                        className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-20 cursor-pointer disabled:opacity-60">
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Full-detail preview (image, options, answer, solution). Portals to
                body at a higher z-index so it overlays the create-contest modal. */}
            <QuestionPreviewModal questionId={previewId} onClose={() => setPreviewId(null)} />
        </>
    );
}
