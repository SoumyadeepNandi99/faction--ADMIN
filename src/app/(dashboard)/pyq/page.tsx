"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { GraduationCap, Loader2, Filter, Link2, Unlink, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import "katex/dist/katex.min.css";
import Latex from "react-latex";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { confirmAction } from "@/components/ui/confirm-modal";
import { EXAM_TYPE_OPTIONS, formatExamType } from "@/lib/exam-types";

interface PYQQuestion {
    id: string;
    question_id: string;
    year: number;
    exam_detail: string[];
    question_text?: string;
}

interface QuestionResult {
    id: string;
    question_text: string;
    difficulty?: number;
    type?: string;
}

interface SubjectOption { id: string; subject_type: string; }
interface ChapterOption { id: string; name: string; }
interface TopicOption { id: string; name: string; }
interface ClassOption { id: string; name: string; }

const DIFF_LABELS: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };
const DIFF_STYLES: Record<number, string> = {
    1: "bg-green-500/10 text-green-600 dark:text-green-400",
    2: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    3: "bg-red-500/10 text-red-500",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

export default function PYQPage() {
    const [filterExam, setFilterExam] = useState("JEE_MAINS");
    const [filterYear, setFilterYear] = useState(String(CURRENT_YEAR));
    const [listSearch, setListSearch] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [questionId, setQuestionId] = useState("");
    const [linkYear, setLinkYear] = useState(String(CURRENT_YEAR));
    const [linkExam, setLinkExam] = useState("JEE_MAINS");

    const [questionSearch, setQuestionSearch] = useState("");
    const [selectedQuestion, setSelectedQuestion] = useState<QuestionResult | null>(null);
    const [searchResults, setSearchResults] = useState<QuestionResult[]>([]);

    // Filter state for modal question lookup
    const [linkDifficulty, setLinkDifficulty] = useState("ALL");
    const [linkClassId, setLinkClassId] = useState("");
    const [linkSubjectId, setLinkSubjectId] = useState("");
    const [linkChapterId, setLinkChapterId] = useState("");
    const [linkTopicId, setLinkTopicId] = useState("");
    const [linkClasses, setLinkClasses] = useState<ClassOption[]>([]);
    const [linkSubjectsLoading, setLinkSubjectsLoading] = useState(false);
    const [linkSubjects, setLinkSubjects] = useState<SubjectOption[]>([]);
    const [linkChapters, setLinkChapters] = useState<ChapterOption[]>([]);
    const [linkTopics, setLinkTopics] = useState<TopicOption[]>([]);
    const [modalQuestions, setModalQuestions] = useState<QuestionResult[]>([]);
    const [modalQuestionsLoading, setModalQuestionsLoading] = useState(false);

    const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
    // null = fetched but unavailable, string = fetched text, key absent = not yet fetched
    const [questionsCache, setQuestionsCache] = useState<Record<string, string | null>>({});

    const swrKey = `/api/v1/pyq/?exam_type=${filterExam}&year=${filterYear}`;
    const { data, isLoading: loading, mutate } = useSWR<PYQQuestion[]>(swrKey, (url: string) =>
        apiClient.get(url).then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : (d.questions || d.pyqs || []);
        }).catch(() => [])
    );
    const pyqs = data || [];

    // Enrich PYQs missing question_text by fetching from questions API
    useEffect(() => {
        if (!pyqs.length) return;
        // Only fetch for IDs not yet attempted (key absent from cache)
        const missing = pyqs.filter(p => !p.question_text && !(p.question_id in questionsCache));
        if (!missing.length) return;
        Promise.all(
            missing.map(p =>
                apiClient.get(`/api/v1/questions/${p.question_id}`)
                    .then(r => ({ id: p.question_id, text: (r.data.question_text as string) || null }))
                    .catch(() => ({ id: p.question_id, text: null }))
            )
        ).then(results => {
            setQuestionsCache(prev => {
                const next = { ...prev };
                results.forEach(({ id, text }) => { next[id] = text; });
                return next;
            });
        });
    }, [pyqs]);

    // undefined = not yet fetched (show spinner), null = fetched but not found, string = text to show
    const getQuestionText = (pyq: PYQQuestion): string | null | undefined => {
        if (pyq.question_text) return pyq.question_text;
        if (pyq.question_id in questionsCache) return questionsCache[pyq.question_id];
        return undefined;
    };

    const filteredPyqs = pyqs
        .filter(p => getQuestionText(p) !== null)  // hide entries whose question couldn't be fetched
        .filter(p => !listSearch.trim() || (getQuestionText(p) ?? "").toString().toLowerCase().includes(listSearch.toLowerCase()));

    // Load classes when modal opens
    useEffect(() => {
        if (!isModalOpen) return;
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            setLinkClasses(Array.isArray(d) ? d : (d.classes || []));
        }).catch(() => {});
    }, [isModalOpen]);

    // Subjects are scoped by BOTH class_id and exam_type — only fetch once both are set.
    useEffect(() => {
        if (!isModalOpen || !linkClassId || !linkExam) {
            setLinkSubjects([]);
            setLinkSubjectId("");
            setLinkChapterId("");
            setLinkTopics([]);
            setLinkTopicId("");
            return;
        }
        setLinkSubjectsLoading(true);
        apiClient.get(`/api/v1/subjects/?class_id=${linkClassId}&exam_type=${linkExam}`).then(r => {
            const d = r.data;
            setLinkSubjects(Array.isArray(d) ? d : (d.subjects || []));
            setLinkSubjectId("");
            setLinkChapterId("");
            setLinkTopics([]);
            setLinkTopicId("");
        }).catch(() => {}).finally(() => setLinkSubjectsLoading(false));
    }, [isModalOpen, linkClassId, linkExam]);

    // Load chapters when subject changes
    useEffect(() => {
        if (!linkSubjectId) { setLinkChapters([]); setLinkChapterId(""); setLinkTopics([]); setLinkTopicId(""); return; }
        apiClient.get(`/api/v1/chapters/?subject_id=${linkSubjectId}`).then(r => {
            const d = r.data;
            setLinkChapters(Array.isArray(d) ? d : (d.chapters || []));
            setLinkChapterId("");
            setLinkTopics([]);
            setLinkTopicId("");
        }).catch(() => {});
    }, [linkSubjectId]);

    // Load topics when chapter changes
    useEffect(() => {
        if (!linkChapterId) { setLinkTopics([]); setLinkTopicId(""); return; }
        apiClient.get(`/api/v1/topics/?chapter_id=${linkChapterId}`).then(r => {
            const d = r.data;
            setLinkTopics(Array.isArray(d) ? d : (d.topics || []));
            setLinkTopicId("");
        }).catch(() => {});
    }, [linkChapterId]);

    // Fetch questions from server whenever filters change
    useEffect(() => {
        const hasFilter = !!(linkSubjectId || linkChapterId || linkTopicId || linkDifficulty !== "ALL");
        if (!isModalOpen || !hasFilter) { setModalQuestions([]); return; }

        // topic_id as query param causes 500 — use the dedicated topic endpoint when topic is selected
        const chapterParam = !linkTopicId && linkChapterId  ? `&chapter_id=${linkChapterId}` : "";
        const subjectParam = !linkTopicId && !linkChapterId && linkSubjectId ? `&subject_id=${linkSubjectId}` : "";
        const diffParam    = linkDifficulty !== "ALL" ? `&difficulty=${linkDifficulty}` : "";

        const url = linkTopicId
            ? `/api/v1/topics/${linkTopicId}/questions`
            : `/api/v1/questions/?skip=0&limit=100${chapterParam}${subjectParam}${diffParam}`;

        setModalQuestionsLoading(true);
        apiClient.get(url)
            .then(r => {
                const d = r.data;
                // topic endpoint returns { id, name, chapter_id, questions: [...] }
                const rawList = linkTopicId ? (d.questions || []) : (Array.isArray(d) ? d : (d.questions || []));
                setModalQuestions(rawList.map((q: any) => ({
                    id: q.id,
                    question_text: q.question_text || "",
                    difficulty: q.difficulty,
                    type: q.type,
                })));
            })
            .catch(() => {})
            .finally(() => setModalQuestionsLoading(false));
    }, [isModalOpen, linkSubjectId, linkChapterId, linkTopicId, linkDifficulty]);

    const openModal = () => {
        setQuestionId("");
        setLinkYear(String(CURRENT_YEAR));
        setLinkExam("");
        setQuestionSearch("");
        setSelectedQuestion(null);
        setSearchResults([]);
        setLinkDifficulty("ALL");
        setLinkClassId("");
        setLinkSubjectId("");
        setLinkChapterId("");
        setLinkTopicId("");
        setModalQuestions([]);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setQuestionId("");
        setLinkYear(String(CURRENT_YEAR));
        setLinkExam("");
        setQuestionSearch("");
        setSelectedQuestion(null);
        setSearchResults([]);
        setLinkDifficulty("ALL");
        setLinkClassId("");
        setLinkSubjectId("");
        setLinkChapterId("");
        setLinkTopicId("");
        setModalQuestions([]);
    };

    const handleQuestionSearch = (query: string) => {
        setQuestionSearch(query);
        setSelectedQuestion(null);
        setQuestionId("");
        if (query.trim().length < 2) { setSearchResults([]); return; }
        const lower = query.toLowerCase();
        setSearchResults(
            modalQuestions.filter(q => q.question_text.toLowerCase().includes(lower)).slice(0, 8)
        );
    };

    const selectQuestion = (q: QuestionResult) => {
        setSelectedQuestion(q);
        setQuestionId(q.id);
        setQuestionSearch("");
        setSearchResults([]);
    };

    const handleLink = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!questionId.trim() || !linkExam) return;
        setIsSubmitting(true);
        try {
            await apiClient.post("/api/v1/pyq/", {
                question_id: questionId,
                year: Number(linkYear),
                exam_type: linkExam,
            });
            closeModal();
            mutate();
            toast.success("PYQ linked successfully.");
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to link PYQ. Make sure the Question ID is correct."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnlink = async (pyqId: string) => {
        if (!(await confirmAction({ title: "Confirm Action", description: "Remove this PYQ link?" }))) return;
        setUnlinkingId(pyqId);
        try {
            await apiClient.delete(`/api/v1/pyq/question/${pyqId}`);
            mutate(pyqs.filter(p => p.id !== pyqId), false);
            toast.success("PYQ link removed.");
        } catch {
            toast.error("Failed to remove PYQ link.");
        } finally {
            setUnlinkingId(null);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">PYQ Manager</h1>
                        <p className="text-muted-foreground">Link questions to Previous Year Question records by exam and year.</p>
                    </div>
                    <button onClick={openModal}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">
                        <Link2 className="h-4 w-4" /> Link PYQ
                    </button>
                </div>

                {/* Filters */}
                <div className="glass-card p-4 flex flex-col gap-3">
                    {/* Row 1: exam + year + record count */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                            <CustomSelect value={filterExam} onChange={v => { setFilterExam(v); setListSearch(""); }}
                                options={EXAM_TYPE_OPTIONS} />
                        </div>
                        <div className="w-24 sm:w-28 shrink-0">
                            <CustomSelect value={filterYear} onChange={v => { setFilterYear(v); setListSearch(""); }}
                                options={YEARS.map(y => ({ label: String(y), value: String(y) }))} />
                        </div>
                    </div>
                    {/* Row 2: search + record count */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search within results…"
                                value={listSearch}
                                onChange={e => setListSearch(e.target.value)}
                                className="w-full bg-background border border-(--input) rounded-lg pl-8 pr-8 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                            {listSearch && (
                                <button onClick={() => setListSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
                            {filteredPyqs.length}{listSearch ? ` / ${pyqs.length}` : ""} records
                        </span>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="glass-card p-5 flex gap-4">
                                <Skeleton className="h-6 w-16 rounded" />
                                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div>
                                <Skeleton className="h-8 w-8 rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : filteredPyqs.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <GraduationCap className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No PYQs Found</h3>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {listSearch
                                ? `No results for "${listSearch}" in ${formatExamType(filterExam)} ${filterYear}.`
                                : `Link existing questions to PYQ records for ${formatExamType(filterExam)} ${filterYear}.`}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredPyqs.map((pyq, i) => {
                            const qText = getQuestionText(pyq);
                            return (
                                <div key={pyq.id || i} className="glass-card p-4 sm:p-5 flex items-start gap-3 sm:gap-4 group">
                                    <div className="shrink-0 pt-0.5">
                                        <span className="px-2 py-1 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded text-xs font-bold border border-brand-500/20 whitespace-nowrap">
                                            {pyq.year}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="prose prose-invert max-w-none text-sm text-foreground mb-2">
                                            {qText === undefined
                                                ? <span className="flex items-center gap-1.5 text-muted-foreground text-xs italic">
                                                    <Loader2 className="h-3 w-3 animate-spin shrink-0" /> Loading question…
                                                  </span>
                                                : qText === null
                                                    ? <span className="text-muted-foreground text-xs italic">Question not available</span>
                                                    : <Latex>{`${qText.slice(0, 200)}${qText.length > 200 ? "…" : ""}`}</Latex>
                                            }
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {(pyq.exam_detail || []).map((e) => (
                                                <span key={e} className="text-xs text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded border border-(--card-border)">
                                                    {formatExamType(e)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnlink(pyq.id)}
                                        disabled={unlinkingId === pyq.id}
                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-100 cursor-pointer shrink-0">
                                        {unlinkingId === pyq.id
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Unlink className="h-4 w-4" />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Link PYQ Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex items-start justify-between mb-1">
                            <h2 className="text-xl font-bold text-foreground">Link PYQ</h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-5">Associate an existing question with a previous year exam.</p>

                        <form onSubmit={handleLink} className="space-y-4">
                            {/* Filter controls to narrow down questions */}
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-foreground">Narrow by filter</label>
                                {/* Class + Exam Type must both be selected before subjects load */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <CustomSelect
                                            value={linkClassId}
                                            onChange={v => setLinkClassId(v)}
                                            options={[
                                                { label: "Select Class", value: "" },
                                                ...linkClasses.map(c => ({ label: c.name, value: c.id })),
                                            ]}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <CustomSelect
                                            value={linkExam}
                                            onChange={setLinkExam}
                                            options={[
                                                { label: "Select Exam", value: "" },
                                                ...EXAM_TYPE_OPTIONS,
                                            ]}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <CustomSelect
                                            value={linkSubjectId}
                                            onChange={v => setLinkSubjectId(v)}
                                            disabled={!linkClassId || !linkExam || linkSubjectsLoading}
                                            options={[
                                                { label: linkSubjectsLoading ? "Loading subjects…" : "All Subjects", value: "" },
                                                ...linkSubjects.map(s => ({ label: s.subject_type, value: s.id })),
                                            ]}
                                        />
                                    </div>
                                    <div className="w-28 shrink-0">
                                        <CustomSelect
                                            value={linkDifficulty}
                                            onChange={setLinkDifficulty}
                                            options={[
                                                { label: "All Diff.", value: "ALL" },
                                                { label: "Easy", value: "1" },
                                                { label: "Medium", value: "2" },
                                                { label: "Hard", value: "3" },
                                            ]}
                                        />
                                    </div>
                                </div>
                                {linkSubjectId && (
                                    <CustomSelect
                                        value={linkChapterId}
                                        onChange={v => setLinkChapterId(v)}
                                        options={[
                                            { label: "All Chapters", value: "" },
                                            ...linkChapters.map(c => ({ label: c.name, value: c.id })),
                                        ]}
                                    />
                                )}
                                {linkChapterId && (
                                    <CustomSelect
                                        value={linkTopicId}
                                        onChange={setLinkTopicId}
                                        options={[
                                            { label: "All Topics", value: "" },
                                            ...linkTopics.map(t => ({ label: t.name, value: t.id })),
                                        ]}
                                    />
                                )}
                                {modalQuestionsLoading && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Loading questions…
                                    </p>
                                )}
                                {!modalQuestionsLoading && modalQuestions.length > 0 && (
                                    <p className="text-xs text-muted-foreground">{modalQuestions.length} question{modalQuestions.length !== 1 ? "s" : ""} loaded</p>
                                )}
                            </div>

                            {/* Question search */}
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Search Question *</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={questionSearch}
                                        onChange={e => handleQuestionSearch(e.target.value)}
                                        placeholder={
                                            modalQuestionsLoading
                                                ? "Loading questions…"
                                                : modalQuestions.length === 0
                                                    ? "Select a filter above to load questions…"
                                                    : "Type to search question text…"
                                        }
                                        disabled={modalQuestionsLoading || modalQuestions.length === 0}
                                        className="w-full bg-background border border-(--input) rounded-lg pl-8 pr-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-60"
                                    />
                                </div>

                                {/* Search results dropdown */}
                                {searchResults.length > 0 && (
                                    <div className="mt-1 border border-(--border) rounded-lg overflow-hidden bg-card shadow-lg">
                                        {searchResults.map(q => (
                                            <button key={q.id} type="button" onClick={() => selectQuestion(q)}
                                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-foreground/5 transition-colors border-b border-(--border) last:border-0 cursor-pointer">
                                                <div className="text-foreground line-clamp-2 mb-1">
                                                    <Latex>{q.question_text.slice(0, 140)}</Latex>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {q.difficulty && (
                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${DIFF_STYLES[q.difficulty] ?? ""}`}>
                                                            {DIFF_LABELS[q.difficulty] ?? q.difficulty}
                                                        </span>
                                                    )}
                                                    {q.type && <span className="text-xs text-muted-foreground uppercase">{q.type}</span>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {questionSearch.length >= 2 && searchResults.length === 0 && !modalQuestionsLoading && modalQuestions.length > 0 && (
                                    <p className="mt-1 text-xs text-muted-foreground px-1">No questions match. Try different keywords or paste an ID below.</p>
                                )}
                            </div>

                            {/* Selected question preview */}
                            {selectedQuestion && (
                                <div className="p-3 bg-brand-500/5 border border-brand-500/20 rounded-xl">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Selected Question</span>
                                        <button type="button" onClick={() => { setSelectedQuestion(null); setQuestionId(""); }}
                                            className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <div className="text-sm text-foreground line-clamp-3">
                                        <Latex>{selectedQuestion.question_text.slice(0, 200)}</Latex>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono mt-1">{selectedQuestion.id}</p>
                                </div>
                            )}

                            {/* Manual ID fallback */}
                            {!selectedQuestion && (
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Or paste Question ID directly</label>
                                    <input type="text" value={questionId} onChange={e => setQuestionId(e.target.value)}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                        placeholder="Paste question UUID…" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Year *</label>
                                    <CustomSelect value={linkYear} onChange={setLinkYear}
                                        options={YEARS.map(y => ({ label: String(y), value: String(y) }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Exam Type *</label>
                                    <CustomSelect value={linkExam} onChange={setLinkExam}
                                        options={EXAM_TYPE_OPTIONS} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={closeModal}
                                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting || !questionId.trim() || !linkExam}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-20 cursor-pointer disabled:opacity-60">
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link PYQ"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
