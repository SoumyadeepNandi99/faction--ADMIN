"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { ArrowLeft, FileText, Plus, Loader2, Trash2, ChevronDown, ChevronRight, Eye, BookOpen, MoveRight, X } from "lucide-react";
import Link from "next/link";
import "katex/dist/katex.min.css";
import Latex from "react-latex";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";

interface TopicItem {
    id: string;
    name: string;
    chapter_id: string;
}

interface QuestionItem {
    id: string;
    question_text: string;
    difficulty: number;
    type?: string;
    exam_type?: string[];
    marks?: number;
}

interface ClassOption { id: string; name: string; }
// Fix #18: API returns subject_type not name
interface SubjectOption { id: string; subject_type: string; class_id: string; }
interface ChapterOption { id: string; name: string; subject_id: string; }
interface TopicOption { id: string; name: string; chapter_id: string; }

const diffLabel = (d: number) => d === 1 ? "EASY" : d === 2 ? "MEDIUM" : "HARD";
const diffColor = (d: number) => d === 1 ? "bg-green-500/10 text-green-500" : d === 2 ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500";

// ─── Topic Row Sub-component (uses SWR for cached question loading) ────────────
interface TopicRowProps {
    topic: TopicItem;
    allTopics: TopicItem[];
    onDelete: (id: string, name: string) => void;
    onMove: (q: QuestionItem, currentTopicId: string) => void;
}

