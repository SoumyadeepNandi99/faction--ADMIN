"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, Upload, X, Pencil, ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { confirmAction } from "@/components/ui/confirm-modal";
import { formatDate } from "@/lib/datetime";
import {
    getBanners,
    createBanner,
    updateBanner,
    updateBannerImage,
    deleteBanner,
    type Banner,
} from "@/lib/api/banners";

export default function BannersPage() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const fileRef = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState("");
    const [order, setOrder] = useState("0");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    useEffect(() => { fetchBanners(); }, []);

    const fetchBanners = async () => {
        setLoading(true);
        try {
            const data = await getBanners();
            setBanners(data.banners || []);
        } catch {
            setBanners([]);
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setModalMode("create");
        setEditingId(null);
        setTitle("");
        setOrder(String(banners.length));
        setImageFile(null);
        setImagePreview(null);
        if (fileRef.current) fileRef.current.value = "";
        setIsModalOpen(true);
    };

    const openEdit = (banner: Banner) => {
        setModalMode("edit");
        setEditingId(banner.id);
        setTitle(banner.title || "");
        setOrder(String(banner.order));
        setImageFile(null);
        setImagePreview(banner.image_url);
        if (fileRef.current) fileRef.current.value = "";
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setImageFile(null);
        setImagePreview(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        const orderNum = order !== "" ? Number(order) : 0;

        if (modalMode === "create") {
            if (!imageFile) {
                toast.error("A banner image is required.");
                return;
            }
            setIsSubmitting(true);
            try {
                const created = await createBanner({ image: imageFile, title: title || undefined, order: orderNum });
                setBanners(prev => [...prev, created].sort((a, b) => a.order - b.order));
                toast.success("Banner added.");
                closeModal();
            } catch (err) {
                toast.error(getApiError(err, "Failed to add banner."));
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (!editingId) return;
        setIsSubmitting(true);
        try {
            let updated = await updateBanner(editingId, { title: title || null, order: orderNum });
            if (imageFile) updated = await updateBannerImage(editingId, imageFile);
            const next = updated;
            setBanners(prev => prev.map(b => b.id === editingId ? next : b).sort((a, b) => a.order - b.order));
            toast.success("Banner updated.");
            closeModal();
        } catch (err) {
            toast.error(getApiError(err, "Failed to update banner."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async (banner: Banner) => {
        setTogglingId(banner.id);
        try {
            const updated = await updateBanner(banner.id, { is_active: !banner.is_active });
            setBanners(prev => prev.map(b => b.id === banner.id ? updated : b));
            toast.success(`Banner ${updated.is_active ? "shown" : "hidden"}.`);
        } catch (err) {
            toast.error(getApiError(err, "Failed to update banner."));
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!(await confirmAction({ title: "Confirm Action", description: "Delete this banner?" }))) return;
        setDeletingId(id);
        try {
            await deleteBanner(id);
            setBanners(prev => prev.filter(b => b.id !== id));
            toast.success("Banner deleted.");
        } catch (err) {
            toast.error(getApiError(err, "Failed to delete banner."));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Home Banners</h1>
                        <p className="text-muted-foreground">Upload, reorder, and manage the banner images shown in the app home carousel.</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="sm:hidden text-sm text-muted-foreground">({banners.length})</span>
                        <button onClick={openCreate}
                            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">
                            <Plus className="h-4 w-4" /> Add Banner
                        </button>
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="glass-card p-4 flex flex-col gap-3">
                                <Skeleton className="w-full aspect-[16/6] rounded-xl" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        ))}
                    </div>
                ) : banners.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <ImageIcon className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No Banners Yet</h3>
                        <p className="text-muted-foreground mt-1 text-sm">Add your first home page banner image.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {banners.map(banner => (
                            <div key={banner.id} className="glass-card p-4 flex flex-col gap-3 group relative overflow-hidden">
                                {/* Actions */}
                                <div className="absolute top-6 right-6 z-10 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEdit(banner)}
                                        className="p-1.5 bg-background/80 backdrop-blur text-muted-foreground hover:text-brand-500 hover:bg-background rounded-lg transition-colors cursor-pointer">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(banner.id)} disabled={deletingId === banner.id}
                                        className="p-1.5 bg-background/80 backdrop-blur text-muted-foreground hover:text-destructive hover:bg-background rounded-lg transition-colors cursor-pointer disabled:opacity-60">
                                        {deletingId === banner.id
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Trash2 className="h-3.5 w-3.5" />}
                                    </button>
                                </div>

                                <div className="w-full aspect-[16/6] rounded-xl bg-foreground/5 overflow-hidden border border-(--card-border)">
                                    <img src={banner.image_url} alt={banner.title || "banner"} className="h-full w-full object-cover" />
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground truncate">{banner.title || "Untitled banner"}</p>
                                        <p className="text-xs text-muted-foreground">Order {banner.order} · {formatDate(banner.created_at)}</p>
                                    </div>
                                    <button
                                        onClick={() => handleToggleActive(banner)}
                                        disabled={togglingId === banner.id}
                                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors cursor-pointer disabled:opacity-60 shrink-0
                                            ${banner.is_active
                                                ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                                                : "bg-foreground/10 text-muted-foreground hover:bg-foreground/15"
                                            }`}>
                                        {togglingId === banner.id
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <span className={`h-1.5 w-1.5 rounded-full ${banner.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />}
                                        {banner.is_active ? "Visible" : "Hidden"}
                                    </button>
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
                                {modalMode === "create" ? "Add Banner" : "Edit Banner"}
                            </h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Image upload */}
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                    Banner Image {modalMode === "create" && <span className="text-destructive">*</span>}
                                </label>
                                <div onClick={() => fileRef.current?.click()}
                                    className="w-full aspect-[16/6] rounded-xl border-2 border-dashed border-(--input) flex items-center justify-center cursor-pointer hover:border-brand-500 transition-colors overflow-hidden bg-foreground/5 group">
                                    {imagePreview
                                        ? <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                                        : <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-brand-500 transition-colors">
                                            <Upload className="h-6 w-6" />
                                            <span className="text-xs">Click to upload (wide image recommended)</span>
                                        </div>}
                                </div>
                                <input type="file" accept="image/*" ref={fileRef} onChange={handleFileChange} className="hidden" />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {modalMode === "edit" ? "Click to replace the image" : "Required (PNG/JPG)"}
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-foreground mb-1">Title (optional)</label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="Admin label (not shown in app)" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Order</label>
                                    <input type="number" min={0} value={order} onChange={e => setOrder(e.target.value)}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="0" />
                                </div>
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
                                        : modalMode === "create" ? "Add Banner" : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
