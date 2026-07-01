"use client";

import { useState } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { ArrowLeft, Bookmark, Plus, Loader2, ChevronRight, Trash2, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";

interface ChapterItem {
    id: string;
    name: string;
    subject_id: string;
}

export default function SubjectChaptersPage() {
    const params = useParams();
    const subjectId = params.subjectId as string;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newChapName, setNewChapName] = useState("");
    const [newChapDesc, setNewChapDesc] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchChapters = async () => {
        const res = await apiClient.get(`/api/v1/chapters/?subject_id=${subjectId}`);
        const data = res.data;
        if (Array.isArray(data)) return data;
        if (data.chapters && Array.isArray(data.chapters)) return data.chapters;
        throw new Error("Invalid Format");
    };

    const { data: chaptersData, error, isLoading: loading, mutate } = useSWR(`/api/v1/chapters/?subject_id=${subjectId}`, fetchChapters);

    // Fix #11: no fake fallback — empty array on success, error UI on error
    const chapters: ChapterItem[] = chaptersData || [];

    // Fix #13: close + reset
    const closeModal = () => {
        setIsModalOpen(false);
        setNewChapName("");
        setNewChapDesc("");
    };

    const handleCreateChapter = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newChapName.trim()) return;
        setIsSubmitting(true);
        try {
            const res = await apiClient.post("/api/v1/chapters/", {
                name: newChapName,
                subject_id: subjectId
            });
            // Fix #12: updater fn
            mutate((cur: ChapterItem[] | undefined) => [...(cur || []), res.data], false);
            closeModal();
            toast.success("Chapter created."); // Fix #15
        } catch {
            toast.error("Failed to create Chapter");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteChapter = async (e: React.MouseEvent, id: string, name: string) => {
        e.preventDefault();
        // Fix #14: destructive
        if (!(await confirmAction({ title: "Delete Chapter", description: `Delete chapter "${name}"? This removes all topics underneath it.`, destructive: true }))) return;
        try {
            await apiClient.delete(`/api/v1/chapters/${id}`);
            // Fix #12: updater fn
            mutate((cur: ChapterItem[] | undefined) => (cur || []).filter((c) => c.id !== id), false);
            toast.success("Chapter deleted."); // Fix #15
        } catch {
            toast.error("Failed to delete Chapter.");
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.history.back()}
                            className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-colors border border-(--card-border)"
                        >
                            <ArrowLeft className="h-5 w-5 text-foreground" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Chapters</h1>
                            <p className="text-muted-foreground text-sm">Managing chapters for this subject.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer"
                    >
                        <Plus className="h-4 w-4" /> Create Chapter
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="glass-card flex items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12 rounded-lg" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-48 rounded" />
                                        <Skeleton className="h-4 w-64 rounded" />
                                    </div>
                                </div>
                                <Skeleton className="h-10 w-32 rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    // Fix #11: real error UI
                    <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
                        <RefreshCw className="h-8 w-8 text-destructive/50" />
                        <h3 className="text-lg font-bold text-foreground">Failed to Load Chapters</h3>
                        <p className="text-muted-foreground text-sm">Could not fetch chapter data from the server.</p>
                        <button onClick={() => mutate()}
                            className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                            Retry
                        </button>
                    </div>
                ) : chapters.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
                        <div className="h-16 w-16 bg-foreground/5 rounded-full flex items-center justify-center mb-4">
                            <Bookmark className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No Chapters Configured</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm">Break down this subject by adding distinct chapters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {chapters.map((chap, index) => (
                            <Link
                                key={chap.id}
                                href={`/curriculum/chapter/${chap.id}`}
                                className="glass-card flex items-center justify-between p-4 group transition-all hover:border-brand-500/30"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground font-mono text-lg border border-(--card-border)">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-foreground group-hover:text-brand-500 transition-colors">
                                            {chap.name}
                                        </h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => handleDeleteChapter(e, chap.id, chap.name)}
                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    <span className="flex items-center gap-2 px-4 py-2 bg-foreground/5 text-foreground border border-(--card-border) rounded-lg text-sm font-medium group-hover:bg-brand-500/10 group-hover:text-brand-500 group-hover:border-brand-500/30 transition-all">
                                        View Topics <ChevronRight className="h-4 w-4" />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                        {/* Fix #13: X button */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Create Chapter</h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateChapter} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Chapter Name *</label>
                                <input
                                    type="text"
                                    value={newChapName}
                                    onChange={(e) => setNewChapName(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="e.g. Kinematics"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                                <textarea
                                    value={newChapDesc}
                                    onChange={(e) => setNewChapDesc(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-brand-500 outline-none resize-none h-24"
                                    placeholder="Chapter focus area..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={closeModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newChapName.trim()}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-25 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
