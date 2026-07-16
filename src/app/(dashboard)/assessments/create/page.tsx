"use client";

import "katex/dist/katex.min.css";
import Latex from "react-latex";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import {
    ArrowLeft, Plus, Loader2, ListChecks, Eye, ImageIcon, CheckCircle2, X, ArrowUpDown,
} from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import {
    createContest, getContestQuestionPool, getUsedQuestionIds, getPyqQuestionMap,
    getSubjectChapterMap, type ContestStatus, type ExamType, type PoolQuestion,
    type PyqInfo, type ChapterRef, type SubtopicRef,
} from "@/lib/api/contests";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";
import { QuestionPreviewModal } from "@/components/question/question-preview-modal";

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; subject_type: string; class_id: string; }

const EMPTY_FORM = {
    name: "",
    description: "",
    class_id: "",
    exam_type: "JEE_MAINS" as ExamType,
    total_time: 180, // minutes (converted to seconds on submit)
    starts_at: "",
    status: "not_started" as ContestStatus,
};

// Sort options for the question list. "recent" (newest first) is the default.
type SortKey = "recent" | "difficulty" | "marks" | "type";
const SORT_OPTIONS: { label: string; value: SortKey }[] = [
    { label: "Recently added", value: "recent" },
    { label: "Difficulty", value: "difficulty" },
    { label: "Marks", value: "marks" },
    { label: "Type", value: "type" },
];

const DIFFICULTY_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

