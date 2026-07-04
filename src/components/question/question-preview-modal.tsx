"use client";

/**
 * A modal that shows the FULL detail of a single question (image, LaTeX text,
 * options with the correct answer highlighted, integer answer, and solution) by
 * fetching GET /questions/{id}. Reuses the existing <QuestionPreview> renderer.
 *
 * Built so any list that only has lean question data (e.g. the POTD scheduler,
 * whose /questions/ list response omits options/answers) can let the admin
 * verify the actual question and its image before scheduling it.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { X, Loader2, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/axios";
import { QuestionPreview } from "@/components/contest/question-preview";
import type { ContestQuestionDetail } from "@/lib/api/contests";

/** The full single-question response (GET /questions/{id}). */
interface QuestionDetail {
    id: string;
    topic_id: string;
    type: string;
    difficulty: number;
    exam_type: string[];
    question_text: string;
    marks: number;
    solution_text?: string | null;
    question_image?: string | null;
    integer_answer?: number | null;
    mcq_options?: string[] | null;
    mcq_correct_option?: number[] | null;
    scq_options?: string[] | null;
    scq_correct_options?: number | null;
    questions_solved?: number | null;
}

/** Adapt the question-detail shape to what QuestionPreview expects. */
function toPreview(q: QuestionDetail): ContestQuestionDetail {
    return {
        id: q.id,
        topic_id: q.topic_id,
        subject_id: null,
        subject_name: null,
        type: q.type,
        difficulty: q.difficulty,
        exam_type: q.exam_type as ContestQuestionDetail["exam_type"],
        question_text: q.question_text,
        marks: q.marks,
        solution_text: q.solution_text ?? "",
        question_image: q.question_image ?? null,
        integer_answer: q.integer_answer ?? null,
        mcq_options: q.mcq_options ?? null,
        mcq_correct_option: q.mcq_correct_option ?? null,
        scq_options: q.scq_options ?? null,
        scq_correct_options: q.scq_correct_options ?? null,
        questions_solved: q.questions_solved ?? 0,
    };
}

const fetchQuestionDetail = (id: string) =>
    apiClient.get<QuestionDetail>(`/api/v1/questions/${id}`).then(r => r.data);

export function QuestionPreviewModal({ questionId, onClose }: { questionId: string | null; onClose: () => void }) {
    const { data, error, isLoading, mutate } = useSWR(
        questionId ? `question-detail:${questionId}` : null,
        () => fetchQuestionDetail(questionId as string),
        { revalidateOnFocus: false },
    );

    // Close on Escape.
    useEffect(() => {
        if (!questionId) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [questionId, onClose]);

    // Portal target only exists in the browser; this component always renders
    // inside a "use client" page, but guard anyway for safety.
    if (!questionId || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 sm:p-8"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl my-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Question preview</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors cursor-pointer"
                        aria-label="Close preview"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="glass-card p-12 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="glass-card p-10 text-center flex flex-col items-center gap-3">
                        <RefreshCw className="h-7 w-7 text-destructive/50" />
                        <p className="text-sm text-muted-foreground">Failed to load this question.</p>
                        <button onClick={() => mutate()} className="text-sm text-brand-500 hover:text-brand-400 font-medium cursor-pointer">
                            Retry
                        </button>
                    </div>
                ) : data ? (
                    <QuestionPreview question={toPreview(data)} mode="admin" />
                ) : null}
            </div>
        </div>,
        document.body,
    );
}
