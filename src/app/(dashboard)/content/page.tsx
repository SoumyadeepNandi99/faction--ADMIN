"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { Search, Plus, FileText, ChevronLeft, ChevronRight, SlidersHorizontal, X, Tag, ChevronDown, RefreshCw, Upload, Loader2, Database } from "lucide-react";
import "katex/dist/katex.min.css";
import Latex from "react-latex";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";

interface Question {
    id: string;
    topic_id: string;
    question_text: string;
    difficulty: number;
    type?: string;
    exam_type: string[];
    marks?: number;
    hidden: boolean;
    created_at?: string;
}

interface PaginatedResponse {
    questions: Question[];
    total: number;
    skip: number;
    limit: number;
}

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; subject_type: string; class_id: string; }
interface ChapterOption { id: string; name: string; subject_id: string; }
interface TopicOption { id: string; name: string; chapter_id: string; }

const getDifficultyLabel = (diff: number) => diff === 1 ? "EASY" : diff === 2 ? "MEDIUM" : "HARD";
const diffColor = (diff: number) => diff === 1 ? "bg-green-500/10 text-green-500" : diff === 2 ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500";
const typeLabel = (t?: string) => {
    if (!t) return "";
    const map: Record<string, string> = { scq: "SCQ", mcq: "MCQ", integer: "INT", match_the_column: "MATCH" };
    return map[t] || t.toUpperCase();
};

const PAGE_SIZE = 20;