export default function CreateContestPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [previewId, setPreviewId] = useState<string | null>(null);

    // Curriculum + subject-wise question selection
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [activeSubject, setActiveSubject] = useState("");
    const [pool, setPool] = useState<PoolQuestion[]>([]);
    const [poolLoading, setPoolLoading] = useState(false);
    const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Record<string, PoolQuestion>>({});
    const [pyqMap, setPyqMap] = useState<Map<string, PyqInfo>>(new Map());

    // Chapter / subtopic mapping for the active subject.
    const [chapters, setChapters] = useState<ChapterRef[]>([]);
    const [topicToChapter, setTopicToChapter] = useState<Map<string, ChapterRef>>(new Map());
    const [topicToSubtopic, setTopicToSubtopic] = useState<Map<string, string>>(new Map());
    const [subtopicsByChapter, setSubtopicsByChapter] = useState<Map<string, SubtopicRef[]>>(new Map());

    // Filters + sort
    const [chapterFilter, setChapterFilter] = useState("");
    const [subtopicFilter, setSubtopicFilter] = useState("");
    const [difficultyFilter, setDifficultyFilter] = useState("");
    const [pyqFilter, setPyqFilter] = useState<"hide" | "only" | "all">("hide");
    const [sortKey, setSortKey] = useState<SortKey>("recent");

    // Load classes on mount.
    useEffect(() => {
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            setClasses(Array.isArray(d) ? d : (d.classes || []));
        }).catch(() => { });
    }, []);

    // Used-question IDs + PYQ map on mount (exclude already-used; badge PYQs).
    useEffect(() => { getUsedQuestionIds().then(setUsedIds).catch(() => setUsedIds(new Set())); }, []);
    useEffect(() => { getPyqQuestionMap().then(setPyqMap).catch(() => setPyqMap(new Map())); }, []);

    // Subjects are scoped by class + exam.
    useEffect(() => {
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

    // Question pool for the active subject (hidden, contest-eligible), minus used.
    // NOTE: the pool is fetched per subject and then filtered to chapter/subtopic
    // client-side. The backend applies no ORDER BY, so a small limit returns an
    // arbitrary (and unstable) slice — chapters past the window silently show too
    // few questions. Fetch the full eligible pool (limit = endpoint max 500) and,
    // when a chapter is selected, scope server-side too so large subjects can't
    // exceed the window. See faction-backend get_questions().
    useEffect(() => {
        if (!activeSubject) { setPool([]); return; }
        setPoolLoading(true);
        getContestQuestionPool({
            subject_id: activeSubject,
            chapter_id: chapterFilter || undefined,
            limit: 500,
        })
            .then(res => setPool((res.questions || []).filter(q => !usedIds.has(q.id))))
            .catch(() => setPool([]))
            .finally(() => setPoolLoading(false));
    }, [activeSubject, chapterFilter, usedIds]);

    // Chapter/subtopic maps for the active subject. Reset dependent filters.
    useEffect(() => {
        setChapterFilter("");
        setSubtopicFilter("");
        if (!activeSubject) {
            setChapters([]); setTopicToChapter(new Map());
            setTopicToSubtopic(new Map()); setSubtopicsByChapter(new Map());
            return;
        }
        getSubjectChapterMap(activeSubject)
            .then(({ chapters, topicToChapter, topicToSubtopic, subtopicsByChapter }) => {
                setChapters(chapters);
                setTopicToChapter(topicToChapter);
                setTopicToSubtopic(topicToSubtopic);
                setSubtopicsByChapter(subtopicsByChapter);
            })
            .catch(() => {
                setChapters([]); setTopicToChapter(new Map());
                setTopicToSubtopic(new Map()); setSubtopicsByChapter(new Map());
            });
    }, [activeSubject]);

    // Changing the chapter filter clears the subtopic filter (subtopics are chapter-scoped).
    useEffect(() => { setSubtopicFilter(""); }, [chapterFilter]);

    // Drop now-known-used questions from the selection if usedIds arrives late.
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

    const chapterOptions = useMemo(
        () => [{ label: "All chapters", value: "" }, ...chapters.map(c => ({ label: c.chapterName, value: c.chapterId }))],
        [chapters],
    );
    // Subtopics for the chosen chapter, in canonical order (as returned by the API).
    const subtopicOptions = useMemo(() => {
        if (!chapterFilter) return [{ label: "All subtopics", value: "" }];
        const subs = subtopicsByChapter.get(chapterFilter) ?? [];
        return [{ label: "All subtopics", value: "" }, ...subs.map(s => ({ label: s.topicName, value: s.topicId }))];
    }, [chapterFilter, subtopicsByChapter]);
    const difficultyOptions = [
        { label: "All difficulties", value: "" },
        { label: "Easy", value: "1" },
        { label: "Medium", value: "2" },
        { label: "Hard", value: "3" },
    ];
    const pyqOptions = [
        { label: "Hide PYQs", value: "hide" },
        { label: "PYQs only", value: "only" },
        { label: "Show all", value: "all" },
    ];

    // Pool with filters applied, then sorted.
    const visiblePool = useMemo(() => {
        const filtered = pool.filter(q => {
            const isPyq = pyqMap.has(q.id);
            if (pyqFilter === "hide" && isPyq) return false;
            if (pyqFilter === "only" && !isPyq) return false;
            if (chapterFilter && topicToChapter.get(q.topic_id)?.chapterId !== chapterFilter) return false;
            if (subtopicFilter && q.topic_id !== subtopicFilter) return false;
            if (difficultyFilter && String(q.difficulty) !== difficultyFilter) return false;
            return true;
        });
        const sorted = [...filtered];
        switch (sortKey) {
            case "recent":
                sorted.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
                break;
            case "difficulty":
                sorted.sort((a, b) => a.difficulty - b.difficulty);
                break;
            case "marks":
                sorted.sort((a, b) => b.marks - a.marks);
                break;
            case "type":
                sorted.sort((a, b) => a.type.localeCompare(b.type));
                break;
        }
        return sorted;
    }, [pool, pyqMap, pyqFilter, chapterFilter, subtopicFilter, difficultyFilter, sortKey, topicToChapter]);

    const handleCreate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error("Please enter a contest name.");
        if (!form.class_id) return toast.error("Please select a class.");
        if (selectedList.length === 0) return toast.error("Select at least one question.");
        if (!form.starts_at) return toast.error("Please set a start time.");

        setIsSubmitting(true);
        try {
            await createContest({
                name: form.name,
                description: form.description || null,
                class_id: form.class_id,
                exam_type: form.exam_type,
                status: form.status,
                starts_at: new Date(form.starts_at).toISOString(),
                total_time: Number(form.total_time) * 60, // minutes -> seconds
                question_ids: selectedList.map(q => q.id),
            });
            toast.success("Contest created.");
            router.push("/assessments");
        } catch (err) {
            toast.error(getApiError(err, "Failed to create contest."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtersActive = !!(chapterFilter || subtopicFilter || difficultyFilter || pyqFilter !== "hide");

    return (
        <>
            <form id="create-contest-form" onSubmit={handleCreate} className="flex flex-col gap-6 w-full pb-24">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => router.push("/assessments")}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Contest</h1>
                        <p className="text-muted-foreground text-sm">Set the details and pick questions from the bank.</p>
                    </div>
                </div>

                {/* Contest meta */}
                <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-foreground mb-1">Contest Name *</label>
                        <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="e.g. All India Mock Test #5" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none resize-none h-16"
                            placeholder="Optional..." />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">For Class *</label>
                        <CustomSelect value={form.class_id} placeholder="Select class"
                            onChange={(val) => setForm(f => ({ ...f, class_id: val }))}
                            options={classes.map(c => ({ label: c.name, value: c.id }))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Exam Type *</label>
                        <CustomSelect value={form.exam_type} onChange={(val) => setForm(f => ({ ...f, exam_type: val as ExamType }))}
                            options={EXAM_TYPE_OPTIONS} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Duration (mins)</label>
                        <input type="number" required min="1" value={form.total_time}
                            onChange={e => setForm(f => ({ ...f, total_time: Number(e.target.value) }))}
                            className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Starts At *</label>
                        <input type="datetime-local" required value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                            className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Initial Status</label>
                        <CustomSelect value={form.status} onChange={(val) => setForm(f => ({ ...f, status: val as ContestStatus }))}
                            options={[
                                { label: "Upcoming (Not Started)", value: "not_started" },
                                { label: "Live (Active)", value: "active" },
                                { label: "Concluded", value: "finished" },
                            ]} />
                    </div>
                    <p className="text-[11px] text-muted-foreground md:col-span-2 -mt-1">Ends automatically after the duration above.</p>
                </div>

                {/* Question picker */}
                <div className="glass-card flex flex-col overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-(--card-border) bg-foreground/5 flex flex-col gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <ListChecks className="h-4 w-4 text-brand-500" />
                            <span className="text-sm font-semibold text-foreground">Questions</span>
                            {activeSubject && !poolLoading && (
                                <span className="text-xs text-muted-foreground">
                                    ({visiblePool.length}{visiblePool.length !== pool.length ? ` of ${pool.length}` : ""})
                                </span>
                            )}
                            <span className="ml-auto text-xs font-medium text-brand-500">{selectedList.length} selected</span>
                        </div>

                        {!form.class_id ? (
                            <p className="text-xs text-muted-foreground">Select a class and exam above to load questions.</p>
                        ) : (
                            <>
                                {/* Subject tabs */}
                                <div className="flex flex-wrap gap-1.5">
                                    {subjects.map(s => (
                                        <button type="button" key={s.id} onClick={() => setActiveSubject(s.id)}
                                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${activeSubject === s.id ? "bg-brand-500 text-white" : "bg-background text-muted-foreground hover:text-foreground border border-(--card-border)"}`}>
                                            {s.subject_type}
                                        </button>
                                    ))}
                                    {subjects.length === 0 && <span className="text-xs text-muted-foreground">No subjects for this class.</span>}
                                </div>

                                {/* Sort + filters */}
                                {activeSubject && (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <CustomSelect options={SORT_OPTIONS} value={sortKey} onChange={(v) => setSortKey(v as SortKey)} />
                                        </div>
                                        <CustomSelect options={chapterOptions} value={chapterFilter} onChange={setChapterFilter} placeholder="Chapter" />
                                        <CustomSelect options={subtopicOptions} value={subtopicFilter} onChange={setSubtopicFilter}
                                            placeholder="Subtopic" disabled={!chapterFilter} />
                                        <CustomSelect options={difficultyOptions} value={difficultyFilter} onChange={setDifficultyFilter} placeholder="Difficulty" />
                                        <CustomSelect options={pyqOptions} value={pyqFilter} onChange={(val) => setPyqFilter(val as "hide" | "only" | "all")} placeholder="PYQs" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[320px] max-h-[calc(100vh-360px)]">
                        {poolLoading ? (
                            <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
                        ) : !activeSubject ? (
                            <p className="text-sm text-muted-foreground text-center mt-12">Pick a subject to load questions.</p>
                        ) : pool.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center mt-12">No hidden (contest-eligible) questions for this subject.</p>
                        ) : visiblePool.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center mt-12">
                                No questions match the current filters.{filtersActive && " Try clearing them."}
                            </p>
                        ) : (
                            visiblePool.map(q => {
                                const isOn = !!selected[q.id];
                                const chapterName = topicToChapter.get(q.topic_id)?.chapterName;
                                const subtopicName = topicToSubtopic.get(q.topic_id);
                                const pyq = pyqMap.get(q.id);
                                return (
                                    <div key={q.id}
                                        className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-colors ${isOn ? "border-brand-500/50 bg-brand-500/5" : "border-(--card-border) hover:bg-foreground/5"}`}>
                                        <button type="button" onClick={() => toggleQuestion(q)}
                                            aria-label={isOn ? "Deselect question" : "Select question"}
                                            className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer ${isOn ? "border-brand-500 bg-brand-500" : "border-(--input) hover:border-brand-500"}`}>
                                            {isOn && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                        </button>
                                        <div role="button" tabIndex={0} onClick={() => toggleQuestion(q)}
                                            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleQuestion(q); } }}
                                            className="flex-1 min-w-0 cursor-pointer">
                                            {/* Labels: chapter · subtopic · flags */}
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                                {chapterName && (
                                                    <span className="inline-block text-[11px] px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium">{chapterName}</span>
                                                )}
                                                {subtopicName && (
                                                    <span className="inline-block text-[11px] px-2 py-0.5 rounded-md bg-foreground/10 text-muted-foreground">{subtopicName}</span>
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
                                            </div>
                                            {/* Question text rendered with inline LaTeX so it's readable without the preview. */}
                                            <div className="text-sm text-foreground leading-relaxed latex-clamp">
                                                <Latex>{q.question_text}</Latex>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-1.5 font-mono uppercase flex items-center gap-2">
                                                <span>{q.type}</span>
                                                <span className="text-foreground/20">·</span>
                                                <span>{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                                                <span className="text-foreground/20">·</span>
                                                <span>{DIFFICULTY_LABEL[q.difficulty] ?? `D${q.difficulty}`}</span>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setPreviewId(q.id)}
                                            title="Preview full question, image & answer"
                                            className="shrink-0 self-start flex items-center gap-1 px-2 py-1 rounded-md border border-(--card-border) text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                            <Eye className="h-3 w-3" /> Preview
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </form>

            {/* Sticky action bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-(--card-border) bg-background/90 backdrop-blur-sm">
                <div className="max-w-full px-6 py-3 flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">{selectedList.length}</span> question{selectedList.length !== 1 ? "s" : ""} selected
                        {selectedList.length > 0 && (
                            <button type="button" onClick={() => setSelected({})}
                                className="ml-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                                <X className="h-3 w-3" /> Clear
                            </button>
                        )}
                    </span>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => router.push("/assessments")}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-foreground/10 transition-colors cursor-pointer">Cancel</button>
                        <button type="submit" form="create-contest-form" disabled={isSubmitting}
                            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-w-32 cursor-pointer disabled:opacity-60">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Create Contest</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Full-detail preview (image, options, answer, solution). */}
            <QuestionPreviewModal questionId={previewId} onClose={() => setPreviewId(null)} />
        </>
    );
}
