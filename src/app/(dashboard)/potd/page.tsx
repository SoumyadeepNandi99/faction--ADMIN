"use client";

import { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/axios";
import {
    CalendarClock,
    Check,
    Loader2,
    X,
    FileText,
    PackagePlus,
    PackageMinus,
    RefreshCw,
    CalendarDays,
    Layers,
    Trash2,
    Eye,
    ImageIcon,
} from "lucide-react";
import "katex/dist/katex.min.css";
import Latex from "react-latex";
import { CustomSelect } from "@/components/ui/custom-select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";
import { QuestionPreviewModal } from "@/components/question/question-preview-modal";

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; subject_type: string; class_id: string; }
interface ChapterOption { id: string; name: string; subject_id: string; }
interface TopicOption { id: string; name: string; chapter_id: string; }

interface Question {
    id: string;
    topic_id: string;
    question_text: string;
    difficulty: number;
    type?: string;
    exam_type: string[];
    marks?: number;
    // Present on the list response — lets us flag/preview image questions.
    question_image?: string | null;
    // POTD-pool eligibility (separate from contest reservation `hidden`).
    is_qotd_eligible: boolean;
    // The IST date this question was served as the POTD (null = never served).
    qotd_served_date?: string | null;
}

const getDifficultyLabel = (diff: number) => (diff === 1 ? "EASY" : diff === 2 ? "MEDIUM" : "HARD");
const diffColor = (diff: number) =>
    diff === 1
        ? "bg-green-500/10 text-green-500"
        : diff === 2
        ? "bg-yellow-500/10 text-yellow-500"
        : "bg-red-500/10 text-red-500";
const typeLabel = (t?: string) => {
    if (!t) return "";
    const map: Record<string, string> = { scq: "SCQ", mcq: "MCQ", integer: "INT", match_the_column: "MATCH" };
    return map[t] || t.toUpperCase();
};

type Tab = "pool" | "schedule";