export default function ContentPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDifficulty, setFilterDifficulty] = useState<string>("ALL");
    const [filterHidden, setFilterHidden] = useState(false);
    const [page, setPage] = useState(0);

    // Bulk seed (JSON import)
    const [showSeed, setShowSeed] = useState(false);
    const [seedText, setSeedText] = useState("");
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<{ created_count: number; skipped_count: number; errors: { index: number; error: string }[] } | null>(null);

    // Topic/Chapter/Subject filters
    const [activeTopicFilter, setActiveTopicFilter] = useState("");
    const [activeChapterFilter, setActiveChapterFilter] = useState("");
    const [activeSubjectFilter, setActiveSubjectFilter] = useState("");
    const [topicFilterName, setTopicFilterName] = useState("");
    const [showCascade, setShowCascade] = useState(false);

    // Topic cascade state
    const [fClasses, setFClasses] = useState<ClassOption[]>([]);
    const [fSubjects, setFSubjects] = useState<SubjectOption[]>([]);
    const [fChapters, setFChapters] = useState<ChapterOption[]>([]);
    const [fTopics, setFTopics] = useState<TopicOption[]>([]);
    const [fClass, setFClass] = useState("");
    const [fExam, setFExam] = useState("");
    const [fSubject, setFSubject] = useState("");
    const [fChapter, setFChapter] = useState("");
    const [fTopic, setFTopic] = useState("");

    // Read topic_id URL param on mount — fetch its name for display
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tid = params.get("topic_id");
        if (tid) setActiveTopicFilter(tid);
    }, []);

    // Fetch topic name for display when set via URL param
    const { data: urlTopicData } = useSWR<TopicOption>(
        activeTopicFilter && !topicFilterName ? `/api/v1/topics/${activeTopicFilter}` : null,
        (url: string) => apiClient.get(url).then(r => r.data)
    );
    useEffect(() => {
        if (!urlTopicData) return;
        setTopicFilterName(urlTopicData.name);
    }, [urlTopicData]);

    // Load classes when cascade opens
    useEffect(() => {
        if (!showCascade || fClasses.length > 0) return;
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            setFClasses(Array.isArray(d) ? d : (d.classes || []));
        }).catch(() => {});
    }, [showCascade, fClasses.length]);

    useEffect(() => {
        setFSubjects([]); setFSubject(""); setFChapters([]); setFTopics([]); setFTopic("");
        if (!fClass || !fExam) return;
        apiClient.get(`/api/v1/subjects/?class_id=${fClass}&exam_type=${fExam}`).then(r => {
            const d = r.data;
            setFSubjects(Array.isArray(d) ? d : (d.subjects || []));
        }).catch(() => {});
    }, [fClass, fExam]);

    useEffect(() => {
        if (!fSubject) return;
        apiClient.get(`/api/v1/chapters/?subject_id=${fSubject}`).then(r => {
            const d = r.data;
            setFChapters(Array.isArray(d) ? d : (d.chapters || []));
            setFChapter(""); setFTopics([]); setFTopic("");
        }).catch(() => {});
    }, [fSubject]);

    useEffect(() => {
        if (!fChapter) return;
        apiClient.get(`/api/v1/topics/?chapter_id=${fChapter}`).then(r => {
            const d = r.data;
            setFTopics(Array.isArray(d) ? d : (d.topics || []));
            setFTopic("");
        }).catch(() => {});
    }, [fChapter]);

    const applyTopicFilter = () => {
        if (!fTopic && !fChapter && !fSubject) return;
        // Apply deepest selected filter level
        if (fTopic) {
            const name = fTopics.find(t => t.id === fTopic)?.name || "";
            setActiveTopicFilter(fTopic);
            setActiveChapterFilter("");
            setActiveSubjectFilter("");
            setTopicFilterName(name);
        } else if (fChapter) {
            const name = fChapters.find(c => c.id === fChapter)?.name || "";
            setActiveTopicFilter("");
            setActiveChapterFilter(fChapter);
            setActiveSubjectFilter("");
            setTopicFilterName(`${name} (chapter)`);
        } else if (fSubject) {
            const name = fSubjects.find(s => s.id === fSubject)?.subject_type || "";
            setActiveTopicFilter("");
            setActiveSubjectFilter(fSubject);
            setActiveChapterFilter("");
            setTopicFilterName(`${name} (subject)`);
        }
        setShowCascade(false);
        setPage(0);
    };

    const clearTopicFilter = () => {
        setActiveTopicFilter("");
        setActiveChapterFilter("");
        setActiveSubjectFilter("");
        setTopicFilterName("");
        setFTopic("");
        setPage(0);
    };

    const closeCascade = () => {
        setShowCascade(false);
    };

    const onSeedFile = async (file: File | null) => {
        if (!file) return;
        const text = await file.text();
        setSeedText(text);
    };

    const handleSeed = async () => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(seedText);
        } catch {
            return toast.error("Invalid JSON. Provide an array of question objects.");
        }
        if (!Array.isArray(parsed)) {
            return toast.error("JSON must be an array of question objects.");
        }
        setSeeding(true);
        setSeedResult(null);
        try {
            const res = await apiClient.post("/api/v1/questions/seed", parsed);
            setSeedResult(res.data);
            toast.success(`Seeded ${res.data.created_count} question(s). Skipped ${res.data.skipped_count}.`);
            mutateQuestions();
        } catch (err: unknown) {
            toast.error(getApiError(err, "Seeding failed."));
        } finally {
            setSeeding(false);
        }
    };

    const closeSeed = () => {
        setShowSeed(false);
        setSeedText("");
        setSeedResult(null);
    };

    const hasFilter = !!(activeTopicFilter || activeChapterFilter || activeSubjectFilter);
    const searchParam = searchTerm.length >= 3 ? `&search=${encodeURIComponent(searchTerm)}` : "";
    const diffParam = filterDifficulty !== "ALL" ? `&difficulty=${filterDifficulty}` : "";
    const topicParam = activeTopicFilter ? `&topic_id=${activeTopicFilter}` : "";
    const chapterParam = !activeTopicFilter && activeChapterFilter ? `&chapter_id=${activeChapterFilter}` : "";
    const subjectParam = !activeTopicFilter && !activeChapterFilter && activeSubjectFilter ? `&subject_id=${activeSubjectFilter}` : "";
    const hiddenParam = filterHidden ? `&hidden=true` : "";
    const swrKey = `/api/v1/questions/?skip=${page * PAGE_SIZE}&limit=${PAGE_SIZE}${searchParam}${diffParam}${topicParam}${chapterParam}${subjectParam}${hiddenParam}`;

    const { data, isLoading, error: questionsError, mutate: mutateQuestions } = useSWR<PaginatedResponse>(swrKey, (url: string) =>
        apiClient.get(url).then(r => r.data)
    );

    const questions = data?.questions || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const filteredQuestions = questions;

    const showPagination = !questionsError && totalPages > 1;

    return (
        <>
            <div className="flex flex-col gap-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Question Bank</h1>
                        <p className="text-muted-foreground">Author, review, and manage the core academic content with LaTeX support.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowSeed(true)}
                            className="flex items-center gap-2 border border-(--card-border) hover:bg-foreground/5 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">
                            <Database className="h-4 w-4" /> Seed (Bulk Import)
                        </button>
                        <Link href="/content/create"
                            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm">
                            <Plus className="h-4 w-4" /> Add Question
                        </Link>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="glass-card p-4 flex flex-col gap-3">
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                        {/* Search */}
                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input type="text" placeholder="Search questions…" value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                                className="w-full bg-background border border-(--input) rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Difficulty filter */}
                            <div className="w-40">
                                <CustomSelect value={filterDifficulty}
                                    onChange={(v) => { setFilterDifficulty(v); setPage(0); }}
                                    options={[
                                        { label: "All Difficulties", value: "ALL" },
                                        { label: "Easy", value: "1" },
                                        { label: "Medium", value: "2" },
                                        { label: "Hard", value: "3" },
                                    ]} />
                            </div>

                            {/* Show Hidden toggle */}
                            <button
                                onClick={() => { setFilterHidden(v => !v); setPage(0); }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                                    filterHidden
                                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                        : "border-(--card-border) hover:bg-foreground/5 text-foreground"
                                }`}
                                title="Show questions marked as hidden"
                            >
                                <Tag className="h-4 w-4" />
                                {filterHidden ? "Hidden Only" : "Show Hidden"}
                            </button>

                            {/* Topic filter button */}
                            <button
                                onClick={() => setShowCascade(v => !v)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                                    showCascade || hasFilter
                                        ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                                        : "border-(--card-border) hover:bg-foreground/5 text-foreground"
                                }`}
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                Filter by Topic
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCascade ? "rotate-180" : ""}`} />
                            </button>

                            <span className="text-sm text-muted-foreground whitespace-nowrap">{total} total</span>
                        </div>
                    </div>

                    {/* Topic cascade panel */}
                    {showCascade && (
                        <div className="border-t border-(--panel-border) pt-3 flex flex-col gap-3">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <CustomSelect value={fClass} onChange={v => { setFClass(v); setFExam(""); }} placeholder="Class"
                                    options={fClasses.map(c => ({ label: c.name, value: c.id }))} />
                                <CustomSelect value={fExam} onChange={setFExam} placeholder="Exam type"
                                    options={EXAM_TYPE_OPTIONS} disabled={!fClass} />
                                <CustomSelect value={fSubject} onChange={setFSubject} placeholder="Subject"
                                    options={fSubjects.map(c => ({ label: c.subject_type, value: c.id }))} disabled={!fSubjects.length} />
                                <CustomSelect value={fChapter} onChange={setFChapter} placeholder="Chapter"
                                    options={fChapters.map(c => ({ label: c.name, value: c.id }))} disabled={!fChapters.length} />
                                <CustomSelect value={fTopic} onChange={setFTopic} placeholder="Topic"
                                    options={fTopics.map(c => ({ label: c.name, value: c.id }))} disabled={!fTopics.length} />
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={applyTopicFilter}
                                    disabled={!fSubject && !fChapter && !fTopic}
                                    className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Apply Filter
                                </button>
                                <button onClick={closeCascade}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active filter chips */}
                    {(hasFilter || filterHidden || (searchTerm.length >= 3)) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            {hasFilter && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-medium text-brand-600 dark:text-brand-400">
                                    <Tag className="h-3 w-3" />
                                    {topicFilterName || "Filter Active"}
                                    <button onClick={clearTopicFilter} className="ml-0.5 hover:text-destructive transition-colors cursor-pointer">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {filterHidden && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                    <Tag className="h-3 w-3" /> Showing hidden questions
                                </span>
                            )}
                            {searchTerm.length >= 3 && (
                                <span className="text-xs text-muted-foreground">
                                    {total} result{total !== 1 ? "s" : ""} found
                                </span>
                            )}
                            {searchTerm.length > 0 && searchTerm.length < 3 && (
                                <span className="text-xs text-muted-foreground">
                                    Type 3+ characters to search
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Questions List */}
                <div className="flex flex-col gap-4">
                    {isLoading ? (
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="glass-card p-6 flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-2">
                                            <Skeleton className="h-6 w-16 rounded-md" />
                                            <Skeleton className="h-6 w-20 rounded-md" />
                                        </div>
                                        <Skeleton className="h-4 w-24 rounded-md" />
                                    </div>
                                    <Skeleton className="h-16 w-full rounded-md" />
                                </div>
                            ))}
                        </div>
                    ) : questionsError ? (
                        /* Fix #1: distinct error state */
                        <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
                            <RefreshCw className="h-8 w-8 text-destructive/50" />
                            <h3 className="text-lg font-bold text-foreground">Failed to Load Questions</h3>
                            <p className="text-muted-foreground text-sm">Could not fetch questions from the server.</p>
                            <button onClick={() => mutateQuestions()}
                                className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                                Retry
                            </button>
                        </div>
                    ) : filteredQuestions.length === 0 ? (
                        <div className="glass-card p-12 text-center flex flex-col items-center">
                            <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-bold text-foreground">No Questions Found</h3>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {hasFilter ? "No questions match this filter." : filterHidden ? "No hidden questions found." : "Try adjusting your filters or add a new question."}
                            </p>
                            {hasFilter && (
                                <button onClick={clearTopicFilter} className="mt-3 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                                    Clear filter
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredQuestions.map((q) => (
                            <Link key={q.id} href={`/content/${q.id}`}
                                className="glass-card flex flex-col p-6 group hover:border-brand-500/30 transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${diffColor(q.difficulty)}`}>
                                            {getDifficultyLabel(q.difficulty)}
                                        </span>
                                        {q.type && (
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                                                {typeLabel(q.type)}
                                            </span>
                                        )}
                                        {q.marks && (
                                            <span className="px-2 py-1 rounded text-xs text-muted-foreground bg-foreground/5 border border-(--card-border)">
                                                {q.marks}M
                                            </span>
                                        )}
                                        {q.hidden && (
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/10 text-yellow-500">
                                                Hidden
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground font-mono bg-foreground/5 px-2 py-1 rounded border border-(--card-border)">
                                            {q.id.slice(0, 8)}...
                                        </span>
                                    </div>
                                    <span className="text-sm font-medium text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        View →
                                    </span>
                                </div>
                                <div className="prose prose-invert max-w-none text-foreground mb-4 line-clamp-3">
                                    <Latex>{q.question_text}</Latex>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {q.exam_type?.map((et) => (
                                        <span key={et} className="px-2 py-1 rounded-full bg-foreground/5 text-xs font-medium text-muted-foreground border border-(--card-border)">
                                            {et}
                                        </span>
                                    ))}
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                {/* Pagination — only in normal browsing mode */}
                {showPagination && (
                    <div className="flex items-center justify-center gap-3 mt-2">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                            className="p-2 rounded-lg border border-(--card-border) hover:bg-foreground/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                            <ChevronLeft className="h-4 w-4 text-foreground" />
                        </button>
                        <span className="text-sm text-muted-foreground">
                            Page <span className="font-semibold text-foreground">{page + 1}</span> of {totalPages}
                        </span>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                            className="p-2 rounded-lg border border-(--card-border) hover:bg-foreground/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                            <ChevronRight className="h-4 w-4 text-foreground" />
                        </button>
                    </div>
                )}
            </div>

            {/* Bulk seed modal */}
            {showSeed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Seed Questions</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Bulk-import a JSON array. Hierarchy (Class → Subject → Chapter → Topic) is auto-created.</p>
                            </div>
                            <button type="button" onClick={closeSeed}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                            <label className="flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-500 cursor-pointer font-medium">
                                <Upload className="h-4 w-4" /> Upload .json
                                <input type="file" accept="application/json,.json" className="hidden"
                                    onChange={e => onSeedFile(e.target.files?.[0] || null)} />
                            </label>
                            <span className="text-xs text-muted-foreground">or paste below</span>
                        </div>

                        <textarea value={seedText} onChange={e => setSeedText(e.target.value)}
                            placeholder={`[\n  {\n    "class_level": "Eleventh",\n    "subject_type": "PHYSICS",\n    "chapter_name": "Kinematics",\n    "topic_name": "Projectile Motion",\n    "exam_types": ["JEE_MAINS"],\n    "question": {\n      "type": "scq",\n      "difficulty": 2,\n      "exam_type": ["JEE_MAINS"],\n      "question_text": "...",\n      "marks": 4,\n      "solution_text": "...",\n      "scq_options": ["A","B","C","D"],\n      "scq_correct_options": 0\n    }\n  }\n]`}
                            className="flex-1 min-h-[260px] w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:ring-2 focus:ring-brand-500 outline-none resize-none" />

                        {seedResult && (
                            <div className="mt-3 text-sm">
                                <p className="text-foreground">
                                    <span className="text-green-600 dark:text-green-400 font-semibold">{seedResult.created_count} created</span>
                                    {" · "}
                                    <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{seedResult.skipped_count} skipped</span>
                                </p>
                                {seedResult.errors?.length > 0 && (
                                    <div className="mt-2 max-h-24 overflow-y-auto text-xs text-destructive space-y-0.5">
                                        {seedResult.errors.map((er, i) => (
                                            <p key={i}>#{er.index}: {er.error}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-4 shrink-0">
                            <button type="button" onClick={closeSeed}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer">Close</button>
                            <button type="button" onClick={handleSeed} disabled={seeding || !seedText.trim()}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-24 cursor-pointer disabled:opacity-60">
                                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Seed Questions"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
