"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { FileText, Plus, Loader2, X, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { confirmAction } from "@/components/ui/confirm-modal";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { getNotes, uploadNote, deleteNote, type Note } from "@/lib/api/notes";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; subject_type: string; class_id: string; }
interface ChapterOption { id: string; name: string; subject_id: string; }

export default function NotesPage() {
    const [classes, setClasses] = useState<ClassOption[]>([]);

    // Page-level filters: Class + Exam Type → Subject → Chapter
    const [classId, setClassId] = useState("");
    const [examType, setExamType] = useState("");
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [chapters, setChapters] = useState<ChapterOption[]>([]);
    const [fSubject, setFSubject] = useState("");
    const [fChapter, setFChapter] = useState("");
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);

    // Upload modal
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [mSubject, setMSubject] = useState("");
    const [mChapter, setMChapter] = useState("");
    const [mChapters, setMChapters] = useState<ChapterOption[]>([]);
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            const list = Array.isArray(d) ? d : (d.classes || []);
            setClasses(list);
        }).catch(() => { });
    }, []);

    // Subjects for selected class + exam type drive both filter bar and upload modal
    useEffect(() => {
        setSubjects([]); setFSubject(""); setFChapter(""); setChapters([]);
        if (!classId || !examType) return;
        apiClient.get(`/api/v1/subjects/?class_id=${classId}&exam_type=${examType}`).then(r => {
            const d = r.data;
            setSubjects(Array.isArray(d) ? d : (d.subjects || []));
        }).catch(() => { });
    }, [classId, examType]);

    useEffect(() => {
        if (!fSubject) { setChapters([]); setFChapter(""); return; }
        apiClient.get(`/api/v1/chapters/?subject_id=${fSubject}`).then(r => {
            const d = r.data;
            setChapters(Array.isArray(d) ? d : (d.chapters || []));
            setFChapter("");
        }).catch(() => { });
    }, [fSubject]);

    const loadNotes = useCallback(() => {
        if (!classId) { setNotes([]); return; }
        setLoading(true);
        getNotes({ class_id: classId, subject_id: fSubject || undefined, chapter_id: fChapter || undefined })
            .then(res => setNotes(res.notes || []))
            .catch(() => setNotes([]))
            .finally(() => setLoading(false));
    }, [classId, fSubject, fChapter]);

    useEffect(() => { loadNotes(); }, [loadNotes]);

    // Modal chapter cascade (subject list shared with filter bar)
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
        setMSubject(""); setMChapter(""); setFile(null);
    };

    const handleUpload = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!mSubject || !mChapter) return toast.error("Select subject and chapter.");
        if (!file) return toast.error("Choose a PDF file.");
        if (file.type !== "application/pdf") return toast.error("File must be a PDF.");
        setSubmitting(true);
        try {
            await uploadNote({ chapter_id: mChapter, subject_id: mSubject, pdf_file: file });
            toast.success("Note uploaded.");
            closeModal();
            loadNotes();
        } catch (err: unknown) {
            toast.error(getApiError(err, "Failed to upload note."));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (n: Note) => {
        const ok = await confirmAction({
            title: "Delete note",
            description: `Remove "${n.file_name}" permanently?`,
            confirmText: "Delete",
            destructive: true,
        });
        if (!ok) return;
        try {
            await deleteNote(n.id);
            setNotes(prev => prev.filter(x => x.id !== n.id));
            toast.success("Note deleted.");
        } catch (err: unknown) {
            toast.error(getApiError(err, "Failed to delete note."));
        }
    };

    return (
        <>
            <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Notes (PDFs)</h1>
                        <p className="text-muted-foreground">Upload and manage chapter-wise PDF notes per class and exam.</p>
                    </div>
                    <button onClick={() => setOpen(true)} disabled={!classId || !examType}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50">
                        <Plus className="h-4 w-4" /> Upload Note
                    </button>
                </div>

                {/* Filters: Class + Exam Type → Subject → Chapter */}
                <div className="glass-card p-4 flex flex-wrap items-center gap-3">
                    <div className="w-40">
                        <CustomSelect value={classId} onChange={v => { setClassId(v); setExamType(""); }}
                            placeholder="Class"
                            options={classes.map(c => ({ label: c.name, value: c.id }))} />
                    </div>
                    <div className="w-44">
                        <CustomSelect value={examType} onChange={setExamType} placeholder="Exam type"
                            options={EXAM_TYPE_OPTIONS} disabled={!classId} />
                    </div>
                    <div className="w-48">
                        <CustomSelect value={fSubject} onChange={setFSubject} placeholder="Subject"
                            options={subjects.map(s => ({ label: s.subject_type, value: s.id }))} disabled={!subjects.length} />
                    </div>
                    <div className="w-52">
                        <CustomSelect value={fChapter} onChange={setFChapter} placeholder="Chapter"
                            options={chapters.map(c => ({ label: c.name, value: c.id }))} disabled={!chapters.length} />
                    </div>
                    <button onClick={loadNotes}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : notes.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No Notes Found</h3>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {!classId || !examType ? "Select class and exam type to browse notes." : "Upload a PDF to get started."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {notes.map(n => (
                            <div key={n.id} className="glass-card p-4 flex items-start gap-3 group">
                                <div className="p-2.5 bg-brand-500/10 rounded-lg shrink-0">
                                    <FileText className="h-5 w-5 text-brand-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-foreground text-sm line-clamp-2 break-words">{n.file_name}</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <a href={n.web_view_link} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors">
                                            <ExternalLink className="h-3.5 w-3.5" /> View
                                        </a>
                                        <button onClick={() => handleDelete(n)}
                                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                                            <Trash2 className="h-3.5 w-3.5" /> Delete
                                        </button>
                                    </div>
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
                            <h2 className="text-xl font-bold text-foreground">Upload Note</h2>
                            <button type="button" onClick={closeModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                            Uploading to: <span className="font-medium text-foreground">
                                {classes.find(c => c.id === classId)?.name} · {EXAM_TYPE_OPTIONS.find(e => e.value === examType)?.label}
                            </span>
                        </p>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <CustomSelect value={mSubject} onChange={setMSubject} placeholder="Subject"
                                    options={subjects.map(s => ({ label: s.subject_type, value: s.id }))} disabled={!subjects.length} />
                                <CustomSelect value={mChapter} onChange={setMChapter} placeholder="Chapter"
                                    options={mChapters.map(c => ({ label: c.name, value: c.id }))} disabled={!mChapters.length} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">PDF File *</label>
                                <input type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-brand-500/10 file:text-brand-600 file:text-xs file:font-medium file:px-2 file:py-1.5" />
                                {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
                            </div>
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
