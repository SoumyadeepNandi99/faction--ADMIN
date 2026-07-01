"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { ArrowLeft, Trash2, Loader2, Eye, EyeOff, BookOpen, Hash, Award, Tag, MoveRight, ArrowLeftRight, X, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import "katex/dist/katex.min.css";
import Latex from "react-latex";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";
import { CustomSelect } from "@/components/ui/custom-select";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";
import { useState, useEffect } from "react";

interface QuestionDetailed {
    id: string;
    topic_id: string;
    type: string;
    difficulty: number;
    exam_type: string[];
    question_text: string;
    marks: number;
    solution_text: string;
    question_image?: string | null;
    integer_answer?: number | null;
    mcq_options?: string[] | null;
    mcq_correct_option?: number[] | null;
    scq_options?: string[] | null;
    scq_correct_options?: number | null;
    questions_solved?: number;
    hidden: boolean;
}

interface TopicOption { id: string; name: string; chapter_id: string; }
interface ChapterOption { id: string; name: string; subject_id: string; }
interface SubjectOption { id: string; subject_type: string; class_id: string; }
interface ClassOption { id: string; name: string; }

const diffLabel = (d: number) => d === 1 ? "Easy" : d === 2 ? "Medium" : "Hard";
const diffColor = (d: number) => d === 1 ? "bg-green-500/10 text-green-500" : d === 2 ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500";
const typeLabel = (t: string) => {
    const map: Record<string, string> = { scq: "Single Correct", mcq: "Multiple Correct", integer: "Integer / Numerical", match_the_column: "Match the Column" };
    return map[t] || t.toUpperCase();
};

// Types whose answer format can be fully edited here (the update endpoint accepts
// these fields). match_the_column is intentionally excluded — its answer fields
// aren't part of the update API — but is shown as an option when the question
// already has that type so the selector renders correctly.
const EDITABLE_TYPE_OPTIONS = [
    { label: "Single Correct (SCQ)", value: "scq" },
    { label: "Multiple Correct (MCQ)", value: "mcq" },
    { label: "Integer / Numerical", value: "integer" },
];

