"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { MessageSquare, Check, Search, Reply, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import "katex/dist/katex.min.css";
import Latex from "react-latex";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/datetime";

interface Doubt {
    id: string;
    user_id: string;
    title?: string;
    content: string;
    is_solved: boolean;
    created_at: string;
}

interface Comment {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
}

export default function CommunityPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("PENDING");
    const getStatus = (d: Doubt) => d.is_solved ? "RESOLVED" : "PENDING";
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
    const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
    const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

    const { data, isLoading: loading, mutate } = useSWR<Doubt[]>(
        "/api/v1/doubt-forum/posts",
        (url: string) => apiClient.get(url).then(r => r.data.posts || r.data).catch(() => [])
    );
    const doubts = data || [];

    // Fetch user names for all doubt authors
    useEffect(() => {
        if (!doubts.length) return;
        const ids = [...new Set(doubts.map(d => d.user_id))].filter(id => !usersMap[id]);
        if (!ids.length) return;
        Promise.all(
            ids.map(id =>
                apiClient.get(`/api/v1/users/${id}`)
                    .then(r => ({ id, name: r.data.name || r.data.user_name || id }))
                    .catch(() => ({ id, name: id.slice(0, 8) + "…" }))
            )
        ).then(results => {
            setUsersMap(prev => {
                const next = { ...prev };
                results.forEach(({ id, name }) => { next[id] = name; });
                return next;
            });
        });
    }, [doubts]);

    const fetchComments = async (doubtId: string) => {
        if (commentsMap[doubtId] !== undefined) {
            setExpandedComments(prev => ({ ...prev, [doubtId]: !prev[doubtId] }));
            return;
        }
        setLoadingComments(prev => ({ ...prev, [doubtId]: true }));
        try {
            const res = await apiClient.get(`/api/v1/doubt-forum/posts/${doubtId}/comments`);
            const comments: Comment[] = res.data.comments || res.data || [];
            setCommentsMap(prev => ({ ...prev, [doubtId]: comments }));
            setExpandedComments(prev => ({ ...prev, [doubtId]: true }));

            // Fetch names for comment authors not already in usersMap
            const newIds = [...new Set(comments.map(c => c.user_id))].filter(id => !usersMap[id]);
            if (newIds.length) {
                Promise.all(
                    newIds.map(id =>
                        apiClient.get(`/api/v1/users/${id}`)
                            .then(r => ({ id, name: r.data.name || r.data.user_name || id }))
                            .catch(() => ({ id, name: id.slice(0, 8) + "…" }))
                    )
                ).then(results => {
                    setUsersMap(prev => {
                        const next = { ...prev };
                        results.forEach(({ id, name }) => { next[id] = name; });
                        return next;
                    });
                });
            }
        } catch {
            toast.error("Failed to load replies.");
        } finally {
            setLoadingComments(prev => ({ ...prev, [doubtId]: false }));
        }
    };

    const handleReply = async (doubtId: string) => {
        if (!replyContent.trim()) return;
        setIsSubmittingReply(true);
        try {
            const res = await apiClient.post(`/api/v1/doubt-forum/comments`, {
                post_id: doubtId,
                content: replyContent,
            });
            const newComment: Comment = res.data ?? {
                id: `new-${Date.now()}`,
                user_id: "admin",
                content: replyContent,
                created_at: new Date().toISOString(),
            };
            setCommentsMap(prev => ({
                ...prev,
                [doubtId]: [...(prev[doubtId] || []), newComment],
            }));
            setExpandedComments(prev => ({ ...prev, [doubtId]: true }));
            setReplyingTo(null);
            setReplyContent("");
            toast.success("Reply submitted.");
        } catch {
            toast.error("Failed to submit reply.");
        } finally {
            setIsSubmittingReply(false);
        }
    };

    const handleStatusChange = async (doubtId: string) => {
        try {
            await apiClient.patch(`/api/v1/doubt-forum/posts/${doubtId}/solve`);
            mutate(doubts.map(d => d.id === doubtId ? { ...d, is_solved: true } : d), false);
            toast.success("Doubt marked as resolved.");
        } catch {
            toast.error("Failed to mark doubt as resolved.");
        }
    };

    const filteredDoubts = doubts.filter(d => {
        const matchesSearch =
            d.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.title ?? "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === "ALL" || getStatus(d) === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const getInitial = (userId: string) => {
        const name = usersMap[userId];
        return name ? name.charAt(0).toUpperCase() : "?";
    };

    return (
        <>
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Doubt Forum</h1>
                        <p className="text-muted-foreground">Moderate student discussions, answer questions, and clear doubts.</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="glass-card p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input type="text" placeholder="Search doubts..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background border border-(--input) rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                        {["ALL", "PENDING", "RESOLVED"].map((status) => (
                            <button key={status} onClick={() => setFilterStatus(status)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer
                                    ${filterStatus === status
                                        ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                                        : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                                    }`}>
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Doubts List */}
                <div className="flex flex-col gap-4">
                    {loading ? (
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="glass-card p-5 flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <Skeleton className="h-10 w-10 rounded-full" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-32 rounded" />
                                                <Skeleton className="h-3 w-24 rounded" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-6 w-20 rounded-full" />
                                    </div>
                                    <Skeleton className="h-16 w-full rounded-xl" />
                                </div>
                            ))}
                        </div>
                    ) : filteredDoubts.length === 0 ? (
                        <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
                            <div className="h-16 w-16 bg-foreground/5 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">No Doubts Found</h3>
                            <p className="text-muted-foreground mt-2">The forum is clear matching your current filters.</p>
                        </div>
                    ) : (
                        filteredDoubts.map((doubt) => (
                            <div key={doubt.id} className="glass-card flex flex-col p-5 group transition-all">
                                {/* Author row */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold border border-brand-500/20 shrink-0">
                                            {getInitial(doubt.user_id)}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground text-sm">
                                                {usersMap[doubt.user_id] ?? <span className="text-muted-foreground italic">Loading…</span>}
                                            </h4>
                                            <p className="text-xs text-muted-foreground">{formatDateTime(doubt.created_at)}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ml-2
                                        ${!doubt.is_solved
                                            ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                                            : "bg-green-500/10 text-green-600 dark:text-green-500"}`}>
                                        {doubt.is_solved ? "RESOLVED" : "PENDING"}
                                    </span>
                                </div>

                                {/* Title */}
                                {doubt.title && (
                                    <h3 className="font-semibold text-foreground mb-2">{doubt.title}</h3>
                                )}

                                {/* Content */}
                                <div className="prose prose-invert max-w-none text-foreground text-sm mb-4 bg-foreground/5 p-4 rounded-xl border border-(--panel-border)">
                                    <Latex>{doubt.content}</Latex>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap items-center justify-between gap-3 mt-auto">
                                    <div className="flex items-center gap-2">
                                        {!doubt.is_solved && (
                                            <button onClick={() => handleStatusChange(doubt.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-500 hover:bg-green-500/20 rounded-lg text-xs font-medium transition-colors border border-transparent hover:border-green-500/20 cursor-pointer">
                                                <Check className="h-3.5 w-3.5" /> Mark Resolved
                                            </button>
                                        )}
                                        <button
                                            onClick={() => fetchComments(doubt.id)}
                                            disabled={loadingComments[doubt.id]}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-muted-foreground rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-60">
                                            {loadingComments[doubt.id]
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : expandedComments[doubt.id]
                                                    ? <ChevronUp className="h-3.5 w-3.5" />
                                                    : <ChevronDown className="h-3.5 w-3.5" />
                                            }
                                            {expandedComments[doubt.id] ? "Hide Replies" : "View Replies"}
                                            {commentsMap[doubt.id]?.length
                                                ? ` (${commentsMap[doubt.id].length})`
                                                : ""}
                                        </button>
                                    </div>
                                    <button onClick={() => {
                                        setReplyingTo(replyingTo === doubt.id ? null : doubt.id);
                                        setReplyContent("");
                                    }}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${replyingTo === doubt.id
                                            ? "bg-foreground/10 text-foreground border border-(--card-border)"
                                            : "bg-brand-600 hover:bg-brand-500 text-white shadow-sm"
                                            }`}>
                                        <Reply className="h-4 w-4" />
                                        {replyingTo === doubt.id ? "Cancel Reply" : "Reply to student"}
                                    </button>
                                </div>

                                {/* Existing Comments */}
                                {expandedComments[doubt.id] && commentsMap[doubt.id] !== undefined && (
                                    <div className="mt-4 flex flex-col gap-3">
                                        {commentsMap[doubt.id].length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-3">No replies yet.</p>
                                        ) : (
                                            commentsMap[doubt.id].map(comment => (
                                                <div key={comment.id} className="flex gap-3 p-3 bg-foreground/5 rounded-xl border border-(--panel-border)">
                                                    <div className="h-7 w-7 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 text-xs font-bold border border-brand-500/20 shrink-0">
                                                        {getInitial(comment.user_id)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-semibold text-foreground">
                                                                {usersMap[comment.user_id] ?? comment.user_id.slice(0, 8) + "…"}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatDateTime(comment.created_at)}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-foreground/90">
                                                            <Latex>{comment.content}</Latex>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Reply Composer */}
                                {replyingTo === doubt.id && (
                                    <div className="mt-4 p-4 bg-foreground/5 rounded-xl border border-(--card-border) animate-in slide-in-from-top-2">
                                        <label className="block text-xs font-medium text-muted-foreground mb-2">
                                            Admin Reply (LaTeX supported)
                                        </label>
                                        <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)}
                                            className="w-full bg-background border border-(--input) rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-25 resize-none mb-3"
                                            placeholder="Type your explanation here. Use $ for inline math..." />
                                        <div className="flex justify-end pr-1">
                                            <button onClick={() => handleReply(doubt.id)}
                                                disabled={!replyContent.trim() || isSubmittingReply}
                                                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                                {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Response"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
