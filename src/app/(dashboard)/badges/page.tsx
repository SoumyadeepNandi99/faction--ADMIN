"use client";

import { useState, useEffect, useRef } from "react";
import { Award, Plus, Trash2, Loader2, Shield, Zap, Upload, X, Pencil, Lock, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { confirmAction } from "@/components/ui/confirm-modal";
import { formatDate } from "@/lib/datetime";
import {
    getBadges,
    createBadge,
    updateBadge,
    uploadBadgeActiveIcon,
    uploadBadgeInactiveIcon,
    deleteBadge,
    flushBadgeCache,
    type Badge,
} from "@/lib/api/media";

const CATEGORY_OPTIONS = [
    { label: "Streak", value: "streak" },
    { label: "Practice Arena", value: "practice_arena" },
];

const emptyForm = {
    name: "",
    description: "",
    category: "streak" as Badge["category"],
    requirement_description: "",
    requirement_value: "",
    is_active: true,
};

export default function BadgesPage() {
    const [badges, setBadges] = useState<Badge[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState("ALL");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [flushing, setFlushing] = useState(false);

    const [form, setForm] = useState(emptyForm);

    // The backend models two icons: the active icon (`icon_image`, set only at
    // creation) and the inactive/grey icon (`inactive_icon_image`, replaceable
    // via PATCH). Track them separately.
    const activeFileRef = useRef<HTMLInputElement>(null);
    const inactiveFileRef = useRef<HTMLInputElement>(null);
    const [activeIconFile, setActiveIconFile] = useState<File | null>(null);
    const [activeIconPreview, setActiveIconPreview] = useState<string | null>(null);
    const [inactiveIconFile, setInactiveIconFile] = useState<File | null>(null);
    const [inactiveIconPreview, setInactiveIconPreview] = useState<string | null>(null);

    useEffect(() => { fetchBadges(); }, []);

    const fetchBadges = async () => {
        setLoading(true);
        try {
            const data = await getBadges();
            setBadges(data.badges || []);
        } catch {
            setBadges([]);
        } finally {
            setLoading(false);
        }
    };

    const resetIcons = () => {
        setActiveIconFile(null);
        setActiveIconPreview(null);
        setInactiveIconFile(null);
        setInactiveIconPreview(null);
        if (activeFileRef.current) activeFileRef.current.value = "";
        if (inactiveFileRef.current) inactiveFileRef.current.value = "";
    };

    const openCreate = () => {
        setModalMode("create");
        setEditingId(null);
        setForm(emptyForm);
        resetIcons();
        setIsModalOpen(true);
    };

    const openEdit = (badge: Badge) => {
        setModalMode("edit");
        setEditingId(badge.id);
        setForm({
            name: badge.name,
            description: badge.description,
            category: badge.category,
            requirement_description: badge.requirement_description,
            requirement_value: badge.requirement_value != null ? String(badge.requirement_value) : "",
            is_active: badge.is_active,
        });
        resetIcons();
        // Show current icons as previews; only the inactive one is replaceable.
        setActiveIconPreview(badge.icon_url || null);
        setInactiveIconPreview(badge.inactive_icon_url || null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setForm(emptyForm);
        resetIcons();
        setEditingId(null);
    };

    const handleActiveFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setActiveIconFile(file);
            setActiveIconPreview(URL.createObjectURL(file));
        }
    };

    const handleInactiveFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setInactiveIconFile(file);
            setInactiveIconPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (modalMode === "create") {
            if (!activeIconFile) {
                toast.error("An active icon image is required.");
                return;
            }
            setIsSubmitting(true);
            try {
                const created = await createBadge({
                    name: form.name,
                    description: form.description,
                    category: form.category,
                    icon_image: activeIconFile,
                    inactive_icon_image: inactiveIconFile,
                    requirement_description: form.requirement_description,
                    requirement_value: form.requirement_value !== "" ? Number(form.requirement_value) : null,
                    is_active: form.is_active,
                });
                setBadges(prev => [created, ...prev]);
                toast.success("Badge created successfully.");
                closeModal();
            } catch (err) {
                toast.error(getApiError(err, "Failed to create badge."));
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // Edit mode: update metadata (PATCH /badges/{id}) and/or the active/inactive
        // icons (their dedicated endpoints). Each call returns the full updated badge.
        if (!editingId) return;
        setIsSubmitting(true);
        try {
            let updated: Badge | null = await updateBadge(editingId, {
                name: form.name,
                description: form.description,
                category: form.category,
                requirement_description: form.requirement_description,
                requirement_value: form.requirement_value !== "" ? Number(form.requirement_value) : null,
            });
            if (activeIconFile) updated = await uploadBadgeActiveIcon(editingId, activeIconFile);
            if (inactiveIconFile) updated = await uploadBadgeInactiveIcon(editingId, inactiveIconFile);
            if (updated) {
                const next = updated;
                setBadges(prev => prev.map(b => b.id === editingId ? next : b));
            }
            toast.success("Badge updated successfully.");
            closeModal();
        } catch (err) {
            toast.error(getApiError(err, "Failed to update badge."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFlushCache = async () => {
        setFlushing(true);
        try {
            await flushBadgeCache();
            toast.success("Badge cache flushed.");
        } catch (err) {
            toast.error(getApiError(err, "Failed to flush badge cache."));
        } finally {
            setFlushing(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!(await confirmAction({ title: "Confirm Action", description: `Delete badge "${name}"?` }))) return;
        setDeletingId(id);
        try {
            await deleteBadge(id);
            setBadges(prev => prev.filter(b => b.id !== id));
            toast.success("Badge deleted.");
        } catch (err) {
            toast.error(getApiError(err, "Failed to delete badge."));
        } finally {
            setDeletingId(null);
        }
    };

    const categoryIcon = (cat: string) =>
        cat === "streak"
            ? <Zap className="h-3.5 w-3.5 text-yellow-500" />
            : <Shield className="h-3.5 w-3.5 text-accent-purple" />;

    const filteredBadges = filterCategory === "ALL"
        ? badges
        : badges.filter(b => b.category === filterCategory);

    const isEdit = modalMode === "edit";

    return (
        <>
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Badge Manager</h1>
                        <p className="text-muted-foreground">Create and manage achievement badges for student milestones.</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {/* Count shown next to button on mobile only */}
                        <span className="sm:hidden text-sm text-muted-foreground">({filteredBadges.length} badges)</span>
                        <button onClick={handleFlushCache} disabled={flushing} title="Clear cached badges so changes show immediately"
                            className="flex items-center gap-2 border border-(--card-border) bg-foreground/5 hover:bg-foreground/10 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                            {flushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            <span className="hidden sm:inline">Flush Cache</span>
                        </button>
                        <button onClick={openCreate}
                            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">
                            <Plus className="h-4 w-4" /> Create Badge
                        </button>
                    </div>
                </div>

                {/* Category filter */}
                <div className="glass-card p-4 flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                        {["ALL", "streak", "practice_arena"].map(cat => (
                            <button key={cat} onClick={() => setFilterCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer
                                    ${filterCategory === cat
                                        ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                                        : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                                    }`}>
                                {cat === "ALL" ? "All" : cat === "streak" ? "Streak" : "Practice Arena"}
                            </button>
                        ))}
                    </div>
                    {/* Count shown in filter bar on sm+ only */}
                    <span className="hidden sm:block text-sm text-muted-foreground shrink-0">{filteredBadges.length} badges</span>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="glass-card p-6 flex flex-col gap-4">
                                <div className="flex gap-4">
                                    <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
                                    <div className="flex-1 space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-20" /></div>
                                </div>
                                <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" />
                            </div>
                        ))}
                    </div>
                ) : filteredBadges.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <Award className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No Badges Found</h3>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {filterCategory === "ALL" ? "Create your first achievement badge to reward students." : `No ${filterCategory === "streak" ? "Streak" : "Practice Arena"} badges yet.`}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredBadges.map(badge => (
                            <div key={badge.id} className="glass-card p-6 flex flex-col gap-3 group relative overflow-hidden">
                                {/* Action buttons — always visible on mobile, hover-only on desktop */}
                                <div className="absolute top-3 right-3 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEdit(badge)}
                                        className="p-1.5 text-muted-foreground hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-colors cursor-pointer">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(badge.id, badge.name)}
                                        disabled={deletingId === badge.id}
                                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer disabled:opacity-60">
                                        {deletingId === badge.id
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Trash2 className="h-3.5 w-3.5" />}
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 pr-14">
                                    <div className="h-16 w-16 rounded-xl bg-brand-500/10 flex items-center justify-center overflow-hidden border border-brand-500/20 shrink-0">
                                        {badge.icon_url
                                            ? <img src={badge.icon_url} alt={badge.name} className="h-full w-full object-contain p-1" />
                                            : <Award className="h-8 w-8 text-brand-500" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-foreground group-hover:text-brand-500 transition-colors truncate">{badge.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {categoryIcon(badge.category)}
                                            <span className="text-xs text-muted-foreground capitalize">{badge.category.replace("_", " ")}</span>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-2">{badge.description}</p>

                                <div className="text-xs font-medium text-foreground bg-foreground/5 px-3 py-2 rounded-lg border border-(--card-border) mt-auto">
                                    🎯 {badge.requirement_description}
                                    {badge.requirement_value != null && (
                                        <span className="text-brand-500 ml-1">({badge.requirement_value})</span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    {/* Static status — the backend has no endpoint to toggle is_active
                                        on an existing badge, so this is informational only. */}
                                    <span
                                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full
                                            ${badge.is_active
                                                ? "bg-green-500/10 text-green-500"
                                                : "bg-foreground/10 text-muted-foreground"
                                            }`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${badge.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                                        {badge.is_active ? "Active" : "Inactive"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{formatDate(badge.created_at)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-foreground">
                                {isEdit ? "Edit Badge" : "Create Badge"}
                            </h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {isEdit && (
                            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-foreground">
                                <Lock className="h-3.5 w-3.5 text-brand-500 mt-0.5 shrink-0" />
                                <span>Edit the badge details and/or icons below. The <strong>Active</strong> status is set at creation and can&apos;t be changed.</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Icon Uploads */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Active icon */}
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">
                                        Active Icon {!isEdit && <span className="text-destructive">*</span>}
                                    </label>
                                    <div
                                        onClick={() => activeFileRef.current?.click()}
                                        className="h-20 w-full rounded-xl border-2 border-dashed border-(--input) flex items-center justify-center cursor-pointer hover:border-brand-500 transition-colors overflow-hidden bg-foreground/5 group">
                                        {activeIconPreview
                                            ? <img src={activeIconPreview} alt="active icon" className="h-full w-full object-contain p-1" />
                                            : <Upload className="h-6 w-6 text-muted-foreground group-hover:text-brand-500 transition-colors" />}
                                    </div>
                                    <input type="file" accept="image/*" ref={activeFileRef} onChange={handleActiveFileChange} className="hidden" />
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {isEdit ? "Click to replace icon" : "Required (PNG/SVG)"}
                                    </p>
                                </div>

                                {/* Inactive icon */}
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Inactive (grey) Icon</label>
                                    <div
                                        onClick={() => inactiveFileRef.current?.click()}
                                        className="h-20 w-full rounded-xl border-2 border-dashed border-(--input) flex items-center justify-center cursor-pointer hover:border-brand-500 transition-colors overflow-hidden bg-foreground/5 group">
                                        {inactiveIconPreview
                                            ? <img src={inactiveIconPreview} alt="inactive icon" className="h-full w-full object-contain p-1" />
                                            : <Upload className="h-6 w-6 text-muted-foreground group-hover:text-brand-500 transition-colors" />}
                                    </div>
                                    <input type="file" accept="image/*" ref={inactiveFileRef} onChange={handleInactiveFileChange} className="hidden" />
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {isEdit ? "Click to replace grey icon" : "Optional (PNG/SVG)"}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Badge Name *</label>
                                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="e.g. 7-Day Streak Master" />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Description *</label>
                                <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none resize-none h-20"
                                    placeholder="What does this badge reward?" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Category</label>
                                    <CustomSelect
                                        value={form.category}
                                        onChange={v => setForm(f => ({ ...f, category: v as Badge["category"] }))}
                                        options={CATEGORY_OPTIONS}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Requirement Value</label>
                                    <input type="number" value={form.requirement_value} onChange={e => setForm(f => ({ ...f, requirement_value: e.target.value }))}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="e.g. 7" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Requirement Description *</label>
                                <input type="text" required value={form.requirement_description} onChange={e => setForm(f => ({ ...f, requirement_description: e.target.value }))}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="e.g. Maintain 7-day study streak" />
                            </div>

                            {/* Active toggle — only meaningful at creation */}
                            <div className="flex items-center justify-between p-3 bg-foreground/5 rounded-lg border border-(--card-border)">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Active</p>
                                    <p className="text-xs text-muted-foreground">
                                        {isEdit ? "Set at creation — can't be changed" : "Inactive badges won't be awarded to students"}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    disabled={isEdit}
                                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${form.is_active ? "bg-brand-500" : "bg-foreground/20"} ${isEdit ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={closeModal}
                                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-[110px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                                    {isSubmitting
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : isEdit ? "Save Changes" : "Create Badge"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
