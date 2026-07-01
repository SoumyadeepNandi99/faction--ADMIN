"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { BookOpen, Loader2, Plus, Trash2, ChevronRight, Folder, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";

interface ClassItem {
    id: string;
    name: string;
    description?: string;
}

export default function CurriculumPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newClassName, setNewClassName] = useState("");
    const [newClassDesc, setNewClassDesc] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: classesData, error, isLoading: loading, mutate } = useSWR("/api/v1/class/");

    const classes: ClassItem[] = classesData && Array.isArray(classesData.classes)
        ? classesData.classes
        : (Array.isArray(classesData) ? classesData : []);

    // Fix #6: close + reset form
    const closeModal = () => {
        setIsModalOpen(false);
        setNewClassName("");
        setNewClassDesc("");
    };

    const handleCreateClass = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newClassName.trim()) return;
        setIsSubmitting(true);
        try {
            const res = await apiClient.post("/api/v1/class/", {
                name: newClassName,
                description: newClassDesc
            });
            // Fix #2: updater fn
            mutate((cur: any) => {
                const existing = Array.isArray(cur?.classes) ? cur.classes : (Array.isArray(cur) ? cur : []);
                return { classes: [...existing, res.data] };
            }, false);
            closeModal();
            toast.success("Class created."); // Fix #6
        } catch {
            toast.error("Failed to create Class");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClass = async (e: React.MouseEvent, id: string, name: string) => {
        e.preventDefault();
        // Fix #5: destructive
        if (!(await confirmAction({ title: "Delete Class", description: `Delete class "${name}" and ALL its nested subjects, chapters, and topics? This cannot be undone.`, destructive: true }))) return;
        try {
            await apiClient.delete(`/api/v1/class/${id}`);
            // Fix #3: updater fn
            mutate((cur: any) => {
                const existing = Array.isArray(cur?.classes) ? cur.classes : (Array.isArray(cur) ? cur : []);
                return { classes: existing.filter((c: ClassItem) => c.id !== id) };
            }, false);
            toast.success("Class deleted."); // Fix #6
        } catch {
            toast.error("Failed to delete Class. It might have protective relations.");
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Curriculum Engine</h1>
                        <p className="text-muted-foreground">Manage the structural skeleton: Classes &rarr; Subjects &rarr; Chapters &rarr; Topics.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer"
                    >
                        <Plus className="h-4 w-4" /> Create Class
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="glass-card p-6 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <Skeleton className="h-12 w-12 rounded-xl" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-32 rounded" />
                                            <Skeleton className="h-4 w-24 rounded" />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <Skeleton className="h-10 w-full rounded-lg" />
                                    <Skeleton className="h-10 w-full rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    // Fix #1: real error UI instead of fake data
                    <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
                        <RefreshCw className="h-8 w-8 text-destructive/50" />
                        <h3 className="text-lg font-bold text-foreground">Failed to Load Classes</h3>
                        <p className="text-muted-foreground text-sm">Could not fetch curriculum data from the server.</p>
                        <button onClick={() => mutate()}
                            className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                            Retry
                        </button>
                    </div>
                ) : classes.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
                        <div className="h-16 w-16 bg-foreground/5 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">No Classes Found</h3>
                        <p className="text-muted-foreground mt-2 max-w-md">Initialize your curriculum engine by creating the first top-level Class category.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {classes.map((cls) => (
                            <Link
                                key={cls.id}
                                href={`/curriculum/class/${cls.id}`}
                                className="glass-card flex flex-col transition-all group overflow-hidden hover:border-brand-500/30"
                            >
                                <div className="p-6 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-brand-500/10 rounded-xl">
                                            <Folder className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteClass(e, cls.id, cls.name)}
                                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                                            title="Delete Class"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-brand-500 transition-colors">
                                        {cls.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {cls.description || "No description provided."}
                                    </p>
                                </div>
                                <div className="p-4 border-t border-(--panel-border) bg-foreground/5 mt-auto flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground group-hover:text-brand-500 transition-colors">Manage Subjects</span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-500 transition-colors" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                        {/* Fix #4: X button */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Create New Class</h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateClass} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Class Name *</label>
                                <input
                                    type="text"
                                    value={newClassName}
                                    onChange={(e) => setNewClassName(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="e.g. Class 11 (JEE)"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                                <textarea
                                    value={newClassDesc}
                                    onChange={(e) => setNewClassDesc(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-brand-500 outline-none resize-none h-24"
                                    placeholder="Optional context about this class..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={closeModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newClassName.trim()}
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
