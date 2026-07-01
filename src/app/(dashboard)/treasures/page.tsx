"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { Map, Plus, Loader2, X, Trash2, ImageIcon, RefreshCw } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { confirmAction } from "@/components/ui/confirm-modal";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { getTreasures, createTreasure, deleteTreasure, type Treasure } from "@/lib/api/treasures";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; subject_type: string; class_id: string; }
interface ChapterOption { id: string; name: string; subject_id: string; }

export default function TreasuresPage() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [chapters, setChapters] = useState<ChapterOption[]>([]);

    // Filters (top of page): Class + Exam Type → Subject → Chapter
    const [fClass, setFClass] = useState("");
    const [fExam, setFExam] = useState("");
    const [fSubject, setFSubject] = useState("");
    const [fChapter, setFChapter] = useState("");
    const [treasures, setTreasures] = useState<Treasure[]>([]);
    const [loading, setLoading] = useState(false);

    // Upload modal
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [mClass, setMClass] = useState("");
    const [mExam, setMExam] = useState("");
    const [mSubject, setMSubject] = useState("");
    const [mChapter, setMChapter] = useState("");
    const [mSubjects, setMSubjects] = useState<SubjectOption[]>([]);
    const [mChapters, setMChapters] = useState<ChapterOption[]>([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [order, setOrder] = useState(0);
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            setClasses(Array.isArray(d) ? d : (d.classes || []));
        }).catch(() => { });
    }, []);

    // Filter cascade: Class + Exam Type → Subject
    useEffect(() => {
        setSubjects([]); setFSubject(""); setChapters([]); setFChapter("");
        if (!fClass || !fExam) return;
        apiClient.get(`/api/v1/subjects/?class_id=${fClass}&exam_type=${fExam}`).then(r => {
            const d = r.data;
            setSubjects(Array.isArray(d) ? d : (d.subjects || []));
        }).catch(() => { });
    }, [fClass, fExam]);

    useEffect(() => {
        if (!fSubject) { setChapters([]); setFChapter(""); return; }
        apiClient.get(`/api/v1/chapters/?subject_id=${fSubject}`).then(r => {
            const d = r.data;
            setChapters(Array.isArray(d) ? d : (d.chapters || []));
            setFChapter("");
        }).catch(() => { });
    }, [fSubject]);

    const loadTreasures = useCallback(() => {
        setLoading(true);
        getTreasures({ class_id: fClass || undefined, subject_id: fSubject || undefined, chapter_id: fChapter || undefined })
            .then(res => setTreasures(res.treasures || []))
            .catch(() => setTreasures([]))
            .finally(() => setLoading(false));
    }, [fClass, fSubject, fChapter]);

    useEffect(() => { loadTreasures(); }, [loadTreasures]);

    // Modal cascade: Class + Exam Type → Subject → Chapter
    useEffect(() => {
        setMSubjects([]); setMSubject(""); setMChapters([]); setMChapter("");
        if (!mClass || !mExam) return;
        apiClient.get(`/api/v1/subjects/?class_id=${mClass}&exam_type=${mExam}`).then(r => {
            const d = r.data;
            setMSubjects(Array.isArray(d) ? d : (d.subjects || []));
        }).catch(() => { });
    }, [mClass, mExam]);

    useEffect(() => {
        if (!mSubject) { setMChapters([]); setMChapter(""); return; }
        apiClient.get(`/api/v1/chapters/?subject_id=${mSubject}`).then(r => {
            const d = r.data;
            setMChapters(Array.isArray(d) ? d : (d.chapters || []));
            setMChapter("");
        }).catch(() => { });
    }, [mSubject]);

    const closeModal = () => {
        setOpen(false);
        setMClass(""); setMExam(""); setMSubject(""); setMChapter("");
        setTitle(""); setDescription(""); setOrder(0); setFile(null);
    };

    const handleUpload = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!mSubject || !mChapter) return toast.error("Select subject and chapter.");
        if (!file) return toast.error("Choose a mindmap image.");
        setSubmitting(true);
        try {
            await createTreasure({
                chapter_id: mChapter,
                subject_id: mSubject,
                mindmap_image: file,
                title: title || undefined,
                description: description || undefined,
                order,
            });
            toast.success("Treasure uploaded.");
            closeModal();
            loadTreasures();
        } catch (err: unknown) {
            toast.error(getApiError(err, "Failed to upload treasure."));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (t: Treasure) => {
        const ok = await confirmAction({
            title: "Delete treasure",
            description: "This removes the mindmap image permanently.",
            confirmText: "Delete",
            destructive: true,
        });
        if (!ok) return;
        try {
            await deleteTreasure(t.id);
            setTreasures(prev => prev.filter(x => x.id !== t.id));
            toast.success("Treasure deleted.");
        } catch (err: unknown) {
            toast.error(getApiError(err, "Failed to delete treasure."));
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Treasures (Mindmaps)</h1>
                        <p className="text-muted-foreground">Upload and manage chapter mindmap images for students.</p>
                    </div>
                    <button onClick={() => setOpen(true)}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer">
                        <Plus className="h-4 w-4" /> Upload Treasure
                    </button>
                </div>

                {/* Filters: Class + Exam Type → Subject → Chapter */}
                <div className="glass-card p-4 flex flex-wrap items-center gap-3">
                    <div className="w-40">
                        <CustomSelect value={fClass} onChange={v => { setFClass(v); setFExam(""); }}
                            placeholder="Class"
                            options={classes.map(c => ({ label: c.name, value: c.id }))} />
                    </div>
                    <div className="w-44">
                        <CustomSelect value={fExam} onChange={setFExam} placeholder="Exam type"
                            options={EXAM_TYPE_OPTIONS} disabled={!fClass} />
                    </div>
                    <div className="w-48">
                        <CustomSelect value={fSubject} onChange={setFSubject} placeholder="Subject"
                            options={subjects.map(s => ({ label: s.subject_type, value: s.id }))} disabled={!subjects.length} />
                    </div>
                    <div className="w-52">
                        <CustomSelect value={fChapter} onChange={setFChapter} placeholder="Chapter"
                            options={chapters.map(c => ({ label: c.name, value: c.id }))} disabled={!chapters.length} />
                    </div>
                    <button onClick={loadTreasures}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : treasures.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <Map className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No Treasures Found</h3>
                        <p className="text-muted-foreground mt-1 text-sm">Select class and exam type to filter, or upload a mindmap.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {treasures.map(t => (
                            <div key={t.id} className="glass-card overflow-hidden flex flex-col group">
                                <div className="relative aspect-video bg-foreground/5">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={t.image_url} alt={t.title || "mindmap"} className="w-full h-full object-cover" />
                                    <button onClick={() => handleDelete(t)}
                                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 text-muted-foreground hover:text-destructive transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-foreground line-clamp-1">{t.title || "Untitled mindmap"}</h3>
                                    {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                                    <p className="text-[10px] text-muted-foreground mt-2 font-mono">Order {t.order}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Upload Treasure</h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className="space-y-4">
                            {/* Row 1: Class + Exam Type */}
                            <div className="grid grid-cols-2 gap-3">
                                <CustomSelect value={mClass} onChange={v => { setMClass(v); setMExam(""); }}
                                    placeholder="Class"
                                    options={classes.map(c => ({ label: c.name, value: c.id }))} />
                                <CustomSelect value={mExam} onChange={setMExam} placeholder="Exam type"
                                    options={EXAM_TYPE_OPTIONS} disabled={!mClass} />
                            </div>
                            {/* Row 2: Subject + Chapter */}
                            <div className="grid grid-cols-2 gap-3">
                                <CustomSelect value={mSubject} onChange={setMSubject} placeholder="Subject"
                                    options={mSubjects.map(s => ({ label: s.subject_type, value: s.id }))} disabled={!mSubjects.length} />
                                <CustomSelect value={mChapter} onChange={setMChapter} placeholder="Chapter"
                                    options={mChapters.map(c => ({ label: c.name, value: c.id }))} disabled={!mChapters.length} />
                            </div>
                            <div><label className="block text-xs font-medium text-foreground mb-1">Title</label>
                                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="Optional" /></div>
                            <div><label className="block text-xs font-medium text-foreground mb-1">Description</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none resize-none h-16"
                                    placeholder="Optional" /></div>
                            <div className="grid grid-cols-3 gap-3 items-end">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-foreground mb-1">Mindmap Image *</label>
                                    <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)}
                                        className="w-full text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-brand-500/10 file:text-brand-600 file:text-xs file:font-medium file:px-2 file:py-1.5" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Order</label>
                                    <input type="number" min={0} value={order} onChange={e => setOrder(Number(e.target.value))}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                                </div>
                            </div>
                            {file && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <ImageIcon className="h-3.5 w-3.5" /> {file.name}
                                </div>
                            )}
                            <div className="flex justify-end gap-3 mt-2">
                                <button type="button" onClick={closeModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" disabled={submitting}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-20 cursor-pointer disabled:opacity-60">
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
