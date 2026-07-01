"use client";

import "katex/dist/katex.min.css";
import Latex from "react-latex";
import { Award, Hash, Tag } from "lucide-react";
import type { ContestQuestionDetail } from "@/lib/api/contests";

export const diffLabel = (d: number) => (d === 1 ? "Easy" : d === 2 ? "Medium" : "Hard");
export const diffColor = (d: number) =>
    d === 1
        ? "bg-green-500/10 text-green-500"
        : d === 2
            ? "bg-yellow-500/10 text-yellow-500"
            : "bg-red-500/10 text-red-500";
export const typeLabel = (t: string) => {
    switch (t) {
        case "scq": return "Single Correct";
        case "mcq": return "Multiple Correct";
        case "integer": return "Integer";
        case "match_the_column": return "Match the Column";
        default: return t;
    }
};

/** Indices of the correct option(s) for an SCQ/MCQ question. */
function correctIndices(q: ContestQuestionDetail): number[] {
    if (q.type === "scq") {
        return q.scq_correct_options !== null && q.scq_correct_options !== undefined ? [q.scq_correct_options] : [];
    }
    return q.mcq_correct_option || [];
}

interface QuestionPreviewProps {
    question: ContestQuestionDetail;
    /** Sequence number shown as "Q{index}". Optional. */
    index?: number;
    /**
     * "admin" (default) reveals the correct answer, solution, and metadata badges.
     * "student" hides the answer + solution and renders exactly as a student sees
     * it during the contest (no correct-option highlighting).
     */
    mode?: "admin" | "student";
}

/**
 * Read-only preview of a single contest question with full LaTeX rendering,
 * options, correct answer, solution, image, and metadata. Mirrors the question
 * detail layout used in content/[questionId].
 */
export function QuestionPreview({ question: q, index, mode = "admin" }: QuestionPreviewProps) {
    const isAdmin = mode === "admin";
    const opts = q.scq_options || q.mcq_options || [];
    const correct = isAdmin ? correctIndices(q) : [];

    return (
        <div className="glass-card p-6">
            {/* Metadata badges */}
            <div className="flex flex-wrap gap-2 items-center mb-5">
                {index !== undefined && (
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                        Q{index}
                    </span>
                )}
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${diffColor(q.difficulty)}`}>
                    {diffLabel(q.difficulty)}
                </span>
                <span className="px-2.5 py-1 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                    {typeLabel(q.type)}
                </span>
                <span className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                    <Award className="h-3 w-3" /> {q.marks} mark{q.marks !== 1 ? "s" : ""}
                </span>
                {isAdmin && q.subject_name && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border)">
                        <Tag className="h-3 w-3" /> {q.subject_name}
                    </span>
                )}
                {isAdmin && q.exam_type?.map(et => (
                    <span key={et} className="px-2.5 py-1 rounded-full bg-foreground/5 text-muted-foreground text-xs font-medium border border-(--card-border)">
                        {et}
                    </span>
                ))}
                {isAdmin && q.questions_solved > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-foreground/5 text-muted-foreground border border-(--card-border) ml-auto">
                        <Hash className="h-3 w-3" /> {q.questions_solved} solved
                    </span>
                )}
            </div>

            {/* Question image */}
            {q.question_image && (
                <div className="mb-5 rounded-xl overflow-hidden border border-(--card-border) bg-foreground/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.question_image} alt="Question" className="max-w-full max-h-80 object-contain mx-auto p-4" />
                </div>
            )}

            {/* Question text */}
            <div className="prose prose-invert max-w-none text-foreground leading-relaxed mb-6">
                <Latex>{q.question_text}</Latex>
            </div>

            {/* Options (SCQ / MCQ) */}
            {(q.type === "scq" || q.type === "mcq") && opts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {opts.map((opt, i) => {
                        const isCorrect = correct.includes(i);
                        return (
                            <div key={i} className={`p-3.5 rounded-xl border transition-all ${isCorrect ? "border-green-500/50 bg-green-500/5" : "border-(--card-border) bg-foreground/5"}`}>
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

            {/* Integer answer — admin only */}
            {isAdmin && q.type === "integer" && q.integer_answer !== null && q.integer_answer !== undefined && (
                <div className="p-5 rounded-xl border border-green-500/30 bg-green-500/5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Correct Answer</span>
                    <p className="text-3xl font-bold text-green-500 mt-1">{q.integer_answer}</p>
                </div>
            )}

            {/* Integer answer placeholder — student view shows the input affordance, not the answer */}
            {!isAdmin && q.type === "integer" && (
                <div className="p-4 rounded-xl border border-(--card-border) bg-foreground/5 text-sm text-muted-foreground">
                    Numerical answer (integer)
                </div>
            )}

            {/* Solution — admin only */}
            {isAdmin && q.solution_text && (
                <div className="border-t border-(--card-border) pt-5 mt-6">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Solution &amp; Explanation</h4>
                    <div className="prose prose-invert max-w-none text-foreground leading-relaxed bg-foreground/5 p-5 rounded-xl border border-(--card-border)">
                        <Latex>{q.solution_text}</Latex>
                    </div>
                </div>
            )}
        </div>
    );
}
