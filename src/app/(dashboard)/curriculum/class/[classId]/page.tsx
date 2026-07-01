"use client";

import { useState } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { ArrowLeft, Book, Plus, Loader2, ChevronRight, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";

interface SubjectItem {
    id: string;
    name?: string;
    subject_type?: string;
    class_id: string;
    exam_type?: string | string[];
}

interface ClassInfo { id: string; name: string; }

export default function ClassSubjectsPage() {
    const params = useParams();
    const classId = params.classId as string;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState("");
    const [newExamType, setNewExamType] = useState("JEE_MAINS");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchClassDetails = async () => {
        const [classRes, subjectsRes] = await Promise.allSettled([
            apiClient.get(`/api/v1/class/${classId}`),
            apiClient.get(`/api/v1/subjects/?class_id=${classId}`),
        ]);
        let cInfo = null;
        if (classRes.status === "fulfilled") cInfo = classRes.value.data;
        let subs = [];
        if (subjectsRes.status === "fulfilled") {
            const data = subjectsRes.value.data;
            subs = Array.isArray(data) ? data : (data.subjects || []);
        }
        return { classInfo: cInfo, subjects: subs };
    };

    const { data, error, isLoading: loading, mutate } = useSWR(`/api/v1/class/${classId}/details`, fetchClassDetails);
    const classInfo = data?.classInfo || null;
    const subjects = (data?.subjects || []) as SubjectItem[];

    // Fix #8: close + reset
    const closeModal = () => {
        setIsModalOpen(false);
        setNewSubjectName("");
        setNewExamType("JEE_MAINS");
    };

    const handleCreate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newSubjectName.trim()) return;
        setIsSubmitting(true);
        try {
            const res = await apiClient.post("/api/v1/subjects/", {
                subject_type: newSubjectName,
                class_id: classId,
                exam_type: [newExamType],
            });
            // Fix #7: updater fn
            mutate((cur: any) => ({ ...cur, subjects: [...(cur?.subjects || []), res.data] }), false);
            closeModal();
            toast.success("Subject created."); // Fix #10
        } catch {
            toast.error("Failed to create Subject.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
        e.preventDefault();
        // Fix #9: destructive
        if (!(await confirmAction({ title: "Delete Subject", description: `Delete subject "${name}"? This removes all underlying chapters and topics.`, destructive: true }))) return;
        try {
            await apiClient.delete(`/api/v1/subjects/${id}`);
            // Fix #7: updater fn
            mutate((cur: any) => ({ ...cur, subjects: (cur?.subjects || []).filter((s: SubjectItem) => s.id !== id) }), false);
            toast.success("Subject deleted.");
        } catch {
            toast.error("Failed to delete Subject.");
        }
    };

    const examColors: Record<string, string> = {
        JEE_MAINS: "text-accent-blue bg-accent-blue/10",
        JEE_ADVANCED: "text-accent-purple bg-accent-purple/10",
        NEET: "text-green-500 bg-green-500/10",
        OLYMPIAD: "text-yellow-500 bg-yellow-500/10",
        CBSE: "text-red-500 bg-red-500/10",
    };

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/curriculum" className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-colors border border-(--card-border)">
                            <ArrowLeft className="h-5 w-5 text-foreground" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <Link href="/curriculum" className="hover:text-foreground transition-colors">Curriculum</Link>
                                <span>/</span>
                                <span>{classInfo?.name || "..."}</span>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">Subjects</h1>
                        </div>
                    </div>
                    <button onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer">
                        <Plus className="h-4 w-4" /> Add Subject
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="glass-card p-6 flex flex-col gap-4">
                                <Skeleton className="h-12 w-12 rounded-xl" />
                                <Skeleton className="h-5 w-32 rounded" />
                                <Skeleton className="h-4 w-24 rounded" />
                                <Skeleton className="h-10 w-full rounded-lg mt-2" />
                            </div>
                        ))}
                    </div>
                ) : subjects.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <Book className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No Subjects Yet</h3>
                        <p className="text-muted-foreground mt-1 text-sm">Add subjects like Physics, Chemistry, Maths, or Biology.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subjects.map(sub => (
                            <Link
                                key={sub.id}
                                href={`/curriculum/subject/${sub.id}`}
                                className="glass-card flex flex-col transition-all group overflow-hidden hover:border-brand-500/30"
                            >
                                <div className="p-6 flex-1 relative">
                                    <button
                                        onClick={(e) => handleDelete(e, sub.id, sub.subject_type || sub.name || "Unknown")}
                                        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    <div className="w-12 h-12 bg-linear-to-br from-brand-600 to-brand-400 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-4 shadow-sm shadow-brand-500/20">
                                        {(sub.subject_type || sub.name || "SUB").substring(0, 2).toUpperCase()}
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-brand-500 transition-colors">
                                        {sub.subject_type || sub.name || "Unnamed"}
                                    </h3>
                                    {sub.exam_type && (
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${examColors[Array.isArray(sub.exam_type) ? sub.exam_type[0] : sub.exam_type] || "text-muted-foreground bg-foreground/10"}`}>
                                            {Array.isArray(sub.exam_type) ? sub.exam_type.join(", ") : sub.exam_type}
                                        </span>
                                    )}
                                </div>
                                <div className="p-4 border-t border-(--panel-border) bg-foreground/5 flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground group-hover:text-brand-500 transition-colors">Manage Chapters</span>
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
                        {/* Fix #8: X button */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Add Subject</h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Subject Name *</label>
                                <input type="text" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="e.g. Physics" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Exam Type</label>
                                <CustomSelect value={newExamType} onChange={setNewExamType}
                                    options={[
                                        { label: "JEE Mains", value: "JEE_MAINS" },
                                        { label: "JEE Advanced", value: "JEE_ADVANCED" },
                                        { label: "NEET", value: "NEET" },
                                        { label: "Olympiad", value: "OLYMPIAD" },
                                        { label: "CBSE", value: "CBSE" },
                                    ]} />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={closeModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isSubmitting || !newSubjectName.trim()}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-[80px] cursor-pointer disabled:opacity-60">
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