export default function PotdPage() {
    const [tab, setTab] = useState<Tab>("pool");
    // Question id currently open in the full-detail preview modal (null = closed).
    const [previewId, setPreviewId] = useState<string | null>(null);

    // ---- Shared cascade selection state (used by both tabs) ----
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [chapters, setChapters] = useState<ChapterOption[]>([]);
    const [topics, setTopics] = useState<TopicOption[]>([]);

    const [selClass, setSelClass] = useState("");
    const [selExam, setSelExam] = useState("");
    const [selSubject, setSelSubject] = useState("");
    const [selChapter, setSelChapter] = useState("");
    const [selTopics, setSelTopics] = useState<string[]>([]);
    const [selTopicNames, setSelTopicNames] = useState<Record<string, string>>({});

    const [loadingTopics, setLoadingTopics] = useState(false);

    // Questions across the selected topics
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [questionsError, setQuestionsError] = useState(false);

    // Pool-tab: which questions the admin has ticked to add/remove from the pool
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    // ---- Load classes on mount ----
    useEffect(() => {
        apiClient
            .get("/api/v1/class/")
            .then((r) => {
                const d = r.data;
                setClasses(Array.isArray(d) ? d : d.classes || []);
            })
            .catch(() => {});
    }, []);

    // ---- Load subjects when class + exam chosen ----
    useEffect(() => {
        setSubjects([]);
        setSelSubject("");
        setChapters([]);
        setSelChapter("");
        setTopics([]);
        setSelTopics([]);
        setSelTopicNames({});
        if (!selClass || !selExam) return;
        apiClient
            .get(`/api/v1/subjects/?class_id=${selClass}&exam_type=${selExam}`)
            .then((r) => {
                const d = r.data;
                setSubjects(Array.isArray(d) ? d : d.subjects || []);
            })
            .catch(() => {});
    }, [selClass, selExam]);

    // ---- Load chapters when a subject is chosen ----
    useEffect(() => {
        setChapters([]);
        setSelChapter("");
        setTopics([]);
        setSelTopics([]);
        setSelTopicNames({});
        if (!selSubject) return;
        apiClient
            .get<ChapterOption[] | { chapters: ChapterOption[] }>(`/api/v1/chapters/?subject_id=${selSubject}`)
            .then((r) => {
                const d = r.data;
                setChapters(Array.isArray(d) ? d : d.chapters || []);
            })
            .catch(() => {});
    }, [selSubject]);

    // ---- Load topics for the selected chapter ----
    useEffect(() => {
        setTopics([]);
        if (!selChapter) return;
        let cancelled = false;
        setLoadingTopics(true);
        apiClient
            .get<TopicOption[] | { topics: TopicOption[] }>(`/api/v1/topics/?chapter_id=${selChapter}`)
            .then((r) => {
                if (cancelled) return;
                const d = r.data;
                const ts: TopicOption[] = Array.isArray(d) ? d : d.topics || [];
                setTopics(ts);
            })
            .catch(() => {
                if (!cancelled) setTopics([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingTopics(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selChapter]);

    // ---- Fetch questions for the selected topics ----
    const fetchQuestions = async (topicIds: string[]) => {
        if (topicIds.length === 0) {
            setQuestions([]);
            return;
        }
        setLoadingQuestions(true);
        setQuestionsError(false);
        try {
            const results = await Promise.all(
                topicIds.map((tid) =>
                    apiClient
                        .get(`/api/v1/questions/?topic_id=${tid}&limit=100`)
                        .then((r) => (r.data?.questions || []) as Question[])
                )
            );
            const seen = new Set<string>();
            const merged: Question[] = [];
            for (const q of results.flat()) {
                if (!seen.has(q.id)) {
                    seen.add(q.id);
                    merged.push(q);
                }
            }
            setQuestions(merged);
            setChecked((prev) => new Set([...prev].filter((id) => seen.has(id))));
        } catch {
            setQuestionsError(true);
            setQuestions([]);
        } finally {
            setLoadingQuestions(false);
        }
    };

    useEffect(() => {
        fetchQuestions(selTopics);
    }, [selTopics]);

    const toggleTopic = (topic: TopicOption) => {
        const chapterName = chapters.find((c) => c.id === topic.chapter_id)?.name;
        const displayName = chapterName ? `${chapterName} › ${topic.name}` : topic.name;
        setSelTopics((prev) =>
            prev.includes(topic.id) ? prev.filter((t) => t !== topic.id) : [...prev, topic.id]
        );
        setSelTopicNames((prev) => {
            const next = { ...prev };
            if (next[topic.id]) delete next[topic.id];
            else next[topic.id] = displayName;
            return next;
        });
    };

    const removeTopic = (topicId: string) => {
        setSelTopics((prev) => prev.filter((t) => t !== topicId));
        setSelTopicNames((prev) => {
            const next = { ...prev };
            delete next[topicId];
            return next;
        });
    };

    const toggleChecked = (id: string) => {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const inPoolCount = useMemo(() => questions.filter((q) => q.is_qotd_eligible).length, [questions]);
    const checkedList = useMemo(() => questions.filter((q) => checked.has(q.id)), [questions, checked]);
    const checkedToAdd = checkedList.filter((q) => !q.is_qotd_eligible);
    const checkedToRemove = checkedList.filter((q) => q.is_qotd_eligible);

    // ---- Bulk set is_qotd_eligible flag (the POTD pool) ----
    const setPool = async (ids: string[], eligible: boolean) => {
        if (ids.length === 0) return;
        setSubmitting(true);
        try {
            const results = await Promise.allSettled(
                ids.map((id) => apiClient.put(`/api/v1/questions/${id}`, { is_qotd_eligible: eligible }))
            );
            const succeeded = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
            const ok = succeeded.size;
            const failed = ids.length - ok;

            setQuestions((prev) =>
                prev.map((q) => (succeeded.has(q.id) ? { ...q, is_qotd_eligible: eligible } : q))
            );
            setChecked(new Set());

            if (failed === 0) {
                toast.success(
                    eligible
                        ? `Added ${ok} question${ok !== 1 ? "s" : ""} into the POTD pool.`
                        : `Removed ${ok} question${ok !== 1 ? "s" : ""} from the POTD pool.`
                );
            } else {
                toast.error(`${ok} updated, ${failed} failed. Refresh to verify.`);
            }
        } catch (err) {
            toast.error(getApiError(err, "Failed to update the POTD pool."));
        } finally {
            setSubmitting(false);
        }
    };

    const classOptions = classes.map((c) => ({ label: c.name, value: c.id }));
    const subjectOptions = subjects.map((s) => ({ label: s.subject_type, value: s.id }));
    const chapterOptions = chapters.map((c) => ({ label: c.name, value: c.id }));

    const topicMap = useMemo(() => {
        const m = new Map<string, string>(topics.map((t) => [t.id, t.name]));
        for (const [id, name] of Object.entries(selTopicNames)) m.set(id, name);
        return m;
    }, [topics, selTopicNames]);

    // ============================ SCHEDULE TAB STATE ============================
    const [schedDate, setSchedDate] = useState<string>(""); // yyyy-mm-dd (IST)
    // Eligible-pool questions for the chosen class+exam (the schedule picker source)
    const [poolQuestions, setPoolQuestions] = useState<Question[]>([]);
    const [loadingPool, setLoadingPool] = useState(false);
    const [schedPicked, setSchedPicked] = useState<string[]>([]); // ordered question ids
    // Filter the eligible pool by whether a question has already been a POTD.
    const [servedFilter, setServedFilter] = useState<"all" | "never" | "served">("all");
    const [savingSched, setSavingSched] = useState(false);
    const [existingSchedId, setExistingSchedId] = useState<string | null>(null);
    const [loadingExisting, setLoadingExisting] = useState(false);

    // Load the eligible POTD pool for the selected class+exam (schedule tab).
    useEffect(() => {
        if (tab !== "schedule" || !selClass || !selExam) {
            setPoolQuestions([]);
            return;
        }
        let cancelled = false;
        setLoadingPool(true);
        // The eligible pool is exam-scoped. Filter by exam SERVER-side: otherwise
        // the limit was consumed by the (large) JEE_MAINS pool and other exams'
        // questions fell outside the window, so freshly-added questions never
        // appeared in the picker. Raised limit covers a full per-exam pool.
        apiClient
            .get(`/api/v1/questions/?is_qotd_eligible=true&exam_type=${encodeURIComponent(selExam)}&limit=500`)
            .then((r) => {
                if (cancelled) return;
                const all = (r.data?.questions || []) as Question[];
                setPoolQuestions(all);
            })
            .catch(() => {
                if (!cancelled) setPoolQuestions([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingPool(false);
            });
        return () => {
            cancelled = true;
        };
    }, [tab, selClass, selExam]);

    // When date+class+exam are all set, load any existing schedule for that day.
    useEffect(() => {
        setExistingSchedId(null);
        setSchedPicked([]);
        if (tab !== "schedule" || !schedDate || !selClass || !selExam) return;
        let cancelled = false;
        setLoadingExisting(true);
        apiClient
            .get(`/api/v1/qotd/schedule`, {
                params: { scheduled_date: schedDate, class_id: selClass, exam_type: selExam },
            })
            .then((r) => {
                if (cancelled) return;
                setExistingSchedId(r.data?.id ?? null);
                setSchedPicked(r.data?.question_ids ?? []);
            })
            .catch((err) => {
                // 404 = nothing scheduled yet; that's fine.
                if (!cancelled && err?.response?.status !== 404) {
                    toast.error(getApiError(err, "Failed to load existing schedule."));
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingExisting(false);
            });
        return () => {
            cancelled = true;
        };
    }, [tab, schedDate, selClass, selExam]);

    const togglePicked = (id: string) => {
        setSchedPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    };

    const saveSchedule = async () => {
        if (!schedDate || !selClass || !selExam || schedPicked.length === 0) return;
        setSavingSched(true);
        try {
            await apiClient.post(`/api/v1/qotd/schedule`, {
                scheduled_date: schedDate,
                class_id: selClass,
                exam_type: selExam,
                question_ids: schedPicked,
            });
            toast.success(`POTD scheduled for ${schedDate} (${schedPicked.length} question${schedPicked.length !== 1 ? "s" : ""}).`);
        } catch (err) {
            toast.error(getApiError(err, "Failed to schedule the POTD."));
        } finally {
            setSavingSched(false);
        }
    };

    const deleteSchedule = async () => {
        if (!existingSchedId) return;
        setSavingSched(true);
        try {
            await apiClient.delete(`/api/v1/qotd/schedule/${existingSchedId}`);
            setExistingSchedId(null);
            setSchedPicked([]);
            toast.success("POTD schedule cleared for this day.");
        } catch (err) {
            toast.error(getApiError(err, "Failed to clear the schedule."));
        } finally {
            setSavingSched(false);
        }
    };

    const poolMap = useMemo(() => new Map(poolQuestions.map((q) => [q.id, q])), [poolQuestions]);

    // Split the eligible pool by served status. A question is "served" if it has a
    // qotd_served_date (it has appeared as a POTD before).
    const servedCounts = useMemo(() => {
        let served = 0;
        for (const q of poolQuestions) if (q.qotd_served_date) served++;
        return { all: poolQuestions.length, served, never: poolQuestions.length - served };
    }, [poolQuestions]);

    // The pool after the served filter. Questions already picked for this date are
    // always kept visible (so a filtered-out pick can still be unpicked/reordered).
    const visiblePool = useMemo(() => {
        if (servedFilter === "all") return poolQuestions;
        return poolQuestions.filter((q) => {
            if (schedPicked.includes(q.id)) return true;
            return servedFilter === "served" ? !!q.qotd_served_date : !q.qotd_served_date;
        });
    }, [poolQuestions, servedFilter, schedPicked]);

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Problem of the Day</h1>
                    <p className="text-muted-foreground">
                        Curate the POTD pool, then schedule which question(s) appear on a given day.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setTab("pool")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        tab === "pool"
                            ? "bg-brand-600 text-white"
                            : "border border-(--card-border) text-foreground hover:bg-foreground/5"
                    }`}
                >
                    <Layers className="h-4 w-4" /> Pool
                </button>
                <button
                    onClick={() => setTab("schedule")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        tab === "schedule"
                            ? "bg-brand-600 text-white"
                            : "border border-(--card-border) text-foreground hover:bg-foreground/5"
                    }`}
                >
                    <CalendarDays className="h-4 w-4" /> Schedule
                </button>
            </div>

            {/* Step 1 — cascade selectors (shared) */}
            <div className="glass-card p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 text-xs font-bold">
                        1
                    </span>
                    Select class &amp; exam{tab === "pool" ? " & subject" : ""}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <CustomSelect
                        value={selClass}
                        onChange={(v) => {
                            setSelClass(v);
                            setSelExam("");
                        }}
                        placeholder="Class"
                        options={classOptions}
                    />
                    <CustomSelect
                        value={selExam}
                        onChange={setSelExam}
                        placeholder="Exam type"
                        options={EXAM_TYPE_OPTIONS}
                        disabled={!selClass}
                    />
                    {tab === "pool" && (
                        <CustomSelect
                            value={selSubject}
                            onChange={setSelSubject}
                            placeholder="Subject"
                            options={subjectOptions}
                            disabled={!subjects.length}
                        />
                    )}
                </div>
            </div>

            {/* ============================ POOL TAB ============================ */}
            {tab === "pool" && selSubject && (
                <div className="glass-card p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 text-xs font-bold">
                                2
                            </span>
                            Pick a chapter, then select topics
                        </div>
                        {selTopics.length > 0 && (
                            <button
                                onClick={() => {
                                    setSelTopics([]);
                                    setSelTopicNames({});
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                Clear all ({selTopics.length})
                            </button>
                        )}
                    </div>

                    <div className="md:max-w-xs">
                        <CustomSelect
                            value={selChapter}
                            onChange={setSelChapter}
                            placeholder={chapters.length ? "Chapter" : "No chapters"}
                            options={chapterOptions}
                            disabled={!chapters.length}
                        />
                    </div>

                    {!selChapter ? (
                        <p className="text-sm text-muted-foreground">Select a chapter to see its topics.</p>
                    ) : loadingTopics ? (
                        <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-8 w-28 rounded-full" />
                            ))}
                        </div>
                    ) : topics.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No topics found in this chapter.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {topics.map((t) => {
                                const active = selTopics.includes(t.id);
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => toggleTopic(t)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                                            active
                                                ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                                                : "border-(--card-border) hover:bg-foreground/5 text-foreground"
                                        }`}
                                    >
                                        {active && <Check className="h-3.5 w-3.5" />}
                                        {t.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {selTopics.length > 0 && (
                        <div className="border-t border-(--panel-border) pt-3 flex flex-col gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                                Selected topics ({selTopics.length})
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {selTopics.map((id) => (
                                    <span
                                        key={id}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-medium text-brand-600 dark:text-brand-400"
                                    >
                                        {topicMap.get(id) || "Topic"}
                                        <button
                                            onClick={() => removeTopic(id)}
                                            className="ml-0.5 hover:text-destructive transition-colors cursor-pointer"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "pool" && selTopics.length > 0 && (
                <div className="glass-card p-4 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 text-xs font-bold">
                                3
                            </span>
                            Pick questions &amp; add to the POTD pool
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="px-2.5 py-1 rounded-full bg-foreground/5 border border-(--card-border) text-muted-foreground">
                                {questions.length} question{questions.length !== 1 ? "s" : ""}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400">
                                {inPoolCount} in pool
                            </span>
                        </div>
                    </div>

                    {checkedList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3">
                            <span className="text-sm text-foreground">{checkedList.length} selected</span>
                            <div className="flex-1" />
                            <button
                                onClick={() => setPool(checkedToAdd.map((q) => q.id), true)}
                                disabled={submitting || checkedToAdd.length === 0}
                                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                                Add to POTD pool
                                {checkedToAdd.length > 0 && ` (${checkedToAdd.length})`}
                            </button>
                            {checkedToRemove.length > 0 && (
                                <button
                                    onClick={() => setPool(checkedToRemove.map((q) => q.id), false)}
                                    disabled={submitting}
                                    className="flex items-center gap-2 border border-(--card-border) hover:bg-foreground/5 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    <PackageMinus className="h-4 w-4" />
                                    Remove from pool ({checkedToRemove.length})
                                </button>
                            )}
                            <button
                                onClick={() => setChecked(new Set())}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    {loadingQuestions ? (
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-20 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : questionsError ? (
                        <div className="p-10 text-center flex flex-col items-center gap-3">
                            <RefreshCw className="h-8 w-8 text-destructive/50" />
                            <h3 className="text-base font-bold text-foreground">Failed to load questions</h3>
                            <button
                                onClick={() => fetchQuestions(selTopics)}
                                className="text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer"
                            >
                                Retry
                            </button>
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center">
                            <FileText className="h-9 w-9 text-muted-foreground mb-3" />
                            <h3 className="text-base font-bold text-foreground">No questions in these topics</h3>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Add questions to these topics from the Question Bank first.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {questions.map((q) => {
                                const isChecked = checked.has(q.id);
                                return (
                                    <div
                                        key={q.id}
                                        className={`rounded-xl border p-4 flex gap-4 transition-all ${
                                            isChecked
                                                ? "border-brand-500 bg-brand-500/5"
                                                : "border-(--card-border) hover:bg-foreground/5"
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggleChecked(q.id)}
                                            aria-label={isChecked ? "Deselect question" : "Select question"}
                                            className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                                                isChecked ? "border-brand-500 bg-brand-500 text-white" : "border-(--card-border) hover:border-brand-500"
                                            }`}
                                        >
                                            {isChecked && <Check className="h-3.5 w-3.5" />}
                                        </button>

                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => toggleChecked(q.id)}
                                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleChecked(q.id); } }}
                                            className="flex-1 min-w-0 cursor-pointer"
                                        >
                                            <div className="flex flex-wrap gap-2 items-center mb-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${diffColor(q.difficulty)}`}>
                                                    {getDifficultyLabel(q.difficulty)}
                                                </span>
                                                {q.type && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                                                        {typeLabel(q.type)}
                                                    </span>
                                                )}
                                                {q.marks != null && (
                                                    <span className="px-2 py-0.5 rounded text-xs text-muted-foreground bg-foreground/5 border border-(--card-border)">
                                                        {q.marks}M
                                                    </span>
                                                )}
                                                {q.question_image && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                                                        <ImageIcon className="h-3 w-3" /> Image
                                                    </span>
                                                )}
                                                {q.is_qotd_eligible && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400">
                                                        <CalendarClock className="h-3 w-3" /> In POTD pool
                                                    </span>
                                                )}
                                                {q.qotd_served_date && (
                                                    <span className="px-2 py-0.5 rounded text-xs text-muted-foreground bg-foreground/5 border border-(--card-border)">
                                                        served {q.qotd_served_date}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {topicMap.get(q.topic_id) || ""}
                                                </span>
                                            </div>
                                            <div className="prose prose-invert max-w-none text-sm text-foreground line-clamp-2">
                                                <Latex>{q.question_text}</Latex>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setPreviewId(q.id)}
                                            className="shrink-0 self-start flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-(--card-border) text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                                            title="Preview full question, image & answer"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> Preview
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ============================ SCHEDULE TAB ============================ */}
            {tab === "schedule" && selClass && selExam && (
                <div className="glass-card p-4 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 text-xs font-bold">
                            2
                        </span>
                        Pick a date (goes live at 12:00 AM IST)
                    </div>
                    <div className="md:max-w-xs">
                        <input
                            type="date"
                            value={schedDate}
                            onChange={(e) => setSchedDate(e.target.value)}
                            className="w-full rounded-lg border border-(--card-border) bg-transparent px-3 py-2 text-sm text-foreground"
                        />
                    </div>

                    {schedDate && (
                        <>
                            <div className="flex items-center justify-between gap-2 border-t border-(--panel-border) pt-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 text-xs font-bold">
                                        3
                                    </span>
                                    Pick question(s) from the eligible pool
                                </div>
                                <div className="flex items-center gap-2">
                                    {loadingExisting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    {existingSchedId && (
                                        <span className="px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs text-brand-600 dark:text-brand-400">
                                            Editing existing schedule
                                        </span>
                                    )}
                                    <span className="px-2.5 py-1 rounded-full bg-foreground/5 border border-(--card-border) text-xs text-muted-foreground">
                                        {schedPicked.length} picked
                                    </span>
                                </div>
                            </div>

                            {/* Served / never-served filter for the eligible pool. */}
                            {poolQuestions.length > 0 && (
                                <div className="inline-flex rounded-lg border border-(--card-border) bg-foreground/5 p-0.5 text-xs w-fit">
                                    {([
                                        { key: "all", label: "All", count: servedCounts.all },
                                        { key: "never", label: "Never served", count: servedCounts.never },
                                        { key: "served", label: "Already served", count: servedCounts.served },
                                    ] as const).map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => setServedFilter(opt.key)}
                                            className={`rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                                                servedFilter === opt.key
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {opt.label}
                                            <span className="ml-1.5 tabular-nums opacity-70">{opt.count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {loadingPool ? (
                                <div className="flex flex-col gap-3">
                                    {[1, 2, 3].map((i) => (
                                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : poolQuestions.length === 0 ? (
                                <div className="p-10 text-center flex flex-col items-center">
                                    <FileText className="h-9 w-9 text-muted-foreground mb-3" />
                                    <h3 className="text-base font-bold text-foreground">No eligible questions</h3>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        Add questions to the POTD pool (Pool tab) for this exam first.
                                    </p>
                                </div>
                            ) : visiblePool.length === 0 ? (
                                <div className="p-10 text-center flex flex-col items-center">
                                    <FileText className="h-9 w-9 text-muted-foreground mb-3" />
                                    <h3 className="text-base font-bold text-foreground">
                                        {servedFilter === "served" ? "No already-served questions" : "No never-served questions"}
                                    </h3>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {servedFilter === "served"
                                            ? "None of the eligible questions for this exam have been served as a POTD yet."
                                            : "Every eligible question for this exam has already been served."}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {visiblePool.map((q) => {
                                        const picked = schedPicked.includes(q.id);
                                        const order = schedPicked.indexOf(q.id) + 1;
                                        return (
                                            <div
                                                key={q.id}
                                                className={`rounded-xl border p-4 flex gap-4 transition-all ${
                                                    picked ? "border-brand-500 bg-brand-500/5" : "border-(--card-border) hover:bg-foreground/5"
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => togglePicked(q.id)}
                                                    aria-label={picked ? "Unpick question" : "Pick question"}
                                                    className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
                                                        picked ? "border-brand-500 bg-brand-500 text-white" : "border-(--card-border) hover:border-brand-500"
                                                    }`}
                                                >
                                                    {picked ? order : ""}
                                                </button>
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => togglePicked(q.id)}
                                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePicked(q.id); } }}
                                                    className="flex-1 min-w-0 cursor-pointer"
                                                >
                                                    <div className="flex flex-wrap gap-2 items-center mb-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${diffColor(q.difficulty)}`}>
                                                            {getDifficultyLabel(q.difficulty)}
                                                        </span>
                                                        {q.type && (
                                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                                                                {typeLabel(q.type)}
                                                            </span>
                                                        )}
                                                        {q.question_image && (
                                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                                                                <ImageIcon className="h-3 w-3" /> Image
                                                            </span>
                                                        )}
                                                        {q.qotd_served_date && (
                                                            <span className="px-2 py-0.5 rounded text-xs text-muted-foreground bg-foreground/5 border border-(--card-border)">
                                                                served {q.qotd_served_date}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="prose prose-invert max-w-none text-sm text-foreground line-clamp-2">
                                                        <Latex>{q.question_text}</Latex>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewId(q.id)}
                                                    className="shrink-0 self-start flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-(--card-border) text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                                                    title="Preview full question, image & answer"
                                                >
                                                    <Eye className="h-3.5 w-3.5" /> Preview
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Ordered selection summary */}
                            {schedPicked.length > 0 && (
                                <div className="border-t border-(--panel-border) pt-3 flex flex-col gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Scheduled order ({schedPicked.length})
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {schedPicked.map((id, i) => (
                                            <span
                                                key={id}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-medium text-brand-600 dark:text-brand-400"
                                            >
                                                {i + 1}. {poolMap.get(id)?.question_text?.slice(0, 24) || "Question"}…
                                                <button
                                                    onClick={() => togglePicked(id)}
                                                    className="ml-0.5 hover:text-destructive transition-colors cursor-pointer"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-3 border-t border-(--panel-border) pt-3">
                                <button
                                    onClick={saveSchedule}
                                    disabled={savingSched || schedPicked.length === 0}
                                    className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {savingSched ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                                    {existingSchedId ? "Update schedule" : "Schedule POTD"}
                                </button>
                                {existingSchedId && (
                                    <button
                                        onClick={deleteSchedule}
                                        disabled={savingSched}
                                        className="flex items-center gap-2 border border-(--card-border) hover:bg-foreground/5 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" /> Clear this day
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Empty initial states */}
            {tab === "pool" && !selSubject && (
                <div className="glass-card p-12 text-center flex flex-col items-center">
                    <CalendarClock className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold text-foreground">Build the POTD pool</h3>
                    <p className="text-muted-foreground mt-1 text-sm max-w-md">
                        Select a class, exam type and subject above. Questions you add to the pool become eligible to be
                        scheduled as the Problem of the Day.
                    </p>
                </div>
            )}
            {tab === "schedule" && (!selClass || !selExam) && (
                <div className="glass-card p-12 text-center flex flex-col items-center">
                    <CalendarDays className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold text-foreground">Schedule a Problem of the Day</h3>
                    <p className="text-muted-foreground mt-1 text-sm max-w-md">
                        Select a class and exam type above, pick a date, then choose question(s) from the eligible pool.
                    </p>
                </div>
            )}

            {/* Full-detail preview (image, options, answer, solution) */}
            <QuestionPreviewModal questionId={previewId} onClose={() => setPreviewId(null)} />
        </div>
    );
}
