"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/axios";
import { Megaphone, Send, Users, History, Loader2, Check, Bell, Trash2, Search, Target, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { confirmAction } from "@/components/ui/confirm-modal";
import { formatDateTime } from "@/lib/datetime";
import { fetchSegments, resolveSegment, AnalyticsFetchError } from "@/lib/api/analytics";

interface NotificationItem {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
}

const TYPE_STYLES: Record<string, string> = {
    announcement: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
    info:         "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    system:       "bg-slate-500/10 text-slate-500 dark:text-slate-400",
    achievement:  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const TYPE_LABEL: Record<string, string> = {
    announcement: "Announcement",
    info:         "Info",
    system:       "System",
    achievement:  "Achievement",
};

const MESSAGE_MAX = 300;

export default function BroadcastsPage() {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [type, setType] = useState("announcement");
    const [isSending, setIsSending] = useState(false);
    const [sentCount, setSentCount] = useState(0);

    // Target: broadcast to everyone, an audience segment, or specific users.
    const [targetMode, setTargetMode] = useState<"all" | "segment" | "specific">("all");
    const [selectedSegment, setSelectedSegment] = useState<string>("");
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    // Remember display info (name/phone) of selected users so their chips stay
    // visible even after they scroll out of the current (server-side) search.
    const [selectedInfo, setSelectedInfo] = useState<Record<string, { name?: string; phone_number?: string }>>({});
    const [userSearch, setUserSearch] = useState("");
    const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setDebouncedUserSearch(userSearch.trim()), 350);
        return () => clearTimeout(t);
    }, [userSearch]);

    // Fetch users only when picking specific recipients, and search SERVER-side
    // (q param) so the picker finds ANY user, not just the first page loaded.
    const pickerUrl = useMemo(() => {
        if (targetMode !== "specific") return null;
        const p = new URLSearchParams();
        p.set("limit", "50");
        if (debouncedUserSearch) p.set("q", debouncedUserSearch);
        return `/api/v1/users/?${p.toString()}`;
    }, [targetMode, debouncedUserSearch]);
    const { data: usersData } = useSWR<any>(
        pickerUrl,
        (url: string) => apiClient.get(url).then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : (d.users || []);
        })
    );
    const pickableUsers: { id: string; name?: string; phone_number?: string }[] = usersData || [];

    // Segment catalogue (loaded once) + the resolved audience for the current pick.
    const { data: segments } = useSWR("analytics:segments", fetchSegments, { revalidateOnFocus: false });
    const {
        data: resolvedSegment,
        error: segmentError,
        isLoading: segmentLoading,
    } = useSWR(
        targetMode === "segment" && selectedSegment ? `analytics:segment:${selectedSegment}` : null,
        () => resolveSegment(selectedSegment),
        { revalidateOnFocus: false, shouldRetryOnError: false },
    );
    const segmentErrText =
        segmentError instanceof AnalyticsFetchError
            ? segmentError.code === "not_configured"
                ? "Segment targeting needs the analytics DB connection (ANALYTICS_DATABASE_URL). It isn't configured on the server yet."
                : segmentError.detail || "Couldn't resolve this segment."
            : segmentError
              ? "Couldn't resolve this segment."
              : null;

    const [historySearch, setHistorySearch] = useState("");
    const [historyTypeFilter, setHistoryTypeFilter] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data, isLoading: loading, mutate } = useSWR<NotificationItem[]>(
        "/api/v1/notifications/?limit=50&skip=0",
        (url: string) => apiClient.get(url).then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : (d.notifications || []);
        })
    );
    const history = data || [];

    const filteredHistory = useMemo(() => {
        return history.filter(item => {
            const matchesSearch =
                item.title.toLowerCase().includes(historySearch.toLowerCase()) ||
                item.message.toLowerCase().includes(historySearch.toLowerCase());
            const matchesType = !historyTypeFilter || item.type === historyTypeFilter;
            return matchesSearch && matchesType;
        });
    }, [history, historySearch, historyTypeFilter]);

    const handleSend = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        const specific = targetMode === "specific";
        const segmentMode = targetMode === "segment";

        // Resolve the recipient list up front for the id-based paths.
        let recipientIds: string[] = [];
        if (specific) {
            recipientIds = selectedUserIds;
            if (recipientIds.length === 0) {
                toast.error("Select at least one user.");
                return;
            }
        } else if (segmentMode) {
            if (!selectedSegment) {
                toast.error("Pick a segment first.");
                return;
            }
            recipientIds = resolvedSegment?.userIds ?? [];
            if (segmentLoading) {
                toast.error("Still counting the segment — try again in a moment.");
                return;
            }
            if (recipientIds.length === 0) {
                toast.error("This segment currently has no students — nothing to send.");
                return;
            }
        }

        const segLabel = segments?.find(s => s.key === selectedSegment)?.label ?? "segment";
        const confirmMsg = specific
            ? `Send push notification to ${recipientIds.length} selected user${recipientIds.length > 1 ? "s" : ""}?`
            : segmentMode
              ? `Send push notification to ${recipientIds.length} student${recipientIds.length > 1 ? "s" : ""} in "${segLabel}"?`
              : `Send push notification to ALL users?`;
        if (!(await confirmAction({ title: "Confirm Action", description: confirmMsg, destructive: recipientIds.length > 100 || !specific && !segmentMode }))) return;

        setIsSending(true);
        try {
            let res: any;
            if (specific || segmentMode) {
                // Both id-based paths use the existing individual-send endpoint.
                res = await apiClient.post("/api/v1/notifications/admin/send", {
                    user_ids: recipientIds,
                    title,
                    message: content,
                    type,
                });
            } else {
                res = await apiClient.post("/api/v1/notifications/admin/broadcast", {
                    title,
                    message: content,
                    type,
                });
            }
            setSentCount(s => s + 1);
            mutate([{
                id: res.data?.id ?? `new-${Date.now()}`,
                user_id: res.data?.user_id ?? "admin",
                title,
                message: content,
                type,
                is_read: false,
                created_at: res.data?.created_at ?? new Date().toISOString(),
            }, ...history], false);
            setTitle("");
            setContent("");
            setType("announcement");
            setSelectedUserIds([]);
            setSelectedInfo({});
            setUserSearch("");
            toast.success(
                segmentMode
                    ? `Sent to ${recipientIds.length} student${recipientIds.length > 1 ? "s" : ""} in "${segLabel}".`
                    : specific
                      ? "Notification sent to selected users."
                      : "Broadcast sent successfully.",
            );
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to send notification."));
        } finally {
            setIsSending(false);
        }
    };

    const toggleUser = (u: { id: string; name?: string; phone_number?: string }) => {
        setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id]);
        setSelectedInfo(prev => {
            const next = { ...prev };
            if (prev[u.id]) delete next[u.id];
            else next[u.id] = { name: u.name, phone_number: u.phone_number };
            return next;
        });
    };

    const handleDelete = async (id: string) => {
        if (!(await confirmAction({ title: "Delete Notification", description: "Remove this notification from history?" }))) return;
        setDeletingId(id);
        try {
            await apiClient.delete(`/api/v1/notifications/${id}`);
            mutate(history.filter(n => n.id !== id), false);
            toast.success("Notification deleted.");
        } catch {
            toast.error("Failed to delete notification.");
        } finally {
            setDeletingId(null);
        }
    };

    const typeBadge = (t: string) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLES[t] ?? "bg-foreground/10 text-muted-foreground"}`}>
            {TYPE_LABEL[t] ?? t}
        </span>
    );

    return (
        <>
            <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full lg:h-full">

                {/* Left: Composer — sticks to top, doesn't stretch */}
                <div className="w-full lg:w-5/12 flex flex-col gap-6 lg:self-start lg:sticky lg:top-0">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Broadcast Center</h1>
                        <p className="text-muted-foreground text-sm">Send real-time push notifications to all student devices.</p>
                    </div>

                    <div className="glass-card p-6 border-brand-500/30 relative overflow-hidden">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-6 relative z-10">
                            <Megaphone className="h-5 w-5 text-brand-500" /> New Announcement
                        </h2>
                        <form onSubmit={handleSend} className="space-y-5 relative z-10">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Notification Title *</label>
                                <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-foreground/5 border border-(--input) rounded-xl px-3 py-2.5 text-foreground focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    placeholder="E.g. New Mock Test Available" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-medium text-foreground">Message Body *</label>
                                    <span className={`text-xs ${content.length > MESSAGE_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                                        {content.length} / {MESSAGE_MAX}
                                    </span>
                                </div>
                                <textarea required value={content} onChange={e => setContent(e.target.value)}
                                    className="w-full bg-foreground/5 border border-(--input) rounded-xl px-3 py-2.5 text-foreground focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none h-32"
                                    placeholder="Enter the notification message..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Notification Type *</label>
                                <CustomSelect
                                    value={type}
                                    onChange={setType}
                                    options={[
                                        { label: "Announcement", value: "announcement" },
                                        { label: "Info", value: "info" },
                                        { label: "System", value: "system" },
                                    ]}
                                />
                            </div>
                            {/* Recipients: all users, an audience segment, or specific users. */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Send To *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button type="button" onClick={() => setTargetMode("all")}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${targetMode === "all" ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30" : "bg-foreground/5 text-muted-foreground border-(--input) hover:text-foreground"}`}>
                                        <Users className="h-4 w-4" /> All
                                    </button>
                                    <button type="button" onClick={() => setTargetMode("segment")}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${targetMode === "segment" ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30" : "bg-foreground/5 text-muted-foreground border-(--input) hover:text-foreground"}`}>
                                        <Target className="h-4 w-4" /> Segment
                                    </button>
                                    <button type="button" onClick={() => setTargetMode("specific")}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${targetMode === "specific" ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30" : "bg-foreground/5 text-muted-foreground border-(--input) hover:text-foreground"}`}>
                                        <Bell className="h-4 w-4" /> Specific
                                    </button>
                                </div>
                            </div>

                            {targetMode === "segment" && (
                                <div className="rounded-xl border border-(--input) bg-foreground/5 p-3 space-y-3">
                                    <CustomSelect
                                        value={selectedSegment}
                                        onChange={setSelectedSegment}
                                        placeholder="Choose an audience segment…"
                                        options={(segments ?? []).map(s => ({ label: s.label, value: s.key }))}
                                    />
                                    {selectedSegment && (
                                        <p className="text-xs text-muted-foreground">
                                            {segments?.find(s => s.key === selectedSegment)?.description}
                                        </p>
                                    )}
                                    {/* Live audience count for the chosen segment. */}
                                    {selectedSegment && (
                                        segmentErrText ? (
                                            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                                <span>{segmentErrText}</span>
                                            </div>
                                        ) : segmentLoading ? (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Counting students…
                                            </div>
                                        ) : resolvedSegment ? (
                                            <div className="flex items-center gap-2 rounded-lg bg-brand-500/10 border border-brand-500/20 px-3 py-2">
                                                <Target className="h-4 w-4 text-brand-500 shrink-0" />
                                                <span className="text-sm text-foreground">
                                                    <span className="font-bold">{resolvedSegment.count.toLocaleString()}</span>{" "}
                                                    student{resolvedSegment.count === 1 ? "" : "s"} match this segment right now.
                                                </span>
                                            </div>
                                        ) : null
                                    )}
                                    <p className="text-[11px] text-muted-foreground/80">
                                        Segments are computed live from platform activity (IST). Sends via the same push channel as specific users.
                                    </p>
                                </div>
                            )}

                            {targetMode === "specific" && (
                                <div className="rounded-xl border border-(--input) bg-foreground/5 p-3 space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <input type="text" placeholder="Search users by name or mobile…"
                                            value={userSearch} onChange={e => setUserSearch(e.target.value)}
                                            className="w-full bg-background border border-(--input) rounded-lg pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all" />
                                    </div>
                                    {/* Selected chips — persist across searches so you don't lose picks. */}
                                    {selectedUserIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedUserIds.map(id => {
                                                const info = selectedInfo[id];
                                                return (
                                                    <span key={id} className="inline-flex items-center gap-1 bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs px-2 py-1 rounded-full">
                                                        {info?.name || info?.phone_number || "User"}
                                                        <button type="button" onClick={() => toggleUser({ id, ...info })}
                                                            className="hover:text-destructive cursor-pointer" title="Remove">×</button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <div className="max-h-44 overflow-y-auto flex flex-col gap-1">
                                        {pickableUsers.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-2 text-center">
                                                {debouncedUserSearch ? "No users found." : "Search to find users…"}
                                            </p>
                                        ) : pickableUsers.map(u => {
                                            const checked = selectedUserIds.includes(u.id);
                                            return (
                                                <button type="button" key={u.id} onClick={() => toggleUser(u)}
                                                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors cursor-pointer ${checked ? "bg-brand-500/10" : "hover:bg-foreground/5"}`}>
                                                    <span className="truncate">
                                                        <span className="text-foreground">{u.name || "Unknown"}</span>
                                                        <span className="text-muted-foreground text-xs ml-2">{u.phone_number}</span>
                                                    </span>
                                                    {checked && <Check className="h-4 w-4 text-brand-500 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <button type="submit" disabled={
                                    isSending || !title.trim() || !content.trim() || content.length > MESSAGE_MAX ||
                                    (targetMode === "specific" && selectedUserIds.length === 0) ||
                                    (targetMode === "segment" && (!selectedSegment || segmentLoading || !!segmentErrText || (resolvedSegment?.count ?? 0) === 0))
                                }
                                className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white py-3 rounded-xl font-medium transition-all shadow-md shadow-brand-500/20 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer">
                                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4" />Dispatch Notification</>}
                            </button>
                            {sentCount > 0 && (
                                <p className="text-center text-sm text-green-500 flex items-center justify-center gap-1.5">
                                    <Check className="h-4 w-4" /> {sentCount} broadcast{sentCount > 1 ? "s" : ""} sent this session
                                </p>
                            )}
                        </form>
                    </div>
                </div>

                {/* Right: History — fills remaining height, list scrolls internally */}
                <div className="w-full lg:w-7/12 flex flex-col min-h-0">
                    <div className="glass-card p-6 flex flex-col flex-1 min-h-0">
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4 shrink-0">
                            <History className="h-5 w-5 text-muted-foreground" /> Notification History
                        </h2>

                        {/* History filters */}
                        <div className="flex gap-3 mb-5 shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search history…"
                                    value={historySearch}
                                    onChange={e => setHistorySearch(e.target.value)}
                                    className="w-full bg-foreground/5 border border-(--input) rounded-lg pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                />
                            </div>
                            <div className="w-40 shrink-0">
                                <CustomSelect
                                    value={historyTypeFilter}
                                    onChange={setHistoryTypeFilter}
                                    placeholder="All Types"
                                    options={[
                                        { label: "All Types", value: "" },
                                        { label: "Announcement", value: "announcement" },
                                        { label: "Info", value: "info" },
                                        { label: "System", value: "system" },
                                    ]}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="p-4 bg-foreground/5 rounded-xl border border-(--panel-border) space-y-3">
                                        <div className="flex justify-between"><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-24" /></div>
                                        <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredHistory.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center flex-col text-center min-h-0">
                                <Bell className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                                <p className="text-muted-foreground">
                                    {history.length === 0 ? "No notifications sent yet." : "No results match your filters."}
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pr-1">
                                {filteredHistory.map(item => (
                                    <div key={item.id} className="p-4 bg-foreground/5 rounded-xl border border-(--panel-border) group">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-foreground group-hover:text-brand-500 transition-colors pr-2">
                                                {item.title}
                                            </h3>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs font-mono bg-foreground/10 px-2 py-1 rounded text-muted-foreground">
                                                    {formatDateTime(item.created_at)}
                                                </span>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={deletingId === item.id}
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100">
                                                    {deletingId === item.id
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        : <Trash2 className="h-3.5 w-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-foreground/80 mb-3">{item.message}</p>
                                        <div className="flex items-center gap-2">
                                            {typeBadge(item.type)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
