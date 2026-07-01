"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Users, Youtube, Layers, ChevronRight, Search, X, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";
import { Batch, TARGET_EXAM_OPTIONS } from "@/lib/batches";
import { getApiError } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

interface UserItem {
    id: string;
    batch_id?: string | null;
}

interface VideoItem {
    id: string;
    batch_id?: string | null;
}

interface ClassItem {
    id: string;
    name: string;
}

const EMPTY_FORM = { batch_name: "", class_id: "", target_exam: "" };

export default function BatchesPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState(EMPTY_FORM);
    const [creating, setCreating] = useState(false);

    // Edit modal
    const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const { data: batchesData, isLoading: batchesLoading, mutate: mutateBatches } = useSWR<Batch[]>(
        "/api/v1/batches/",
        (url: string) => apiClient.get(url).then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : (d.batches || []);
        })
    );

    const { data: usersData, isLoading: usersLoading } = useSWR<UserItem[]>(
        "/api/v1/users/",
        (url: string) => apiClient.get(url).then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : (d.users || []);
        })
    );

    const { data: videosData, isLoading: videosLoading } = useSWR<VideoItem[]>(
        "/api/v1/youtube-videos/",
        (url: string) => apiClient.get(url).then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : (d.videos || []);
        })
    );

    const { data: classesData } = useSWR<{ classes: ClassItem[] }>(
        "/api/v1/class/",
        (url: string) => apiClient.get(url).then(r => r.data)
    );

    const loading = batchesLoading || usersLoading || videosLoading;
    const batches = batchesData || [];
    const users = usersData || [];
    const videos = videosData || [];
    const classes = classesData?.classes || [];

    const batchStats = batches.map(b => ({
        ...b,
        studentCount: users.filter(u => u.batch_id === b.id).length,
        videoCount: videos.filter(v => v.batch_id === b.id).length,
    }));

    const filtered = batchStats.filter(b =>
        !searchTerm || b.batch_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.batch_name || !createForm.class_id || !createForm.target_exam) return;
        setCreating(true);
        try {
            const res = await apiClient.post("/api/v1/batches/", {
                batch_name: createForm.batch_name,
                class_id: createForm.class_id,
                target_exam: createForm.target_exam,
            });
            mutateBatches(cur => [res.data, ...(cur || [])], false);
            setShowCreateModal(false);
            setCreateForm(EMPTY_FORM);
            toast.success(`Batch "${res.data.batch_name}" created.`);
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to create batch."));
        } finally {
            setCreating(false);
        }
    };

    const openEdit = (batch: Batch) => {
        setEditingBatch(batch);
        setEditForm({ batch_name: batch.batch_name, class_id: batch.class_id, target_exam: batch.target_exam });
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBatch) return;
        setSaving(true);
        try {
            const res = await apiClient.put(`/api/v1/batches/${editingBatch.id}`, {
                batch_name: editForm.batch_name || undefined,
                class_id: editForm.class_id || undefined,
                target_exam: editForm.target_exam || undefined,
            });
            mutateBatches(cur => (cur || []).map(b => b.id === editingBatch.id ? res.data : b), false);
            setEditingBatch(null);
            toast.success("Batch updated.");
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to update batch."));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (batch: Batch) => {
        if (!(await confirmAction({
            title: "Delete Batch",
            description: `Permanently delete batch "${batch.batch_name}"? Students assigned to this batch will be unaffected but lose their batch assignment.`,
            destructive: true,
        }))) return;
        try {
            await apiClient.delete(`/api/v1/batches/${batch.id}`);
            mutateBatches(cur => (cur || []).filter(b => b.id !== batch.id), false);
            toast.success(`Batch "${batch.batch_name}" deleted.`);
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to delete batch."));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Batches</h1>
                    <p className="text-muted-foreground">Manage batches, students, and linked video content.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                >
                    <Plus className="h-4 w-4" /> New Batch
                </button>
            </div>

            {/* Summary stats */}
            {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-card p-5 flex items-center gap-4">
                        <div className="p-3 bg-brand-500/10 rounded-xl"><Layers className="h-5 w-5 text-brand-500" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Total Batches</p>
                            <p className="text-2xl font-bold text-foreground">{batches.length}</p>
                        </div>
                    </div>
                    <div className="glass-card p-5 flex items-center gap-4">
                        <div className="p-3 bg-brand-500/10 rounded-xl"><Users className="h-5 w-5 text-brand-500" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Students in Batches</p>
                            <p className="text-2xl font-bold text-foreground">{users.filter(u => !!u.batch_id).length}</p>
                        </div>
                    </div>
                    <div className="glass-card p-5 flex items-center gap-4">
                        <div className="p-3 bg-brand-500/10 rounded-xl"><Youtube className="h-5 w-5 text-brand-500" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Videos in Batches</p>
                            <p className="text-2xl font-bold text-foreground">{videos.filter(v => !!v.batch_id).length}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="glass-card p-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search batches…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-background border border-(--input) rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    />
                </div>
                {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        <X className="h-3.5 w-3.5" /> Clear
                    </button>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{filtered.length} batch{filtered.length !== 1 ? "es" : ""}</span>
            </div>

            {/* Batch list */}
            {loading ? (
                <div className="flex flex-col gap-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="glass-card p-5 flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-40 rounded" />
                                <Skeleton className="h-3 w-24 rounded" />
                            </div>
                            <Skeleton className="h-8 w-8 rounded" />
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card p-12 text-center flex flex-col items-center">
                    <Layers className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold text-foreground">
                        {batches.length === 0 ? "No Batches Yet" : "No Batches Found"}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {batches.length === 0
                            ? "Create your first batch to get started."
                            : "Try a different search term."}
                    </p>
                    {batches.length === 0 && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-4 flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                        >
                            <Plus className="h-4 w-4" /> New Batch
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {filtered.map(batch => (
                        <div
                            key={batch.id}
                            className="glass-card p-5 flex items-center gap-4 hover:bg-foreground/3 transition-colors group"
                        >
                            <button
                                onClick={() => router.push(`/batches/${batch.id}`)}
                                className="h-12 w-12 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shrink-0 cursor-pointer"
                            >
                                <Layers className="h-5 w-5 text-brand-500" />
                            </button>
                            <button
                                onClick={() => router.push(`/batches/${batch.id}`)}
                                className="flex-1 min-w-0 text-left cursor-pointer"
                            >
                                <p className="font-semibold text-foreground truncate">{batch.batch_name}</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-muted-foreground bg-foreground/5 px-1.5 py-0.5 rounded">
                                        {TARGET_EXAM_OPTIONS.find(e => e.value === batch.target_exam)?.label ?? batch.target_exam}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Users className="h-3.5 w-3.5" /> {batch.studentCount} student{batch.studentCount !== 1 ? "s" : ""}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Youtube className="h-3.5 w-3.5" /> {batch.videoCount} video{batch.videoCount !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); openEdit(batch); }}
                                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer"
                                    title="Edit batch"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(batch); }}
                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                    title="Delete batch"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <button
                                onClick={() => router.push(`/batches/${batch.id}`)}
                                className="shrink-0 cursor-pointer"
                            >
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Batch Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Create Batch</h2>
                            <button
                                onClick={() => { setShowCreateModal(false); setCreateForm(EMPTY_FORM); }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Batch Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={createForm.batch_name}
                                    onChange={e => setCreateForm(f => ({ ...f, batch_name: e.target.value }))}
                                    placeholder="e.g. JEE-2025-BatchA"
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Class *</label>
                                <CustomSelect
                                    value={createForm.class_id}
                                    onChange={val => setCreateForm(f => ({ ...f, class_id: val }))}
                                    placeholder="Select Class"
                                    options={classes.map(c => ({ label: c.name, value: c.id }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Target Exam *</label>
                                <CustomSelect
                                    value={createForm.target_exam}
                                    onChange={val => setCreateForm(f => ({ ...f, target_exam: val }))}
                                    placeholder="Select Exam"
                                    options={TARGET_EXAM_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowCreateModal(false); setCreateForm(EMPTY_FORM); }}
                                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating || !createForm.batch_name || !createForm.class_id || !createForm.target_exam}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-24 cursor-pointer disabled:opacity-60"
                                >
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Batch"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Batch Modal */}
            {editingBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Edit Batch</h2>
                            <button
                                onClick={() => setEditingBatch(null)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleEdit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Batch Name</label>
                                <input
                                    type="text"
                                    value={editForm.batch_name}
                                    onChange={e => setEditForm(f => ({ ...f, batch_name: e.target.value }))}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Class</label>
                                <CustomSelect
                                    value={editForm.class_id}
                                    onChange={val => setEditForm(f => ({ ...f, class_id: val }))}
                                    placeholder="Select Class"
                                    options={classes.map(c => ({ label: c.name, value: c.id }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Target Exam</label>
                                <CustomSelect
                                    value={editForm.target_exam}
                                    onChange={val => setEditForm(f => ({ ...f, target_exam: val }))}
                                    placeholder="Select Exam"
                                    options={TARGET_EXAM_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingBatch(null)}
                                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-24 cursor-pointer disabled:opacity-60"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