export default function QuestionViewPage() {
    const params = useParams();
    const questionId = params.questionId as string;

    const { data: question, error, isLoading, mutate } = useSWR<QuestionDetailed>(
        `/api/v1/questions/${questionId}`,
        (url: string) => apiClient.get(url).then(r => r.data)
    );

    // Fetch current topic name for display
    const { data: currentTopic } = useSWR<TopicOption>(
        question?.topic_id ? `/api/v1/topics/${question.topic_id}` : null,
        (url: string) => apiClient.get(url).then(r => r.data)
    );

    // Edit modal state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);
    const [editForm, setEditForm] = useState({
        question_text: "",
        solution_text: "",
        difficulty: 2,
        marks: 4,
        exam_type: [] as string[],
        hidden: false,
        type: "",
        integer_answer: "" as string | number,
        scq_options: [] as string[],
        scq_correct_options: 0,
        mcq_options: [] as string[],
        mcq_correct_option: [] as number[],
    });

    const openEditModal = () => {
        if (!question) return;
        setEditForm({
            question_text: question.question_text,
            solution_text: question.solution_text,
            difficulty: question.difficulty,
            marks: question.marks,
            exam_type: question.exam_type || [],
            hidden: question.hidden,
            type: question.type,
            integer_answer: question.integer_answer ?? "",
            scq_options: question.scq_options ? [...question.scq_options] : [],
            scq_correct_options: question.scq_correct_options ?? 0,
            mcq_options: question.mcq_options ? [...question.mcq_options] : [],
            mcq_correct_option: question.mcq_correct_option ? [...question.mcq_correct_option] : [],
        });
        setIsEditOpen(true);
    };

    const handleEditSubmit = async () => {
        if (!question) return;
        setIsEditSubmitting(true);
        try {
            const payload: Record<string, unknown> = {
                question_text: editForm.question_text,
                solution_text: editForm.solution_text,
                difficulty: editForm.difficulty,
                marks: editForm.marks,
                exam_type: editForm.exam_type,
                hidden: editForm.hidden,
                type: editForm.type,
            };
            if (editForm.type === "integer") {
                payload.integer_answer = editForm.integer_answer !== "" ? Number(editForm.integer_answer) : null;
            } else if (editForm.type === "scq") {
                payload.scq_options = editForm.scq_options;
                payload.scq_correct_options = editForm.scq_correct_options;
            } else if (editForm.type === "mcq") {
                payload.mcq_options = editForm.mcq_options;
                payload.mcq_correct_option = editForm.mcq_correct_option;
            }
            const res = await apiClient.put(`/api/v1/questions/${question.id}`, payload);
            mutate({ ...question, ...res.data }, false);
            setIsEditOpen(false);
            toast.success("Question updated successfully.");
        } catch {
            toast.error("Failed to update question.");
        } finally {
            setIsEditSubmitting(false);
        }
    };

    // Switching the question type swaps which answer fields are shown. Seed empty
    // options when moving to SCQ/MCQ from a type that has none (e.g. integer) so
    // the admin has fields to fill in.
    const changeEditType = (newType: string) => {
        setEditForm(f => ({
            ...f,
            type: newType,
            scq_options: newType === "scq" && f.scq_options.length === 0 ? ["", "", "", ""] : f.scq_options,
            mcq_options: newType === "mcq" && f.mcq_options.length === 0 ? ["", "", "", ""] : f.mcq_options,
        }));
    };

    const EXAM_OPTIONS = ["JEE_MAINS", "JEE_ADVANCED", "NEET", "OLYMPIAD", "CBSE"];
    const toggleEditExam = (exam: string) => {
        setEditForm(f => ({
            ...f,
            exam_type: f.exam_type.includes(exam)
                ? f.exam_type.filter(e => e !== exam)
                : [...f.exam_type, exam],
        }));
    };

    // Reassign modal state
    const [isReassignOpen, setIsReassignOpen] = useState(false);
    const [isReassigning, setIsReassigning] = useState(false);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [chapters, setChapters] = useState<ChapterOption[]>([]);
    const [topicOptions, setTopicOptions] = useState<TopicOption[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [reassignExam, setReassignExam] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedChapter, setSelectedChapter] = useState("");
    const [newTopicId, setNewTopicId] = useState("");

    // Load classes when modal opens
    useEffect(() => {
        if (!isReassignOpen) return;
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            setClasses(Array.isArray(d) ? d : (d.classes || []));
        }).catch(() => {});
    }, [isReassignOpen]);

    useEffect(() => {
        setSubjects([]); setSelectedSubject(""); setChapters([]); setTopicOptions([]); setNewTopicId("");
        if (!selectedClass || !reassignExam) return;
        apiClient.get(`/api/v1/subjects/?class_id=${selectedClass}&exam_type=${reassignExam}`).then(r => {
            const d = r.data;
            setSubjects(Array.isArray(d) ? d : (d.subjects || []));
        }).catch(() => {});
    }, [selectedClass, reassignExam]);

    useEffect(() => {
        if (!selectedSubject) return;
        apiClient.get(`/api/v1/chapters/?subject_id=${selectedSubject}`).then(r => {
            const d = r.data;
            setChapters(Array.isArray(d) ? d : (d.chapters || []));
            setSelectedChapter(""); setTopicOptions([]); setNewTopicId("");
        }).catch(() => {});
    }, [selectedSubject]);

    useEffect(() => {
        if (!selectedChapter) return;
        apiClient.get(`/api/v1/topics/?chapter_id=${selectedChapter}`).then(r => {
            const d = r.data;
            setTopicOptions(Array.isArray(d) ? d : (d.topics || []));
            setNewTopicId("");
        }).catch(() => {});
    }, [selectedChapter]);

    const closeReassignModal = () => {
        setIsReassignOpen(false);
        setSelectedClass(""); setReassignExam(""); setSelectedSubject(""); setSelectedChapter(""); setNewTopicId("");
        setSubjects([]); setChapters([]); setTopicOptions([]);
    };

    const handleReassign = async () => {
        if (!newTopicId || !question) return;
        if (newTopicId === question.topic_id) {
            toast.info("That is already the current topic.");
            return;
        }
        setIsReassigning(true);
        try {
            await apiClient.put(`/api/v1/questions/${question.id}`, { topic_id: newTopicId });
            mutate({ ...question, topic_id: newTopicId }, false);
            toast.success("Question reassigned successfully.");
            closeReassignModal();
        } catch {
            toast.error("Failed to reassign topic.");
        } finally {
            setIsReassigning(false);
        }
    };

    const handleDelete = async () => {
        if (!question) return;
        if (!(await confirmAction({ title: "Delete Question", description: "This will permanently remove this question and all associated data.", destructive: true }))) return;
        try {
            await apiClient.delete(`/api/v1/questions/${questionId}`);
            toast.success("Question deleted.");
            window.history.back();
        } catch {
            toast.error("Failed to delete question.");
        }
    };

    const toggleHidden = async () => {
        if (!question) return;
        try {
            await apiClient.put(`/api/v1/questions/${questionId}`, { hidden: !question.hidden });
            mutate({ ...question, hidden: !question.hidden }, false);
            toast.success(question.hidden ? "Question is now visible." : "Question is now hidden.");
        } catch {
            toast.error("Failed to update visibility.");
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
                </div>
                <div className="glass-card p-8 space-y-6">
                    <div className="flex gap-2"><Skeleton className="h-6 w-16 rounded" /><Skeleton className="h-6 w-24 rounded" /><Skeleton className="h-6 w-20 rounded" /></div>
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                    </div>
                    <Skeleton className="h-20 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    if (error || !question) {
        return (
            <div className="max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => window.history.back()} className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-colors border border-(--card-border)">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <h1 className="text-2xl font-bold text-foreground">Question Not Found</h1>
                </div>
                <div className="glass-card p-12 text-center flex flex-col items-center">
                    <BookOpen className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold text-foreground">Could not load this question</h3>
                    <p className="text-muted-foreground mt-1 text-sm">The question may have been deleted or the ID is invalid.</p>
                    <Link href="/content" className="mt-4 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors">
                        Back to Question Bank
                    </Link>
                </div>
            </div>
        );
    }

    const opts = question.scq_options || question.mcq_options || [];
    const correctIndices = question.type === "scq"
        ? (question.scq_correct_options !== null && question.scq_correct_options !== undefined ? [question.scq_correct_options] : [])
        : (question.mcq_correct_option || []);

    // Show match_the_column as a selectable option only if the question already is
    // that type, so the selector can render its current value (its answer fields
    // can't be edited via the update API).
    const editTypeOptions = question.type === "match_the_column"
        ? [...EDITABLE_TYPE_OPTIONS, { label: "Match the Column", value: "match_the_column" }]
        : EDITABLE_TYPE_OPTIONS;

    return (
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.history.back()}
                        className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-colors border border-(--card-border)">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Question Detail</h1>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {question.id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={openEditModal}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-(--card-border) hover:bg-foreground/5 cursor-pointer">
                        <Pencil className="h-4 w-4 text-muted-foreground" /> Edit
                    </button>
                    <button onClick={() => setIsReassignOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-(--card-border) hover:bg-foreground/5 cursor-pointer"
                        title="Move this question to a different topic">
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" /> Reassign
                    </button>
                    <button onClick={toggleHidden}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border cursor-pointer ${
                            question.hidden
                                ? "border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400 hover:bg-green-500/10"
                                : "border-(--card-border) text-muted-foreground hover:bg-foreground/5"
                        }`}>
                        {question.hidden
                            ? <><Eye className="h-4 w-4" /> Unhide</>
                            : <><EyeOff className="h-4 w-4" /> Hide</>
                        }
                    </button>
                    <button onClick={handleDelete}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors cursor-pointer">
                        <Trash2 className="h-4 w-4" /> Delete
                    </button>
                </div>
            </div>

            {/* Main Card */}
            <div className="glass-card p-8">
                {/* Metadata badges */}
                <div className="flex flex-wrap gap-2 items-center mb-6">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${diffColor(question.difficulty)}`}>
                        {diffLabel(question.difficulty)}
                    </span>
                    <span className="px-2.5 py-1 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                        {typeLabel(question.type)}
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                        <Award className="h-3 w-3" /> {question.marks} mark{question.marks !== 1 ? "s" : ""}
                    </span>
                    {/* Current topic badge */}
                    <button
                        onClick={() => setIsReassignOpen(true)}
                        title="Click to reassign topic"
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/20 transition-colors cursor-pointer group"
                    >
                        <Tag className="h-3 w-3" />
                        {currentTopic ? currentTopic.name : question.topic_id.slice(0, 8) + "…"}
                        <MoveRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                    </button>
                    {question.exam_type?.map(et => (
                        <span key={et} className="px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground text-xs font-medium border border-(--card-border)">
                            {et}
                        </span>
                    ))}
                    {question.questions_solved !== undefined && question.questions_solved > 0 && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border) ml-auto">
                            <Hash className="h-3 w-3" /> {question.questions_solved} solved
                        </span>
                    )}
                </div>

                {/* Question Image */}
                {question.question_image && (
                    <div className="mb-6 rounded-xl overflow-hidden border border-(--card-border) bg-foreground/5">
                        <img src={question.question_image} alt="Question" className="max-w-full max-h-80 object-contain mx-auto p-4" />
                    </div>
                )}

                {/* Question Text */}
                <div className="prose prose-invert max-w-none text-foreground text-lg leading-relaxed mb-8">
                    <Latex>{question.question_text}</Latex>
                </div>

                {/* Options (SCQ / MCQ) */}
                {(question.type === "scq" || question.type === "mcq") && opts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {opts.map((opt, i) => {
                            const isCorrect = correctIndices.includes(i);
                            return (
                                <div key={i} className={`p-4 rounded-xl border transition-all ${isCorrect ? "border-green-500/50 bg-green-500/5" : "border-(--card-border) bg-foreground/5"}`}>
                                    <div className="flex gap-3">
                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCorrect ? "bg-green-500 text-white" : "bg-background text-muted-foreground border border-(--card-border)"}`}>
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                        <div className="text-foreground text-sm pt-0.5">
                                            <Latex>{opt}</Latex>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Integer Answer */}
                {question.type === "integer" && question.integer_answer !== null && question.integer_answer !== undefined && (
                    <div className="mb-8 p-5 rounded-xl border border-green-500/30 bg-green-500/5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Correct Answer</span>
                        <p className="text-3xl font-bold text-green-500 mt-1">{question.integer_answer}</p>
                    </div>
                )}

                {/* Solution */}
                {question.solution_text && (
                    <div className="border-t border-(--panel-border) pt-6">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Solution & Explanation</h3>
                        <div className="prose prose-invert max-w-none text-foreground leading-relaxed bg-foreground/5 p-6 rounded-xl border border-(--card-border)">
                            <Latex>{question.solution_text}</Latex>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Question Modal */}
            {isEditOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-2xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-foreground">Edit Question</h2>
                            <button type="button" onClick={() => setIsEditOpen(false)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Question Type */}
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">Question Type</label>
                            <CustomSelect
                                value={editForm.type}
                                onChange={changeEditType}
                                options={editTypeOptions}
                            />
                            {editForm.type !== question.type && (
                                <p className="text-xs text-amber-500 mt-1.5">
                                    Changing the type switches the answer format below. Fill in the new answer before saving.
                                </p>
                            )}
                        </div>

                        {/* Difficulty + Marks */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Difficulty</label>
                                <CustomSelect
                                    value={String(editForm.difficulty)}
                                    onChange={(v) => setEditForm(f => ({ ...f, difficulty: Number(v) }))}
                                    options={[{ label: "Easy", value: "1" }, { label: "Medium", value: "2" }, { label: "Hard", value: "3" }]}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Marks</label>
                                <input type="number" min="1" value={editForm.marks} onChange={e => setEditForm(f => ({ ...f, marks: Number(e.target.value) }))}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                            </div>
                        </div>

                        {/* Exam Type */}
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">Exam Type</label>
                            <div className="flex flex-wrap gap-2">
                                {EXAM_OPTIONS.map(exam => (
                                    <button key={exam} type="button" onClick={() => toggleEditExam(exam)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${editForm.exam_type.includes(exam) ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400" : "border-(--card-border) text-muted-foreground hover:bg-foreground/5"}`}>
                                        {exam}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Hidden toggle */}
                        <div className="flex items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-(--card-border)">
                            <input type="checkbox" id="edit_hidden" checked={editForm.hidden} onChange={e => setEditForm(f => ({ ...f, hidden: e.target.checked }))}
                                className="cursor-pointer h-4 w-4 rounded text-brand-600 focus:ring-brand-500" />
                            <label htmlFor="edit_hidden" className="text-sm font-medium text-foreground cursor-pointer">Mark as Hidden</label>
                            <span className="ml-auto text-xs text-muted-foreground">Hidden questions won't appear to students</span>
                        </div>

                        {/* Question Text */}
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">Question Text <span className="text-muted-foreground font-normal">(LaTeX supported)</span></label>
                            <textarea value={editForm.question_text} onChange={e => setEditForm(f => ({ ...f, question_text: e.target.value }))}
                                className="w-full bg-foreground/5 border border-(--input) rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[100px] resize-y font-mono leading-relaxed" />
                        </div>

                        {/* Options for SCQ */}
                        {editForm.type === "scq" && (
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Options <span className="text-muted-foreground font-normal">(select correct)</span></label>
                                <div className="flex flex-col gap-2">
                                    {editForm.scq_options.map((opt, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <button type="button" onClick={() => setEditForm(f => ({ ...f, scq_correct_options: idx }))}
                                                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${editForm.scq_correct_options === idx ? "border-green-500 bg-green-500" : "border-(--input) hover:border-brand-500"}`}>
                                                {editForm.scq_correct_options === idx && <div className="h-2 w-2 bg-white rounded-full" />}
                                            </button>
                                            <input value={opt} onChange={e => { const opts = [...editForm.scq_options]; opts[idx] = e.target.value; setEditForm(f => ({ ...f, scq_options: opts })); }}
                                                className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none font-mono" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Options for MCQ */}
                        {editForm.type === "mcq" && (
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Options <span className="text-muted-foreground font-normal">(select all correct)</span></label>
                                <div className="flex flex-col gap-2">
                                    {editForm.mcq_options.map((opt, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <button type="button" onClick={() => setEditForm(f => ({ ...f, mcq_correct_option: f.mcq_correct_option.includes(idx) ? f.mcq_correct_option.filter(i => i !== idx) : [...f.mcq_correct_option, idx] }))}
                                                className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${editForm.mcq_correct_option.includes(idx) ? "border-green-500 bg-green-500" : "border-(--input) hover:border-brand-500"}`}>
                                                {editForm.mcq_correct_option.includes(idx) && <div className="h-2.5 w-2.5 bg-white rounded-sm" />}
                                            </button>
                                            <input value={opt} onChange={e => { const opts = [...editForm.mcq_options]; opts[idx] = e.target.value; setEditForm(f => ({ ...f, mcq_options: opts })); }}
                                                className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none font-mono" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Integer answer */}
                        {editForm.type === "integer" && (
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Correct Numerical Answer</label>
                                <input type="number" step="any" value={editForm.integer_answer} onChange={e => setEditForm(f => ({ ...f, integer_answer: e.target.value }))}
                                    className="w-full max-w-xs bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                            </div>
                        )}

                        {/* Solution Text */}
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">Solution / Explanation <span className="text-muted-foreground font-normal">(LaTeX supported)</span></label>
                            <textarea value={editForm.solution_text} onChange={e => setEditForm(f => ({ ...f, solution_text: e.target.value }))}
                                className="w-full bg-foreground/5 border border-(--input) rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px] resize-y font-mono leading-relaxed" />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setIsEditOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button type="button" onClick={handleEditSubmit} disabled={isEditSubmitting}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 min-w-28 justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                                {isEditSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-4 w-4" /> Save Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reassign Topic Modal */}
            {isReassignOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl flex flex-col gap-5">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-foreground">Reassign Topic</h2>
                            {/* Fix #8: X close button */}
                            <button type="button" onClick={closeReassignModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Currently in:{" "}
                                <span className="font-medium text-foreground">
                                    {currentTopic?.name ?? (question.topic_id.slice(0, 8) + "…")}
                                </span>
                            </p>

                        {/* Cascade Selectors */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Select new topic</label>
                            <div className="grid grid-cols-2 gap-3">
                                <CustomSelect
                                    value={selectedClass}
                                    onChange={v => { setSelectedClass(v); setReassignExam(""); }}
                                    placeholder="Class"
                                    options={classes.map(c => ({ label: c.name, value: c.id }))} />
                                <CustomSelect
                                    value={reassignExam}
                                    onChange={setReassignExam}
                                    placeholder="Exam type"
                                    options={EXAM_TYPE_OPTIONS}
                                    disabled={!selectedClass} />
                                <CustomSelect
                                    value={selectedSubject}
                                    onChange={setSelectedSubject}
                                    placeholder="Subject"
                                    options={subjects.map(c => ({ label: c.subject_type, value: c.id }))}
                                    disabled={!subjects.length} />
                                <CustomSelect
                                    value={selectedChapter}
                                    onChange={setSelectedChapter}
                                    placeholder="Chapter"
                                    options={chapters.map(c => ({ label: c.name, value: c.id }))}
                                    disabled={!chapters.length} />
                                <CustomSelect
                                    value={newTopicId}
                                    onChange={setNewTopicId}
                                    placeholder="Topic"
                                    options={topicOptions.map(c => ({ label: c.name, value: c.id }))}
                                    disabled={!topicOptions.length} />
                            </div>
                        </div>

                        {/* Destination preview */}
                        {newTopicId && (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-500/5 border border-brand-500/20 text-sm">
                                <span className="text-muted-foreground shrink-0">Moving to:</span>
                                <span className="font-medium text-brand-600 dark:text-brand-400">
                                    {topicOptions.find(t => t.id === newTopicId)?.name}
                                </span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={closeReassignModal}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={handleReassign}
                                disabled={!newTopicId || isReassigning}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 min-w-28 justify-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                                {isReassigning
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <><MoveRight className="h-4 w-4" /> Reassign</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
