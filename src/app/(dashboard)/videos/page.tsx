"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";
import { Youtube, Plus, Trash2, Loader2, ExternalLink, Filter, X, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { CustomMultiSelect } from "@/components/ui/custom-multi-select";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";
import { Batch } from "@/lib/batches";
import { getApiError } from "@/lib/utils";
import { formatDate } from "@/lib/datetime";

interface VideoItem {
    id: string;
    youtube_url: string;
    youtube_video_id?: string | null;
    title?: string | null;
    description?: string | null;
    thumbnail_url?: string | null;
    duration_seconds?: number | null;
    views_count?: number;
    order?: number;
    available_to?: string;
    batch_id?: string | null;
    chapter_id: string;
    subject_id: string;
    is_active?: boolean;
    created_at?: string;
}

interface ClassOption { id: string; name: string; }
interface SubjectOption { id: string; subject_type: string; class_id?: string; }
interface ChapterOption { id: string; name: string; subject_id?: string; }

function formatDuration(seconds?: number | null): string {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function ytThumb(video: VideoItem): string | null {
    if (video.thumbnail_url) return video.thumbnail_url;
    const ytId = video.youtube_video_id;
    return ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
}

const EMPTY_FORM = { youtube_url: "", order: 0, available_to: "free", batch_id: "" };

// Subjects are scoped by class + a single exam_type, so to support multiple
// exam tracks we fetch one request per selected exam and merge the results,
// de-duped by subject id.
async function fetchSubjectsForExams(classId: string, examTypes: string[]): Promise<SubjectOption[]> {
    const lists = await Promise.all(
        examTypes.map(examType =>
            apiClient.get(`/api/v1/subjects/?class_id=${classId}&exam_type=${examType}`)
                .then(r => { const d = r.data; return (Array.isArray(d) ? d : (d.subjects || [])) as SubjectOption[]; })
                .catch(() => [] as SubjectOption[])
        )
    );
    const merged = new Map<string, SubjectOption>();
    lists.flat().forEach(s => { if (!merged.has(s.id)) merged.set(s.id, s); });
    return Array.from(merged.values());
}

// Union of subjects across every (class × exam) combination, de-duped by id.
async function fetchSubjectsForClassesExams(classIds: string[], examTypes: string[]): Promise<SubjectOption[]> {
    const lists = await Promise.all(classIds.map(classId => fetchSubjectsForExams(classId, examTypes)));
    const merged = new Map<string, SubjectOption>();
    lists.flat().forEach(s => { if (!merged.has(s.id)) merged.set(s.id, s); });
    return Array.from(merged.values());
}

// Union of chapters across the selected subjects, de-duped by id. Each chapter
// keeps its subject_id so a video can be created with the right subject.
async function fetchChaptersForSubjects(subjectIds: string[]): Promise<ChapterOption[]> {
    const lists = await Promise.all(
        subjectIds.map(subjectId =>
            apiClient.get(`/api/v1/chapters/?subject_id=${subjectId}`)
                .then(r => {
                    const d = r.data;
                    const arr = (Array.isArray(d) ? d : (d.chapters || [])) as ChapterOption[];
                    return arr.map(c => ({ ...c, subject_id: c.subject_id ?? subjectId }));
                })
                .catch(() => [] as ChapterOption[])
        )
    );
    const merged = new Map<string, ChapterOption>();
    lists.flat().forEach(c => { if (!merged.has(c.id)) merged.set(c.id, c); });
    return Array.from(merged.values());
}

export default function VideosPage() {
    const searchParams = useSearchParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    // Edit state
    const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
    const [editForm, setEditForm] = useState({ order: 0, available_to: "free", chapter_id: "", subject_id: "", batch_id: "" });
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);

    // Shared class list (used by every class+exam → subject cascade)
    const [classes, setClasses] = useState<ClassOption[]>([]);

    // Filter bar cascade: Class + Exam Type(s) → Subject → Chapter
    const [filterClassId, setFilterClassId] = useState("");
    const [filterExamTypes, setFilterExamTypes] = useState<string[]>([]);
    const [filterSubjects, setFilterSubjects] = useState<SubjectOption[]>([]);
    const [filterChapters, setFilterChapters] = useState<ChapterOption[]>([]);
    const [filterSubjectId, setFilterSubjectId] = useState("");
    const [filterChapterId, setFilterChapterId] = useState("");
    const [filterBatch, setFilterBatch] = useState(() => searchParams.get("batch") ?? "");

    // Add modal cascade: Class(es) + Exam Type(s) → Subject(s) → Chapter(s).
    // Every level is multi-select: the subject list is the union across the
    // selected classes × exams, the chapter list is the union across the selected
    // subjects, and on submit the video is created once per selected chapter.
    const [modalClassIds, setModalClassIds] = useState<string[]>([]);
    const [modalExamTypes, setModalExamTypes] = useState<string[]>([]);
    const [modalSubjects, setModalSubjects] = useState<SubjectOption[]>([]);
    const [modalSubjectIds, setModalSubjectIds] = useState<string[]>([]);
    const [modalChapters, setModalChapters] = useState<ChapterOption[]>([]);
    const [modalChapterIds, setModalChapterIds] = useState<string[]>([]);
    const [isLoadingChapters, setIsLoadingChapters] = useState(false);

    // Edit modal cascade: Class + Exam Type(s) → Subject → Chapter
    const [editClassId, setEditClassId] = useState("");
    const [editExamTypes, setEditExamTypes] = useState<string[]>([]);
    const [editModalSubjects, setEditModalSubjects] = useState<SubjectOption[]>([]);
    const [editModalChapters, setEditModalChapters] = useState<ChapterOption[]>([]);
    const [isLoadingEditChapters, setIsLoadingEditChapters] = useState(false);

    // SWR for batches list
    const { data: batchesData } = useSWR<Batch[]>("/api/v1/batches/", (url: string) =>
        apiClient.get(url).then(r => { const d = r.data; return Array.isArray(d) ? d : (d.batches || []); })
    );
    const batches: Batch[] = batchesData || [];

    // Load class list once (drives all class+exam → subject cascades)
    useEffect(() => {
        apiClient.get("/api/v1/class/").then(r => {
            const d = r.data;
            setClasses(Array.isArray(d) ? d : (d.classes || []));
        }).catch(() => { });
    }, []);

    // Filter bar: subjects scoped by class + exam(s) (reset downstream on change)
    useEffect(() => {
        setFilterSubjects([]); setFilterSubjectId(""); setFilterChapters([]); setFilterChapterId("");
        if (!filterClassId || filterExamTypes.length === 0) return;
        let cancelled = false;
        fetchSubjectsForExams(filterClassId, filterExamTypes).then(subs => { if (!cancelled) setFilterSubjects(subs); });
        return () => { cancelled = true; };
    }, [filterClassId, filterExamTypes]);

    // Filter bar: chapters scoped by selected subject
    useEffect(() => {
        setFilterChapters([]); setFilterChapterId("");
        if (!filterSubjectId) return;
        apiClient.get(`/api/v1/chapters/?subject_id=${filterSubjectId}`).then(r => {
            const d = r.data;
            setFilterChapters(Array.isArray(d) ? d : (d.chapters || []));
        }).catch(() => { });
    }, [filterSubjectId]);

    // Add modal: subjects scoped by class(es) + exam(s) (reset downstream on change)
    useEffect(() => {
        setModalSubjects([]); setModalSubjectIds([]); setModalChapters([]); setModalChapterIds([]);
        if (modalClassIds.length === 0 || modalExamTypes.length === 0) return;
        let cancelled = false;
        fetchSubjectsForClassesExams(modalClassIds, modalExamTypes).then(subs => { if (!cancelled) setModalSubjects(subs); });
        return () => { cancelled = true; };
    }, [modalClassIds, modalExamTypes]);

    // Add modal: chapters scoped by the selected subject(s) (reset downstream on change)
    useEffect(() => {
        setModalChapters([]); setModalChapterIds([]);
        if (modalSubjectIds.length === 0) return;
        let cancelled = false;
        setIsLoadingChapters(true);
        fetchChaptersForSubjects(modalSubjectIds)
            .then(chs => { if (!cancelled) setModalChapters(chs); })
            .finally(() => { if (!cancelled) setIsLoadingChapters(false); });
        return () => { cancelled = true; };
    }, [modalSubjectIds]);

    // Edit modal: subjects scoped by class + exam(s) (reset downstream on change)
    useEffect(() => {
        setEditModalSubjects([]); setEditModalChapters([]);
        setEditForm(f => ({ ...f, subject_id: "", chapter_id: "" }));
        if (!editClassId || editExamTypes.length === 0) return;
        let cancelled = false;
        fetchSubjectsForExams(editClassId, editExamTypes).then(subs => { if (!cancelled) setEditModalSubjects(subs); });
        return () => { cancelled = true; };
    }, [editClassId, editExamTypes]);

    // SWR for videos with filters
    const videoParams = new URLSearchParams();
    if (filterSubjectId) videoParams.set("subject_id", filterSubjectId);
    if (filterChapterId) videoParams.set("chapter_id", filterChapterId);
    const videoParamStr = videoParams.toString() ? `?${videoParams.toString()}` : "";

    const { data: videosData, isLoading: loading, error: videosError, mutate } = useSWR<VideoItem[]>(
        `/api/v1/youtube-videos/${videoParamStr}`,
        (url: string) => apiClient.get(url).then(r => { const d = r.data; return Array.isArray(d) ? d : (d.videos || []); })
    );
    const videos = videosData || [];

    // Edit modal uses a single subject, so it loads that subject's chapters directly.
    // (The Add modal's multi-subject chapter list is handled by the effect above.)
    const fetchEditChaptersForSubject = async (subjectId: string) => {
        if (!subjectId) { setEditModalChapters([]); return; }
        setIsLoadingEditChapters(true);
        try {
            const res = await apiClient.get(`/api/v1/chapters/`, { params: { subject_id: subjectId } });
            const data = res.data;
            setEditModalChapters(Array.isArray(data) ? data : (data.chapters || []));
        } catch {
            setEditModalChapters([]);
        } finally {
            setIsLoadingEditChapters(false);
        }
    };

    const resetAddModal = () => {
        setIsModalOpen(false);
        setForm(EMPTY_FORM);
        setModalClassIds([]); setModalExamTypes([]);
        setModalSubjects([]); setModalSubjectIds([]);
        setModalChapters([]); setModalChapterIds([]);
    };

    const handleCreate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Create one video per selected chapter; each chapter carries its subject.
        const targets = modalChapterIds
            .map(id => modalChapters.find(c => c.id === id))
            .filter((c): c is ChapterOption => !!c && !!c.subject_id);
        if (!form.youtube_url || targets.length === 0) return;
        setIsSubmitting(true);
        try {
            const results = await Promise.allSettled(
                targets.map(ch => apiClient.post("/api/v1/youtube-videos/", {
                    youtube_url: form.youtube_url,
                    chapter_id: ch.id,
                    subject_id: ch.subject_id,
                    order: form.order,
                    available_to: form.available_to,
                    batch_id: form.batch_id || null,
                }))
            );
            const created = results.flatMap(r => r.status === "fulfilled" ? [r.value.data] : []);
            const failed = results.length - created.length;

            // Insert any created videos that match the active filters into the cache.
            const matching = created.filter(v =>
                (!filterSubjectId || v.subject_id === filterSubjectId) &&
                (!filterChapterId || v.chapter_id === filterChapterId)
            );
            if (matching.length) mutate(cur => [...matching, ...(cur || [])], false);

            if (created.length > 0) resetAddModal();

            if (created.length > 0 && failed > 0) {
                toast.warning(`Added to ${created.length} chapter${created.length > 1 ? "s" : ""}; ${failed} failed.`);
            } else if (created.length > 0) {
                toast.success(created.length === 1 ? "Video added successfully." : `Video added to ${created.length} chapters.`);
            } else {
                toast.error("Failed to add video.");
            }
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to add video."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEdit = async (video: VideoItem) => {
        setEditingVideo(video);
        setEditClassId(""); setEditExamTypes([]); setEditModalSubjects([]);
        setEditForm({ order: video.order ?? 0, available_to: video.available_to ?? "free", chapter_id: video.chapter_id, subject_id: video.subject_id, batch_id: video.batch_id ?? "" });
        // Preload the existing subject's chapters so the current chapter is selectable
        // until the user re-picks class + exam to change the subject.
        await fetchEditChaptersForSubject(video.subject_id);
    };

    const handleEdit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingVideo) return;
        setIsEditSubmitting(true);
        try {
            const res = await apiClient.put(`/api/v1/youtube-videos/${editingVideo.id}`, {
                order: editForm.order,
                available_to: editForm.available_to,
                chapter_id: editForm.chapter_id,
                subject_id: editForm.subject_id,
                batch_id: editForm.batch_id || null,
            });
            mutate(cur => (cur || []).map(v => v.id === editingVideo.id ? { ...v, ...res.data } : v), false);
            setEditingVideo(null);
            setEditClassId(""); setEditExamTypes([]); setEditModalSubjects([]); setEditModalChapters([]);
            toast.success("Video updated.");
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to update video."));
        } finally {
            setIsEditSubmitting(false);
        }
    };

    // Fix #3: toggle is_active
    const handleToggleActive = async (video: VideoItem) => {
        const next = !video.is_active;
        try {
            const res = await apiClient.put(`/api/v1/youtube-videos/${video.id}`, { is_active: next });
            mutate(cur => (cur || []).map(v => v.id === video.id ? { ...v, ...res.data } : v), false);
            toast.success(next ? "Video activated." : "Video deactivated.");
        } catch {
            toast.error("Failed to update status.");
        }
    };

    const handleDelete = async (id: string) => {
        // Fix #8: destructive flag
        if (!(await confirmAction({ title: "Delete Video", description: "Remove this video? This action cannot be undone.", destructive: true }))) return;
        try {
            await apiClient.delete(`/api/v1/youtube-videos/${id}`);
            // Fix #4: use updater fn
            mutate(cur => (cur || []).filter(v => v.id !== id), false);
            toast.success("Video removed.");
        } catch {
            toast.error("Failed to delete video.");
        }
    };

    const clearFilters = () => {
        setFilterClassId("");
        setFilterExamTypes([]);
        setFilterSubjectId("");
        setFilterChapterId("");
        setFilterBatch("");
    };

    // Client-side batch filter
    const filteredVideos = filterBatch ? videos.filter(v => v.batch_id === filterBatch) : videos;

    // When the Add modal spans multiple classes/subjects, the same subject_type
    // or chapter name can appear more than once — prefix the labels so each
    // option is unambiguous.
    const subjectOptionLabel = (s: SubjectOption) => {
        if (modalClassIds.length <= 1) return s.subject_type;
        const cls = classes.find(c => c.id === s.class_id)?.name;
        return cls ? `${cls} · ${s.subject_type}` : s.subject_type;
    };
    const chapterOptionLabel = (c: ChapterOption) => {
        if (modalSubjectIds.length <= 1) return c.name;
        const subj = modalSubjects.find(s => s.id === c.subject_id);
        if (!subj) return c.name;
        const cls = modalClassIds.length > 1 ? classes.find(cl => cl.id === subj.class_id)?.name : undefined;
        return cls ? `${cls} · ${subj.subject_type} · ${c.name}` : `${subj.subject_type} · ${c.name}`;
    };

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">YouTube Videos</h1>
                        <p className="text-muted-foreground">Manage video lecture content linked to curriculum chapters.</p>
                    </div>
                    <button onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">
                        <Plus className="h-4 w-4" /> Add Video
                    </button>
                </div>

                {/* Subject + Chapter + Batch filters */}
                <div className="glass-card p-4 flex flex-wrap items-center gap-3">
                    <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                    {/* Batch filter */}
                    <div className="w-44">
                        <CustomSelect
                            value={filterBatch}
                            onChange={setFilterBatch}
                            placeholder="All Batches"
                            options={[{ label: "All Batches", value: "" }, ...batches.map(b => ({ label: b.batch_name, value: b.id }))]}
                        />
                    </div>
                    {/* Class + Exam Type scope the subject list (subjects are unique per class+exam) */}
                    <div className="w-40">
                        <CustomSelect
                            value={filterClassId}
                            onChange={(val) => { setFilterClassId(val); setFilterExamTypes([]); }}
                            placeholder="Class"
                            options={classes.map(c => ({ label: c.name, value: c.id }))}
                        />
                    </div>
                    <div className="w-44">
                        <CustomMultiSelect
                            value={filterExamTypes}
                            onChange={setFilterExamTypes}
                            placeholder="Exam type(s)"
                            options={EXAM_TYPE_OPTIONS}
                            disabled={!filterClassId}
                        />
                    </div>
                    <div className="w-52">
                        <CustomSelect
                            value={filterSubjectId}
                            onChange={setFilterSubjectId}
                            placeholder={
                                !filterClassId || filterExamTypes.length === 0 ? "Select class & exam" :
                                filterSubjects.length === 0 ? "No subjects" :
                                "All Subjects"
                            }
                            options={[{ label: "All Subjects", value: "" }, ...filterSubjects.map(s => ({ label: s.subject_type, value: s.id }))]}
                            disabled={!filterClassId || filterExamTypes.length === 0 || filterSubjects.length === 0}
                        />
                    </div>
                    <div className="w-52">
                        <CustomSelect
                            value={filterChapterId}
                            onChange={setFilterChapterId}
                            placeholder={
                                !filterSubjectId ? "Select a subject first" :
                                filterChapters.length === 0 ? "No chapters" :
                                "All Chapters"
                            }
                            options={[{ label: "All Chapters", value: "" }, ...filterChapters.map(c => ({ label: c.name, value: c.id }))]}
                            disabled={!filterSubjectId || filterChapters.length === 0}
                        />
                    </div>
                    {(filterClassId || filterExamTypes.length > 0 || filterSubjectId || filterChapterId || filterBatch) && (
                        <button onClick={clearFilters}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
                            <X className="h-3.5 w-3.5" /> Clear
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="glass-card overflow-hidden">
                                <Skeleton className="h-44 w-full rounded-none" />
                                <div className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                            </div>
                        ))}
                    </div>
                ) : videosError ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <Youtube className="h-10 w-10 text-destructive/50 mb-4" />
                        <h3 className="text-lg font-bold text-foreground">Failed to Load Videos</h3>
                        <p className="text-muted-foreground mt-1 text-sm">Could not fetch videos from the server. Please try again.</p>
                        <button onClick={() => mutate()} className="mt-4 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">Retry</button>
                    </div>
                ) : filteredVideos.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center">
                        <Youtube className="h-10 w-10 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">No Videos Found</h3>
                        <p className="text-muted-foreground mt-1 text-sm">{filterBatch ? `No videos for batch "${batches.find(b => b.id === filterBatch)?.batch_name ?? filterBatch}".` : "Add YouTube video lectures linked to your curriculum chapters."}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredVideos.map(video => {
                            const thumb = ytThumb(video);
                            return (
                                <div key={video.id} className="glass-card overflow-hidden group flex flex-col">
                                    <div className="relative h-44 bg-muted/30 overflow-hidden">
                                        {thumb ? (
                                            <img src={thumb} alt={video.title || "Video"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center"><Youtube className="h-10 w-10 text-muted-foreground" /></div>
                                        )}
                                        {video.duration_seconds && (
                                            <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                                                {formatDuration(video.duration_seconds)}
                                            </span>
                                        )}
                                        {/* Fix #7: order badge */}
                                        {video.order !== undefined && (
                                            <span className="absolute top-2 left-2 bg-black/70 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                                                #{video.order}
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-black/30 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                            <a href={video.youtube_url} target="_blank" rel="noopener noreferrer"
                                                className="bg-white/90 text-black p-2 rounded-full hover:bg-white transition-colors"><ExternalLink className="h-4 w-4" /></a>
                                            {/* Fix #2: edit button */}
                                            <button onClick={() => openEdit(video)}
                                                className="bg-white/90 text-black p-2 rounded-full hover:bg-white transition-colors cursor-pointer"><Pencil className="h-4 w-4" /></button>
                                            <button onClick={() => handleDelete(video.id)}
                                                className="bg-red-500/90 text-white p-2 rounded-full hover:bg-red-500 transition-colors cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                    <div className="p-4 flex flex-col flex-1">
                                        <h3 className="font-semibold text-foreground text-sm line-clamp-2 mb-1">{video.title || video.youtube_url}</h3>
                                        {video.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{video.description}</p>}
                                        <div className="mt-auto pt-3 flex items-center justify-between border-t border-(--panel-border)">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {video.views_count !== undefined && <span className="text-xs text-muted-foreground">{video.views_count} views</span>}
                                                {video.available_to === "premium" && <span className="text-xs bg-accent-purple/10 text-accent-purple px-1.5 py-0.5 rounded font-medium">Premium</span>}
                                                {video.batch_id && <span className="text-xs bg-brand-500/10 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded font-medium">{batches.find(b => b.id === video.batch_id)?.batch_name ?? video.batch_id}</span>}
                                                {/* Fix #3: active/inactive badge + toggle */}
                                                <button
                                                    onClick={() => handleToggleActive(video)}
                                                    title={video.is_active ? "Active — click to deactivate" : "Inactive — click to activate"}
                                                    className="flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                    {video.is_active !== false ? (
                                                        <>
                                                            <ToggleRight className="h-4 w-4 text-green-500" />
                                                            <span className="text-xs text-green-500 font-medium">Active</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground font-medium">Inactive</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            {video.created_at && <span className="text-xs text-muted-foreground">{formatDate(video.created_at)}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Video Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Add YouTube Video</h2>
                            <button type="button"
                                onClick={resetAddModal}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">YouTube URL *</label>
                                <input type="url" required value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
                                    className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="https://youtube.com/watch?v=..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Class(es) *</label>
                                    <CustomMultiSelect value={modalClassIds} onChange={setModalClassIds}
                                        placeholder="Select class(es)"
                                        options={classes.map(c => ({ label: c.name, value: c.id }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Exam Type *</label>
                                    <CustomMultiSelect value={modalExamTypes} onChange={setModalExamTypes}
                                        placeholder="Exam type(s)"
                                        options={EXAM_TYPE_OPTIONS}
                                        disabled={modalClassIds.length === 0} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Subject(s) *</label>
                                <CustomMultiSelect value={modalSubjectIds} onChange={setModalSubjectIds}
                                    placeholder={
                                        modalClassIds.length === 0 || modalExamTypes.length === 0 ? "Select class & exam first" :
                                        modalSubjects.length === 0 ? "No subjects available" :
                                        "Select subject(s)"
                                    }
                                    options={modalSubjects.map(s => ({ label: subjectOptionLabel(s), value: s.id }))}
                                    disabled={modalClassIds.length === 0 || modalExamTypes.length === 0 || modalSubjects.length === 0} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Chapter(s) *</label>
                                <CustomMultiSelect value={modalChapterIds} onChange={setModalChapterIds}
                                    placeholder={
                                        modalSubjectIds.length === 0 ? "Select a subject first" :
                                        isLoadingChapters ? "Loading chapters…" :
                                        modalChapters.length === 0 ? "No chapters available" :
                                        "Select chapter(s)"
                                    }
                                    options={modalChapters.map(c => ({ label: chapterOptionLabel(c), value: c.id }))}
                                    disabled={modalSubjectIds.length === 0 || isLoadingChapters || modalChapters.length === 0} />
                                {modalChapterIds.length > 1 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        This video will be added to {modalChapterIds.length} chapters (one record each).
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Display Order</label>
                                    <input type="number" min="0" value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Access</label>
                                    <CustomSelect value={form.available_to} onChange={(val) => setForm(f => ({ ...f, available_to: val }))}
                                        options={[{ label: "Free", value: "free" }, { label: "Premium", value: "premium" }]} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Batch (optional)</label>
                                <CustomSelect
                                    value={form.batch_id}
                                    onChange={(val) => setForm(f => ({ ...f, batch_id: val }))}
                                    placeholder="No batch"
                                    options={[{ label: "No batch", value: "" }, ...batches.map(b => ({ label: b.batch_name, value: b.id }))]}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={resetAddModal}
                                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isSubmitting || modalChapterIds.length === 0}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-20 cursor-pointer disabled:opacity-60">
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Video"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Fix #2: Edit Video Modal */}
            {editingVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Edit Video</h2>
                            <button type="button"
                                onClick={() => { setEditingVideo(null); setEditClassId(""); setEditExamTypes([]); setEditModalSubjects([]); setEditModalChapters([]); }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {editingVideo.title && (
                            <p className="text-xs text-muted-foreground mb-4 line-clamp-1">{editingVideo.title}</p>
                        )}
                        <form onSubmit={handleEdit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Class</label>
                                    <CustomSelect value={editClassId} onChange={(val) => { setEditClassId(val); setEditExamTypes([]); }}
                                        placeholder="Select Class"
                                        options={classes.map(c => ({ label: c.name, value: c.id }))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Exam Type</label>
                                    <CustomMultiSelect value={editExamTypes} onChange={setEditExamTypes}
                                        placeholder="Exam type(s)"
                                        options={EXAM_TYPE_OPTIONS}
                                        disabled={!editClassId} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Subject</label>
                                <CustomSelect
                                    value={editForm.subject_id}
                                    onChange={(val) => { setEditForm(f => ({ ...f, subject_id: val, chapter_id: "" })); fetchEditChaptersForSubject(val); }}
                                    placeholder={
                                        !editClassId || editExamTypes.length === 0 ? "Pick class & exam to change subject" :
                                        editModalSubjects.length === 0 ? "No subjects available" :
                                        "Select Subject"
                                    }
                                    options={editModalSubjects.map(s => ({ label: s.subject_type, value: s.id }))}
                                    disabled={!editClassId || editExamTypes.length === 0 || editModalSubjects.length === 0}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Chapter</label>
                                <CustomSelect
                                    value={editForm.chapter_id}
                                    onChange={(val) => setEditForm(f => ({ ...f, chapter_id: val }))}
                                    placeholder={
                                        !editForm.subject_id ? "Select a subject first" :
                                        isLoadingEditChapters ? "Loading chapters…" :
                                        editModalChapters.length === 0 ? "No chapters available" :
                                        "Select Chapter"
                                    }
                                    options={editModalChapters.map(c => ({ label: c.name, value: c.id }))}
                                    disabled={!editForm.subject_id || isLoadingEditChapters || editModalChapters.length === 0}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Display Order</label>
                                    <input type="number" min="0" value={editForm.order} onChange={e => setEditForm(f => ({ ...f, order: Number(e.target.value) }))}
                                        className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Access</label>
                                    <CustomSelect value={editForm.available_to} onChange={(val) => setEditForm(f => ({ ...f, available_to: val }))}
                                        options={[{ label: "Free", value: "free" }, { label: "Premium", value: "premium" }]} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Batch (optional)</label>
                                <CustomSelect
                                    value={editForm.batch_id}
                                    onChange={(val) => setEditForm(f => ({ ...f, batch_id: val }))}
                                    placeholder="No batch"
                                    options={[{ label: "No batch", value: "" }, ...batches.map(b => ({ label: b.batch_name, value: b.id }))]}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => { setEditingVideo(null); setEditClassId(""); setEditExamTypes([]); setEditModalSubjects([]); setEditModalChapters([]); }}
                                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isEditSubmitting}
                                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-w-20 cursor-pointer disabled:opacity-60">
                                    {isEditSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
