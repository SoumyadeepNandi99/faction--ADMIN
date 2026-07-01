"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Users, Youtube, Award, Megaphone, ExternalLink,
    User as UserIcon, Search, X, UserPlus, Check, Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { Batch } from "@/lib/batches";
import { getApiError } from "@/lib/utils";

interface UserItem {
    id: string;
    name: string;
    phone_number: string;
    email?: string | null;
    batch_id?: string | null;
    subscription_type?: "free" | "premium";
    is_active: boolean;
}

interface VideoItem {
    id: string;
    title?: string | null;
    youtube_url: string;
    youtube_video_id?: string | null;
    thumbnail_url?: string | null;
    duration_seconds?: number | null;
    batch_id?: string | null;
    chapter_id: string;
    is_active?: boolean;
}

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

export default function BatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const batchId = params.batchId as string;
    const [userSearch, setUserSearch] = useState("");

    // Assign students modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [browseSearch, setBrowseSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAssigning, setBulkAssigning] = useState(false);

    const { data: batch, isLoading: batchLoading, error: batchError } = useSWR<Batch>(
        batchId ? `/api/v1/batches/${batchId}` : null,
        (url: string) => apiClient.get(url).then(r => r.data)
    );

    const { data: usersData, isLoading: usersLoading, mutate: mutateUsers } = useSWR<UserItem[]>(
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

    const allUsers = usersData || [];
    const allVideos = videosData || [];

    const batchUsers = allUsers.filter(u => u.batch_id === batchId);
    const batchVideos = allVideos.filter(v => v.batch_id === batchId);

    const filteredUsers = batchUsers.filter(u =>
        !userSearch ||
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone_number?.includes(userSearch) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );

    const loading = batchLoading || usersLoading || videosLoading;

    // Users NOT in this batch (for browse modal)
    const usersNotInBatch = allUsers.filter(u => u.batch_id !== batchId).filter(u =>
        !browseSearch ||
        u.name?.toLowerCase().includes(browseSearch.toLowerCase()) ||
        u.phone_number?.includes(browseSearch)
    );

    const assignToBatch = async (userId: string, userName: string): Promise<boolean> => {
        try {
            await apiClient.patch(`/api/v1/users/${userId}`, { batch_id: batchId });
            mutateUsers(
                (cur) => (cur || []).map(u => u.id === userId ? { ...u, batch_id: batchId } : u),
                false
            );
            toast.success(`${userName} added to ${batch?.batch_name ?? batchId}`);
            return true;
        } catch (err: any) {
            toast.error(getApiError(err, `Failed to assign ${userName}.`));
            return false;
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleBulkAssign = async () => {
        if (selectedIds.size === 0) return;
        setBulkAssigning(true);
        let successCount = 0;
        for (const id of Array.from(selectedIds)) {
            const user = allUsers.find(u => u.id === id);
            if (!user) continue;
            const ok = await assignToBatch(id, user.name);
            if (ok) successCount++;
        }
        setSelectedIds(new Set());
        setBulkAssigning(false);
        if (successCount > 0) toast.success(`${successCount} student${successCount !== 1 ? "s" : ""} assigned.`);
    };

    const closeModal = () => {
        setShowAssignModal(false);
        setBrowseSearch("");
        setSelectedIds(new Set());
    };

    if (batchLoading) {
        return (
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48 rounded" />
                        <Skeleton className="h-4 w-24 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (batchError || !batch) {
        return (
            <div className="flex flex-col gap-4 max-w-5xl mx-auto">
                <button
                    onClick={() => router.push("/batches")}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Batches
                </button>
                <div className="glass-card p-12 text-center flex flex-col items-center">
                    <h3 className="text-lg font-bold text-foreground">Batch Not Found</h3>
                    <p className="text-muted-foreground mt-1 text-sm">Could not load batch details. It may have been deleted.</p>
                </div>
            </div>
        );
    }

    const batchName = batch.batch_name;

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push("/batches")}
                    className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-colors border border-(--card-border) cursor-pointer"
                >
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{batchName}</h1>
                    <p className="text-sm text-muted-foreground">
                        {batch.target_exam} · Batch overview
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-5 flex items-center gap-4">
                    <div className="p-3 bg-brand-500/10 rounded-xl"><Users className="h-5 w-5 text-brand-500" /></div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Students</p>
                        {(usersLoading) ? <Skeleton className="h-7 w-12 rounded mt-1" /> : <p className="text-2xl font-bold text-foreground">{batchUsers.length}</p>}
                    </div>
                </div>
                <div className="glass-card p-5 flex items-center gap-4">
                    <div className="p-3 bg-brand-500/10 rounded-xl"><Youtube className="h-5 w-5 text-brand-500" /></div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Videos</p>
                        {(videosLoading) ? <Skeleton className="h-7 w-12 rounded mt-1" /> : <p className="text-2xl font-bold text-foreground">{batchVideos.length}</p>}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowAssignModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-xl text-sm font-medium transition-colors border border-brand-500/20 cursor-pointer"
                    >
                        <UserPlus className="h-4 w-4" /> Assign Students
                    </button>
                    <Link
                        href={`/videos?batch=${batchId}`}
                        className="flex items-center gap-2 px-4 py-2 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-xl text-sm font-medium transition-colors border border-(--card-border)"
                    >
                        <Youtube className="h-4 w-4" /> Manage Videos
                    </Link>
                    <Link
                        href="/assessments"
                        className="flex items-center gap-2 px-4 py-2 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-xl text-sm font-medium transition-colors border border-(--card-border)"
                    >
                        <Award className="h-4 w-4" /> Create Test
                    </Link>
                    <Link
                        href="/broadcasts"
                        className="flex items-center gap-2 px-4 py-2 bg-foreground/5 hover:bg-foreground/10 text-foreground rounded-xl text-sm font-medium transition-colors border border-(--card-border)"
                    >
                        <Megaphone className="h-4 w-4" /> Send Broadcast
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Students */}
                <div className="glass-card overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-(--card-border) flex items-center justify-between gap-3 flex-wrap">
                        <h2 className="font-semibold text-foreground">Students</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowAssignModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-lg text-xs font-medium transition-colors border border-brand-500/20 cursor-pointer"
                            >
                                <UserPlus className="h-3.5 w-3.5" /> Add
                            </button>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search…"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    className="bg-background border border-(--input) rounded-lg pl-7 pr-7 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                                />
                                {userSearch && (
                                    <button onClick={() => setUserSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer">
                                        <X className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-96">
                        {usersLoading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3">
                                        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                                        <div className="space-y-1.5 flex-1">
                                            <Skeleton className="h-3.5 w-32 rounded" />
                                            <Skeleton className="h-3 w-24 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-8 text-center">
                                <UserIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    {userSearch ? "No matching students." : "No students in this batch."}
                                </p>
                                {!userSearch && (
                                    <button
                                        onClick={() => setShowAssignModal(true)}
                                        className="mt-3 text-xs text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer"
                                    >
                                        + Assign Students
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y divide-(--border)">
                                {filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => router.push(`/users/${user.id}`)}
                                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-foreground/3 transition-colors cursor-pointer text-left"
                                    >
                                        <div className="h-9 w-9 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm border border-brand-500/20 shrink-0">
                                            {user.name?.charAt(0) || "U"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{user.phone_number}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {user.subscription_type === "premium" && (
                                                <span className="text-xs bg-accent-purple/10 text-accent-purple px-1.5 py-0.5 rounded font-medium">Premium</span>
                                            )}
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${user.is_active ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                                                {user.is_active ? "Active" : "Suspended"}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Videos */}
                <div className="glass-card overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-(--card-border)">
                        <h2 className="font-semibold text-foreground">Videos</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-96">
                        {videosLoading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3">
                                        <Skeleton className="h-14 w-20 rounded-lg shrink-0" />
                                        <div className="space-y-1.5 flex-1">
                                            <Skeleton className="h-3.5 w-40 rounded" />
                                            <Skeleton className="h-3 w-20 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : batchVideos.length === 0 ? (
                            <div className="p-8 text-center">
                                <Youtube className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">No videos in this batch.</p>
                                <Link
                                    href={`/videos?batch=${batchId}`}
                                    className="mt-3 inline-block text-xs text-brand-500 hover:text-brand-400 font-medium transition-colors"
                                >
                                    + Add Videos
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-(--border)">
                                {batchVideos.map(video => {
                                    const thumb = ytThumb(video);
                                    return (
                                        <div key={video.id} className="flex items-center gap-3 px-5 py-3">
                                            <div className="h-14 w-20 rounded-lg bg-muted/30 overflow-hidden shrink-0">
                                                {thumb ? (
                                                    <img src={thumb} alt={video.title || "Video"} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Youtube className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground line-clamp-2">{video.title || video.youtube_url}</p>
                                                {video.duration_seconds && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">{formatDuration(video.duration_seconds)}</p>
                                                )}
                                            </div>
                                            <a
                                                href={video.youtube_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Assign Students Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-(--card-border) shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Assign Students</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Add students to <span className="font-medium text-brand-500">{batchName}</span>
                                </p>
                            </div>
                            <button onClick={closeModal} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Browse users */}
                        <div className="px-6 py-3 border-b border-(--card-border) flex items-center justify-between gap-3 shrink-0 flex-wrap">
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search users…"
                                    value={browseSearch}
                                    onChange={e => setBrowseSearch(e.target.value)}
                                    className="w-full bg-background border border-(--input) rounded-lg pl-8 pr-4 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                            </div>
                            <button
                                onClick={handleBulkAssign}
                                disabled={selectedIds.size === 0 || bulkAssigning}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                            >
                                {bulkAssigning
                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Assigning…</>
                                    : <><Check className="h-3.5 w-3.5" /> Add Selected ({selectedIds.size})</>
                                }
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {usersNotInBatch.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    {browseSearch ? "No matching users." : "All users are already in this batch."}
                                </p>
                            ) : (
                                <div className="divide-y divide-(--border)">
                                    {usersNotInBatch.map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => toggleSelect(user.id)}
                                            className="w-full flex items-center gap-3 px-6 py-3 hover:bg-foreground/3 transition-colors cursor-pointer text-left"
                                        >
                                            <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selectedIds.has(user.id) ? "bg-brand-500 border-brand-500" : "border-(--input) bg-background"}`}>
                                                {selectedIds.has(user.id) && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm border border-brand-500/20 shrink-0">
                                                {user.name?.charAt(0) || "U"}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">{user.phone_number}</p>
                                            </div>
                                            {user.batch_id && (
                                                <span className="text-xs bg-brand-500/10 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded shrink-0">In batch</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
