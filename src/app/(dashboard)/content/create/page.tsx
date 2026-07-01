"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Eye, EyeOff, Loader2, Sparkles, Plus, Trash2, X } from "lucide-react";
import "katex/dist/katex.min.css";
import Latex from "react-latex";
import Link from "next/link";
import { CustomSelect } from "@/components/ui/custom-select";
import { apiClient } from "@/lib/axios";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";

interface TopicOption { id: string; name: string; chapter_id: string; }
interface ChapterOption { id: string; name: string; subject_id: string; }
interface SubjectOption { id: string; subject_type: string; class_id: string; }
interface ClassOption { id: string; name: string; }

type QuestionType = "scq" | "mcq" | "integer" | "match_the_column";

const DIFFICULTY_MAP: Record<string, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };
const QUESTION_TYPE_OPTIONS = [
    { label: "Single Correct (SCQ)", value: "scq" },
    { label: "Multiple Correct (MCQ)", value: "mcq" },
    { label: "Integer / Numerical", value: "integer" },
    { label: "Match the Column", value: "match_the_column" },
];
const EXAM_OPTIONS = [
    { label: "JEE Mains", value: "JEE_MAINS" },
    { label: "JEE Advanced", value: "JEE_ADVANCED" },
    { label: "NEET", value: "NEET" },
    { label: "Olympiad", value: "OLYMPIAD" },
    { label: "CBSE", value: "CBSE" },
];