function TopicRow({ topic, allTopics, onDelete, onMove }: TopicRowProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const { data: questions, isLoading: isLoadingQ } = useSWR<QuestionItem[]>(
        isExpanded ? `/api/v1/questions/?topic_id=${topic.id}&limit=50` : null,
        (url: string) => apiClient.get(url).then(r => r.data.questions || [])
    );

    return (
        <div className="glass-card overflow-hidden transition-all">
            {/* Topic Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 group">
                <button
                    onClick={() => setIsExpanded(v => !v)}
                    className="flex items-center gap-4 text-left flex-1 cursor-pointer"
                >
                    <div className="p-3 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground group-hover:text-brand-500 transition-colors">
                            {topic.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {isExpanded ? "Click to collapse" : "Click to view questions"}
                        </p>
                    </div>
                    <div className="p-2 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </div>
                </button>

                <div className="flex items-center gap-3 mt-3 sm:mt-0 sm:ml-4">
                    <Link
                        href={`/content?topic_id=${topic.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-colors"
                    >
                        <Eye className="h-4 w-4" /> View All
                    </Link>
                    <button
                        onClick={() => onDelete(topic.id, topic.name)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete Topic"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Expanded Questions Section */}
            {isExpanded && (
                <div className="border-t border-(--panel-border) bg-foreground/2 px-5 py-4">
                    {isLoadingQ ? (
                        <div className="flex flex-col gap-3">
                            {[1, 2].map(i => (
                                <div key={i} className="p-4 bg-background/50 rounded-xl border border-(--card-border)">
                                    <div className="flex gap-2 mb-2"><Skeleton className="h-5 w-14 rounded" /><Skeleton className="h-5 w-20 rounded" /></div>
                                    <Skeleton className="h-10 w-full rounded" />
                                </div>
                            ))}
                        </div>
                    ) : !questions || questions.length === 0 ? (
                        <div className="text-center py-8 flex flex-col items-center">
                            <BookOpen className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                            <p className="text-sm text-muted-foreground">No questions linked to this topic yet.</p>
                            <Link href="/content/create" className="mt-2 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors">
                                + Add a question
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {questions.length} Question{questions.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            {questions.slice(0, 10).map((q) => (
                                <div key={q.id} className="group/q relative p-4 bg-background/50 rounded-xl border border-(--card-border) hover:border-brand-500/30 transition-all">
                                    <Link href={`/content/${q.id}`} className="block">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${diffColor(q.difficulty)}`}>
                                                {diffLabel(q.difficulty)}
                                            </span>
                                            {q.type && (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                                                    {q.type.toUpperCase()}
                                                </span>
                                            )}
                                            {q.exam_type?.map(et => (
                                                <span key={et} className="px-2 py-0.5 rounded-full text-xs bg-foreground/5 text-muted-foreground">
                                                    {et}
                                                </span>
                                            ))}
                                            <span className="ml-auto text-xs text-muted-foreground font-mono opacity-0 group-hover/q:opacity-100 transition-opacity pr-24">
                                                View →
                                            </span>
                                        </div>
                                        <div className="prose prose-invert max-w-none text-foreground text-sm line-clamp-2">
                                            <Latex>{q.question_text.slice(0, 300)}</Latex>
                                        </div>
                                    </Link>
                                    {/* Move button with label */}
                                    <button
                                        onClick={() => onMove(q, topic.id)}
                                        title="Move to another topic"
                                        className="absolute top-3 right-3 opacity-0 group-hover/q:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-lg bg-foreground/5 hover:bg-brand-500/10 text-muted-foreground hover:text-brand-500 text-xs font-medium cursor-pointer"
                                    >
                                        <MoveRight className="h-3.5 w-3.5" /> Move
                                    </button>
                                </div>
                            ))}
                            {questions.length > 10 && (
                                <Link href={`/content?topic_id=${topic.id}`}
                                    className="text-center text-sm text-brand-500 hover:text-brand-400 font-medium py-2 transition-colors">
                                    View all {questions.length} questions →
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ChapterTopicsPage() {
    const params = useParams();
    const chapterId = params.chapterId as string;

    // Create topic modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTopicName, setNewTopicName] = useState("");
    const [newTopicDesc, setNewTopicDesc] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Move question modal
    const [moveQuestion, setMoveQuestion] = useState<{ id: string; text: string; currentTopicId: string } | null>(null);
    const [moveTargetTopicId, setMoveTargetTopicId] = useState("");
    const [isMoving, setIsMoving] = useState(false);
    const [crossChapter, setCrossChapter] = useState(false);

    // Cross-chapter cascade state
    const [moveClasses, setMoveClasses] = useState<ClassOption[]>([]);
    const [moveSubjects, setMoveSubjects] = useState<SubjectOption[]>([]);
    const [moveChapters, setMoveChapters] = useState<ChapterOption[]>([]);
    const [moveCTopics, setMoveCTopics] = useState<TopicOption[]>([]);
    const [moveSClass, setMoveSClass] = useState("");
    const [moveSExam, setMoveSExam] = useState("");
    const [moveSSubject, setMoveSSubject] = useState("");
    const [moveSChapter, setMoveSChapter] = useState("");

    const fetchTopics = async () => {
        const res = await apiClient.get(`/api/v1/topics/?chapter_id=${chapterId}`);
        const data = res.data;
        if (Array.isArray(data)) return data;
        if (data.topics && Array.isArray(data.topics)) return data.topics;
        throw new Error("Invalid Format");
    };

    const { data: topicsData, isLoading: loading, mutate } = useSWR(`/api/v1/topics/?chapter_id=${chapterId}`, fetchTopics);
    const topics: TopicItem[] = topicsData || [];

    // Cross-chapter cascade effects
    useEffect(() => {
        if (!crossChapter) return;
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            setMoveClasses(Array.isArray(d) ? d : (d.classes || []));
        }).catch(() => {});
    }, [crossChapter]);

    useEffect(() => {
        setMoveSubjects([]); setMoveSSubject(""); setMoveChapters([]); setMoveCTopics([]); setMoveTargetTopicId("");
        if (!moveSClass || !moveSExam) return;
        apiClient.get(`/api/v1/subjects/?class_id=${moveSClass}&exam_type=${moveSExam}`).then(r => {
            const d = r.data;
            setMoveSubjects(Array.isArray(d) ? d : (d.subjects || []));
        }).catch(() => {});
    }, [moveSClass, moveSExam]);

    useEffect(() => {
        if (!moveSSubject) return;
        apiClient.get(`/api/v1/chapters/?subject_id=${moveSSubject}`).then(r => {
            const d = r.data;
            setMoveChapters(Array.isArray(d) ? d : (d.chapters || []));
            setMoveSChapter(""); setMoveCTopics([]); setMoveTargetTopicId("");
        }).catch(() => {});
    }, [moveSSubject]);

    useEffect(() => {
        if (!moveSChapter) return;
        apiClient.get(`/api/v1/topics/?chapter_id=${moveSChapter}`).then(r => {
            const d = r.data;
            setMoveCTopics(Array.isArray(d) ? d : (d.topics || []));
            setMoveTargetTopicId("");
        }).catch(() => {});
    }, [moveSChapter]);

    const closeTopicModal = () => {
        setIsModalOpen(false);
        setNewTopicName("");
        setNewTopicDesc("");
    };

    const handleCreateTopic = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newTopicName.trim()) return;
        setIsSubmitting(true);
        try {
            const res = await apiClient.post("/api/v1/topics/", {
                name: newTopicName,
                chapter_id: chapterId,
                ...(newTopicDesc.trim() ? { description: newTopicDesc } : {}),
            });
            // Fix #19: optimistic insert instead of full refetch
            mutate((cur: TopicItem[] | undefined) => [...(cur || []), res.data], false);
            closeTopicModal();
            toast.success("Topic created successfully.");
        } catch {
            toast.error("Failed to create Topic");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTopic = async (id: string, name: string) => {
        // Fix #16: destructive
    if (!(await confirmAction({ title: "Delete Topic", description: `Delete topic "${name}"? This removes any attached questions.`, destructive: true }))) return;
        try {
            await apiClient.delete(`/api/v1/topics/${id}`);
            mutate(topics.filter((t: TopicItem) => t.id !== id), false);
            toast.success("Topic deleted.");
        } catch {
            toast.error("Failed to delete Topic.");
        }
    };

    const openMoveModal = (q: QuestionItem, currentTopicId: string) => {
        setMoveQuestion({ id: q.id, text: q.question_text, currentTopicId });
        setMoveTargetTopicId("");
        setCrossChapter(false);
    };

    const closeMoveModal = () => {
        setMoveQuestion(null);
        setMoveTargetTopicId("");
        setCrossChapter(false);
        setMoveClasses([]); setMoveSubjects([]); setMoveChapters([]); setMoveCTopics([]);
        setMoveSClass(""); setMoveSExam(""); setMoveSSubject(""); setMoveSChapter("");
    };

    const switchToCrossChapter = () => {
        setCrossChapter(true);
        setMoveTargetTopicId("");
    };

    const switchToSameChapter = () => {
        setCrossChapter(false);
        setMoveTargetTopicId("");
        setMoveSubjects([]); setMoveChapters([]); setMoveCTopics([]);
        setMoveSClass(""); setMoveSExam(""); setMoveSSubject(""); setMoveSChapter("");
    };

    const handleMoveQuestion = async () => {
        if (!moveQuestion || !moveTargetTopicId) return;
        setIsMoving(true);
        try {
            await apiClient.put(`/api/v1/questions/${moveQuestion.id}`, { topic_id: moveTargetTopicId });
            const destName = crossChapter
                ? moveCTopics.find(t => t.id === moveTargetTopicId)?.name
                : topics.find(t => t.id === moveTargetTopicId)?.name;
            toast.success(`Moved to "${destName}".`);
            closeMoveModal();
        } catch {
            toast.error("Failed to move question.");
        } finally {
            setIsMoving(false);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.history.back()}
                            className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-colors border border-(--card-border)"
                        >
                            <ArrowLeft className="h-5 w-5 text-foreground" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Topics</h1>
                            <p className="text-muted-foreground text-sm">Manage topics and view linked questions inline.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/content/create"
                            className="flex items-center gap-2 bg-foreground/5 hover:bg-foreground/10 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-(--card-border)">
                            <Plus className="h-4 w-4" /> Add Question
                        </Link>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> Create Topic
                        </button>
                    </div>
                </div>

                {/* Topics List */}
                {loading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="glass-card p-5 flex flex-col gap-3">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-xl" />
                                    <Skeleton className="h-5 w-48 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : topics.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
                        <div className="h-16 w-16 bg-foreground/5 rounded-full flex items-center justify-center mb-4">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No Topics Configured</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm">This is the most granular level. Add specific concepts to be taught here.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {topics.map((topic) => (
                            <TopicRow
                                key={topic.id}
                                topic={topic}
                                allTopics={topics}
                                onDelete={handleDeleteTopic}
                                onMove={openMoveModal}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Create Topic Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Create Topic</h2>
                            <button type="button" onClick={closeTopicModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTopic} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Topic Name *</label>
                                <input
                                    type="text"
                                    value={newTopicName}
                                    onChange={(e) => setNewTopicName(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="e.g. Equations of Motion"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Description / Goals</label>
                                <textarea
                                    value={newTopicDesc}
                                    onChange={(e) => setNewTopicDesc(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-brand-500 outline-none resize-none h-24"
                                    placeholder="What will the student learn?"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closeTopicModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newTopicName.trim()}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-25 cursor-pointer disabled:opacity-60"
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Move Question Modal */}
            {moveQuestion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl flex flex-col gap-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-foreground">Move Question</h2>
                            {/* Fix #17: X close button */}
                            <button type="button" onClick={closeMoveModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 font-mono">
                                {moveQuestion.text.replace(/\$[^$]*\$/g, "[math]").slice(0, 100)}…
                            </p>

                        {!crossChapter ? (
                            <div className="flex flex-col gap-3">
                                <label className="text-sm font-medium text-foreground">Move to topic in this chapter</label>
                                {topics.filter(t => t.id !== moveQuestion.currentTopicId).length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-2">No other topics in this chapter.</p>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                                        {topics
                                            .filter(t => t.id !== moveQuestion.currentTopicId)
                                            .map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setMoveTargetTopicId(t.id)}
                                                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all cursor-pointer ${
                                                        moveTargetTopicId === t.id
                                                            ? "border-brand-500 bg-brand-500/10 text-foreground font-medium"
                                                            : "border-(--card-border) hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    {t.name}
                                                </button>
                                            ))
                                        }
                                    </div>
                                )}
                                <button
                                    onClick={switchToCrossChapter}
                                    className="text-sm text-brand-500 hover:text-brand-400 font-medium mt-1 text-left transition-colors cursor-pointer"
                                >
                                    Pick from a different chapter →
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-foreground">Pick from any chapter</label>
                                    <button
                                        onClick={switchToSameChapter}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        ← Same chapter
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <CustomSelect value={moveSClass} onChange={v => { setMoveSClass(v); setMoveSExam(""); }} placeholder="Class"
                                        options={moveClasses.map(c => ({ label: c.name, value: c.id }))} />
                                    <CustomSelect value={moveSExam} onChange={setMoveSExam} placeholder="Exam type"
                                        options={EXAM_TYPE_OPTIONS} disabled={!moveSClass} />
                                    {/* Fix #18: use subject_type for label */}
                                    <CustomSelect value={moveSSubject} onChange={setMoveSSubject} placeholder="Subject"
                                        options={moveSubjects.map(c => ({ label: c.subject_type, value: c.id }))} disabled={!moveSubjects.length} />
                                    <CustomSelect value={moveSChapter} onChange={setMoveSChapter} placeholder="Chapter"
                                        options={moveChapters.map(c => ({ label: c.name, value: c.id }))} disabled={!moveChapters.length} />
                                    <CustomSelect value={moveTargetTopicId} onChange={setMoveTargetTopicId} placeholder="Topic"
                                        options={moveCTopics.map(c => ({ label: c.name, value: c.id }))} disabled={!moveCTopics.length} />
                                </div>
                            </div>
                        )}

                        {moveTargetTopicId && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-500/5 border border-brand-500/20 text-sm">
                                <MoveRight className="h-4 w-4 text-brand-500 shrink-0" />
                                <span className="text-muted-foreground shrink-0">Moving to:</span>
                                <span className="font-medium text-brand-600 dark:text-brand-400 truncate">
                                    {crossChapter
                                        ? moveCTopics.find(t => t.id === moveTargetTopicId)?.name
                                        : topics.find(t => t.id === moveTargetTopicId)?.name}
                                </span>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button onClick={closeMoveModal}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={handleMoveQuestion}
                                disabled={!moveTargetTopicId || isMoving}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 min-w-24 justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                                {isMoving
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <><MoveRight className="h-4 w-4" /> Move</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