export default function CreateQuestionPage() {
    const router = useRouter();
    const [questionText, setQuestionText] = useState("");
    const [solutionText, setSolutionText] = useState("");
    const [difficulty, setDifficulty] = useState("MEDIUM");
    const [examType, setExamType] = useState("JEE_MAINS");
    const [questionType, setQuestionType] = useState<QuestionType>("scq");
    const [marks, setMarks] = useState(4);
    const [isPyq, setIsPyq] = useState(false);
    const [year, setYear] = useState("");
    const [isHidden, setIsHidden] = useState(false);
    const [topicId, setTopicId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Cascade selectors
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [chapters, setChapters] = useState<ChapterOption[]>([]);
    const [topics, setTopics] = useState<TopicOption[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedChapter, setSelectedChapter] = useState("");

    // SCQ / MCQ options
    const [options, setOptions] = useState(["", "", "", ""]);
    const [scqCorrect, setScqCorrect] = useState<number>(0);
    const [mcqCorrect, setMcqCorrect] = useState<number[]>([]);

    // Integer answer
    const [integerAnswer, setIntegerAnswer] = useState("");

    // Match the column
    const [matchLeft, setMatchLeft] = useState(["", "", "", ""]);
    const [matchRight, setMatchRight] = useState(["", "", "", ""]);

    useEffect(() => {
        apiClient.get("/api/v1/class/").then(r => {
            const data = r.data;
            setClasses(Array.isArray(data) ? data : (data.classes || []));
        }).catch(() => { });
    }, []);

    useEffect(() => {
        setSubjects([]); setSelectedSubject(""); setChapters([]); setTopics([]); setTopicId("");
        if (!selectedClass || !examType) return;
        apiClient.get(`/api/v1/subjects/?class_id=${selectedClass}&exam_type=${examType}`).then(r => {
            const data = r.data;
            setSubjects(Array.isArray(data) ? data : (data.subjects || []));
        }).catch(() => { });
    }, [selectedClass, examType]);

    useEffect(() => {
        if (!selectedSubject) return;
        apiClient.get(`/api/v1/chapters/?subject_id=${selectedSubject}`).then(r => {
            const data = r.data;
            setChapters(Array.isArray(data) ? data : (data.chapters || []));
            setSelectedChapter(""); setTopics([]); setTopicId("");
        }).catch(() => { });
    }, [selectedSubject]);

    useEffect(() => {
        if (!selectedChapter) return;
        apiClient.get(`/api/v1/topics/?chapter_id=${selectedChapter}`).then(r => {
            const data = r.data;
            setTopics(Array.isArray(data) ? data : (data.topics || []));
            setTopicId("");
        }).catch(() => { });
    }, [selectedChapter]);

    const handleOptionChange = (idx: number, text: string) => {
        const newOpts = [...options];
        newOpts[idx] = text;
        setOptions(newOpts);
    };

    const addOption = () => setOptions([...options, ""]);
    const removeOption = (idx: number) => {
        if (options.length <= 2) return;
        const newOpts = options.filter((_, i) => i !== idx);
        setOptions(newOpts);
        if (scqCorrect === idx) setScqCorrect(0);
        else if (scqCorrect > idx) setScqCorrect(scqCorrect - 1);
        setMcqCorrect(mcqCorrect.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
    };

    const toggleMcqCorrect = (idx: number) => {
        setMcqCorrect(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    };

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!questionText.trim()) return toast.error("Question text is required.");
        if (!solutionText.trim()) return toast.error("Solution text is required.");
        if (!topicId) return toast.error("Please select a topic.");

        if (questionType === "scq" && options.some(o => !o.trim())) return toast.error("All SCQ options must be filled.");
        if (questionType === "mcq") {
            if (options.some(o => !o.trim())) return toast.error("All MCQ options must be filled.");
            if (mcqCorrect.length === 0) return toast.error("Select at least one correct answer for MCQ.");
        }
        if (questionType === "integer" && integerAnswer === "") return toast.error("Integer answer is required.");

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("topic_id", topicId);
            formData.append("type", questionType);
            formData.append("difficulty", String(DIFFICULTY_MAP[difficulty] ?? 2));
            formData.append("exam_type", JSON.stringify([examType]));
            formData.append("question_text", questionText);
            formData.append("solution_text", solutionText);
            formData.append("marks", String(marks));

            formData.append("is_pyq", String(isPyq));
            if (isPyq && year) formData.append("year", year);
            formData.append("hidden", String(isHidden));

            if (imageFile) {
                formData.append("question_image", imageFile);
            }

            if (questionType === "scq") {
                formData.append("scq_options", JSON.stringify(options));
                formData.append("scq_correct_options", String(scqCorrect));
            } else if (questionType === "mcq") {
                formData.append("mcq_options", JSON.stringify(options));
                formData.append("mcq_correct_option", JSON.stringify(mcqCorrect));
            } else if (questionType === "integer") {
                formData.append("integer_answer", integerAnswer);
            } else if (questionType === "match_the_column") {
                matchLeft.filter(Boolean).forEach(item => formData.append("match_left", item));
                matchRight.filter(Boolean).forEach(item => formData.append("match_right", item));
            }

            await apiClient.post("/api/v1/questions/", formData, {
                headers: { "Content-Type": undefined },
            });

            toast.success("Question saved to the bank!");
            // Fix #6: use router.push instead of window.history.back()
            router.push("/content");
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to save question."));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full h-[calc(100vh-8rem)]">

                {/* Editor Side */}
                <div className="w-full lg:w-1/2 flex flex-col gap-4 overflow-y-auto pr-2">
                    <div className="flex items-center gap-4 mb-2">
                        <Link href="/content"
                            className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-colors border border-(--card-border)">
                            <ArrowLeft className="h-5 w-5 text-foreground" />
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Question Editor</h1>
                            <p className="text-muted-foreground text-sm">Author rich academic content using LaTeX.</p>
                        </div>
                        {/* Mobile preview toggle */}
                        <button
                            type="button"
                            onClick={() => setShowPreview(v => !v)}
                            className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl border border-(--card-border) bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm font-medium text-foreground"
                        >
                            {showPreview ? <><EyeOff className="h-4 w-4" /> Hide</> : <><Eye className="h-4 w-4" /> Preview</>}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-6">

                        {/* Topic Cascade — Class + Exam Type scope the subject list */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Link to Curriculum *</label>
                            <div className="grid grid-cols-2 gap-3">
                                <CustomSelect value={selectedClass} onChange={setSelectedClass} placeholder="Select Class"
                                    options={classes.map(c => ({ label: c.name, value: c.id }))} />
                                <CustomSelect value={examType} onChange={setExamType} placeholder="Select Exam Type"
                                    options={EXAM_OPTIONS} />
                                <CustomSelect value={selectedSubject} onChange={setSelectedSubject} placeholder="Select Subject"
                                    options={subjects.map(c => ({ label: c.subject_type, value: c.id }))} disabled={!subjects.length} />
                                <CustomSelect value={selectedChapter} onChange={setSelectedChapter} placeholder="Select Chapter"
                                    options={chapters.map(c => ({ label: c.name, value: c.id }))} disabled={!chapters.length} />
                                <CustomSelect value={topicId} onChange={setTopicId} placeholder="Select Topic"
                                    options={topics.map(c => ({ label: c.name, value: c.id }))} disabled={!topics.length} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">Exam Type also tags this question and scopes the subject list.</p>
                        </div>

                        {/* Question Type & Metadata */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-1.5">Question Type *</label>
                                <CustomSelect value={questionType} onChange={(v) => setQuestionType(v as QuestionType)}
                                    options={QUESTION_TYPE_OPTIONS} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Difficulty</label>
                                <CustomSelect value={difficulty} onChange={setDifficulty}
                                    options={[{ label: "Easy", value: "EASY" }, { label: "Medium", value: "MEDIUM" }, { label: "Hard", value: "HARD" }]} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Marks</label>
                                <input type="number" min="1" value={marks} onChange={e => setMarks(Number(e.target.value))}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-foreground mb-1.5">Question Image (optional)</label>
                                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-1.5 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-brand-500/10 file:text-brand-600 file:text-xs file:font-medium file:px-2 file:py-1" />
                            </div>
                        </div>

                        {/* PYQ Toggle */}
                        <div className="flex items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-(--card-border)">
                            <input type="checkbox" id="is_pyq" checked={isPyq} onChange={e => setIsPyq(e.target.checked)}
                                className="cursor-pointer h-4 w-4 bg-background border-brand-500 rounded text-brand-600 focus:ring-brand-500" />
                            <label htmlFor="is_pyq" className="text-sm font-medium text-foreground cursor-pointer">Mark as PYQ</label>
                            {isPyq && (
                                <input type="number" value={year} onChange={e => setYear(e.target.value)}
                                    className="ml-auto w-24 bg-background border border-(--input) rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="Year" />
                            )}
                        </div>

                        {/* Hidden Toggle */}
                        <div className="flex items-center gap-3 p-3 bg-foreground/5 rounded-xl border border-(--card-border)">
                            <input type="checkbox" id="is_hidden" checked={isHidden} onChange={e => setIsHidden(e.target.checked)}
                                className="cursor-pointer h-4 w-4 bg-background border-brand-500 rounded text-brand-600 focus:ring-brand-500" />
                            <label htmlFor="is_hidden" className="text-sm font-medium text-foreground cursor-pointer">Mark as Hidden</label>
                            <span className="ml-auto text-xs text-muted-foreground">Hidden questions won't appear to students</span>
                        </div>

                        {/* Question Text */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-sm font-medium text-foreground">Question Stem *</label>
                                <span className="text-xs text-muted-foreground font-mono bg-foreground/5 px-2 py-0.5 rounded">LaTeX Supported</span>
                            </div>
                            <textarea value={questionText} onChange={e => setQuestionText(e.target.value)} required
                                className="w-full bg-foreground/5 border border-(--input) rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[140px] resize-y font-mono leading-relaxed"
                                placeholder="Type question here. Use $...$ for inline math. e.g. Evaluate $\int x^2 dx$" />
                        </div>

                        {/* Type-specific answer section */}
                        {(questionType === "scq" || questionType === "mcq") && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium text-foreground">
                                        Options {questionType === "mcq" ? "(select all correct)" : "(select one correct)"}
                                    </label>
                                    <button type="button" onClick={addOption}
                                        className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                                        <Plus className="h-3.5 w-3.5" /> Add Option
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {options.map((opt, idx) => (
                                        <div key={idx} className="flex items-start gap-3">
                                            {questionType === "scq" ? (
                                                <button type="button" onClick={() => setScqCorrect(idx)}
                                                    className={`mt-2 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${scqCorrect === idx ? "border-green-500 bg-green-500" : "border-(--input) hover:border-brand-500"}`}>
                                                    {scqCorrect === idx && <div className="h-2 w-2 bg-white rounded-full" />}
                                                </button>
                                            ) : (
                                                <button type="button" onClick={() => toggleMcqCorrect(idx)}
                                                    className={`mt-2 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${mcqCorrect.includes(idx) ? "border-green-500 bg-green-500" : "border-(--input) hover:border-brand-500"}`}>
                                                    {mcqCorrect.includes(idx) && <div className="h-2.5 w-2.5 bg-white rounded-sm" />}
                                                </button>
                                            )}
                                            <textarea value={opt} onChange={e => handleOptionChange(idx, e.target.value)} required
                                                className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-none h-12 font-mono"
                                                placeholder={`Option ${String.fromCharCode(65 + idx)} (LaTeX supported)`} />
                                            {options.length > 2 && (
                                                <button type="button" onClick={() => removeOption(idx)}
                                                    className="mt-2 p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {questionType === "integer" && (
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Correct Numerical Answer *</label>
                                <input type="number" step="any" value={integerAnswer} onChange={e => setIntegerAnswer(e.target.value)} required
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none max-w-xs"
                                    placeholder="e.g. 42 or 3.5" />
                                <p className="text-xs text-muted-foreground mt-1">Students will type a numerical answer.</p>
                            </div>
                        )}

                        {questionType === "match_the_column" && (
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-3">Match the Column</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Column A</span>
                                        {matchLeft.map((item, idx) => (
                                            <div key={idx} className="mb-2">
                                                <input value={item} onChange={e => { const n = [...matchLeft]; n[idx] = e.target.value; setMatchLeft(n); }}
                                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                                    placeholder={`A${idx + 1}`} />
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => setMatchLeft([...matchLeft, ""])}
                                            className="text-xs text-brand-500 hover:text-brand-400 font-medium cursor-pointer">+ Add Row</button>
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Column B</span>
                                        {matchRight.map((item, idx) => (
                                            <div key={idx} className="mb-2">
                                                <input value={item} onChange={e => { const n = [...matchRight]; n[idx] = e.target.value; setMatchRight(n); }}
                                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                                    placeholder={`B${idx + 1}`} />
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => setMatchRight([...matchRight, ""])}
                                            className="text-xs text-brand-500 hover:text-brand-400 font-medium cursor-pointer">+ Add Row</button>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">Define the items for students to match. The correct mapping is implied by row order.</p>
                            </div>
                        )}

                        {/* Solution Text */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-sm font-medium text-foreground">Solution / Explanation *</label>
                                <span className="text-xs text-muted-foreground font-mono bg-foreground/5 px-2 py-0.5 rounded">LaTeX Supported</span>
                            </div>
                            <textarea value={solutionText} onChange={e => setSolutionText(e.target.value)} required
                                className="w-full bg-foreground/5 border border-(--input) rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all min-h-[100px] resize-y font-mono leading-relaxed"
                                placeholder="Explain the step-by-step solution. Use $...$ for math." />
                        </div>

                        <button type="submit" disabled={isSubmitting}
                            className="mt-2 w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl py-3 font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" />Save Question to Bank</>}
                        </button>
                    </form>
                </div>

                {/* Preview Side — always visible on lg+, toggled on mobile */}
                <div className={`w-full lg:w-1/2 flex flex-col gap-4 ${showPreview ? "block" : "hidden"} lg:block`}>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-2 px-2">
                        <Eye className="h-5 w-5 text-muted-foreground" /> Live Student Preview
                        {/* Close button — only visible on mobile */}
                        <button
                            type="button"
                            onClick={() => setShowPreview(false)}
                            className="lg:hidden ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                            title="Close preview"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </h2>
                    <div className="glass-card p-8 h-full rounded-2xl border-brand-500/20 overflow-y-auto relative">
                        <div className="absolute top-4 right-4 animate-pulse">
                            <Sparkles className="h-5 w-5 text-brand-500/50" />
                        </div>

                        {/* Badges row */}
                        <div className="flex flex-wrap gap-2 items-center mb-6">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${difficulty === "EASY" ? "bg-green-500/10 text-green-500" : difficulty === "MEDIUM" ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"}`}>
                                {difficulty}
                            </span>
                            <span className="px-2 py-1 bg-foreground/5 text-muted-foreground rounded text-xs border border-(--card-border) font-medium">
                                {QUESTION_TYPE_OPTIONS.find(o => o.value === questionType)?.label}
                            </span>
                            <span className="px-2 py-1 bg-foreground/5 text-muted-foreground rounded text-xs border border-(--card-border)">
                                {marks} mark{marks !== 1 ? "s" : ""}
                            </span>
                            {isPyq && <span className="px-2 py-1 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded text-xs font-bold border border-brand-500/20">PYQ {year && `(${year})`}</span>}
                            <span className="px-2 py-1 bg-foreground/5 text-muted-foreground rounded text-xs border border-(--card-border)">{examType}</span>
                        </div>

                        {/* Question text */}
                        <div className="prose prose-invert max-w-none text-foreground text-lg leading-relaxed mb-8">
                            {questionText ? <Latex>{questionText}</Latex> : <span className="text-muted-foreground italic text-sm">Question rendering will appear here...</span>}
                        </div>

                        {/* Type-specific preview */}
                        {(questionType === "scq" || questionType === "mcq") && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {options.map((opt, i) => {
                                    const isCorrect = questionType === "scq" ? scqCorrect === i : mcqCorrect.includes(i);
                                    return (
                                        <div key={i} className={`p-4 rounded-xl border transition-all ${isCorrect ? "border-green-500/50 bg-green-500/5" : "border-(--card-border) bg-foreground/5"}`}>
                                            <div className="flex gap-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? "bg-green-500 text-white" : "bg-background text-muted-foreground"}`}>
                                                    {String.fromCharCode(65 + i)}
                                                </span>
                                                <div className="text-foreground text-sm">
                                                    {opt ? <Latex>{opt}</Latex> : <span className="text-muted-foreground">—</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {questionType === "integer" && integerAnswer && (
                            <div className="mb-8 p-4 rounded-xl border border-green-500/30 bg-green-500/5">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Correct Answer</span>
                                <p className="text-2xl font-bold text-green-500 mt-1">{integerAnswer}</p>
                            </div>
                        )}

                        {questionType === "match_the_column" && (
                            <div className="mb-8 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Column A</span>
                                    {matchLeft.filter(Boolean).map((item, i) => (
                                        <div key={i} className="p-3 rounded-lg border border-(--card-border) bg-foreground/5 mb-2 text-sm text-foreground">
                                            <span className="font-bold text-brand-500 mr-2">A{i + 1}.</span>
                                            <Latex>{item}</Latex>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Column B</span>
                                    {matchRight.filter(Boolean).map((item, i) => (
                                        <div key={i} className="p-3 rounded-lg border border-(--card-border) bg-foreground/5 mb-2 text-sm text-foreground">
                                            <span className="font-bold text-accent-purple mr-2">B{i + 1}.</span>
                                            <Latex>{item}</Latex>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Solution preview */}
                        {solutionText && (
                            <div className="border-t border-(--panel-border) pt-6">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3 block">Solution</span>
                                <div className="prose prose-invert max-w-none text-foreground text-sm leading-relaxed">
                                    <Latex>{solutionText}</Latex>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
