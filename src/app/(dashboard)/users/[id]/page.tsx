"use client";

import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import React from "react";
import { ArrowLeft, User as UserIcon, Mail, Phone, Calendar, Award, Activity, RefreshCw, Layers, Loader2, Pencil, X, Check, GraduationCap, Trophy, Target, Flame, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";
import { CustomSelect } from "@/components/ui/custom-select";
import { Batch } from "@/lib/batches";
import { getApiError } from "@/lib/utils";
import { formatDate } from "@/lib/datetime";

interface UserDetail {
    phone_number: string;
    name: string;
    email?: string | null;
    role: "STUDENT" | "ADMIN";
    is_active: boolean;
    created_at: string;
    class_id?: string;
    batch_id?: string | null;
    target_exams?: string[];
    subscription_type?: "free" | "premium";
    current_rating?: number;
    max_rating?: number;
    title?: string | null;
}

interface ClassItem { id: string; name: string; }

interface StreakResponse {
    current_streak: number;
    longest_streak: number;
    streak_active?: boolean;
    next_milestone?: number;
    total_questions_solved: number;
    accuracy_rate: number;
}

interface RatingFluctuationEntry {
    contest_id: string;
    contest_name: string;
    rating_before: number;
    rating_after: number;
    rating_delta: number;
    rank: number;
    score: number;
    created_at: string;
}

interface RatingGraphResponse {
    user_id: string;
    total_contests: number;
    fluctuations: RatingFluctuationEntry[];
}

// accuracy_rate may arrive as a fraction (0–1) or a percentage (0–100).
const formatAccuracy = (rate?: number): string => {
    if (rate === undefined || rate === null) return "—";
    const pct = rate <= 1 ? rate * 100 : rate;
    return `${Math.round(pct * 10) / 10}%`;
};

export default function UserDetailPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;

    const { data: userData, error, isLoading: userLoading, mutate } = useSWR<UserDetail>(
        userId ? `/api/v1/users/${userId}` : null
    );
    // Activity data (each is independent; failures shouldn't block the page).
    const { data: streak } = useSWR<StreakResponse>(
        userId ? `/api/v1/streaks/${userId}` : null,
        { shouldRetryOnError: false, onError: () => {} }
    );
    const { data: ratingGraph } = useSWR<RatingGraphResponse>(
        userId ? `/api/v1/users/${userId}/rating/graph` : null,
        { shouldRetryOnError: false, onError: () => {} }
    );
    const { data: classesData } = useSWR("/api/v1/class/");
    const { data: batchesData } = useSWR<Batch[]>(
        "/api/v1/batches/",
        (url: string) => apiClient.get(url).then(r => { const d = r.data; return Array.isArray(d) ? d : (d.batches || []); })
    );
    const batches: Batch[] = batchesData || [];
    const classes: ClassItem[] = Array.isArray(classesData) ? classesData : (classesData?.classes || []);

    const loading = userLoading;
    const user: UserDetail | null = userData ?? null;
    const className = user?.class_id ? (classes.find(c => c.id === user.class_id)?.name ?? "—") : "—";
    const fluctuations = ratingGraph?.fluctuations ?? [];

    // Batch editing state
    const [editingBatch, setEditingBatch] = React.useState(false);
    const [batchValue, setBatchValue] = React.useState<string>("");
    const [savingBatch, setSavingBatch] = React.useState(false);

    const startEditBatch = () => {
        setBatchValue(user?.batch_id ?? "");
        setEditingBatch(true);
    };

    const handleSaveBatch = async () => {
        setSavingBatch(true);
        try {
            await apiClient.patch(`/api/v1/users/${userId}`, { batch_id: batchValue || null });
            await mutate();
            setEditingBatch(false);
            toast.success("Batch updated.");
        } catch (err: any) {
            toast.error(getApiError(err, "Failed to update batch."));
        } finally {
            setSavingBatch(false);
        }
    };

    const handleDelete = async () => {
        if (!user?.phone_number) {
            toast.error("User does not have a mobile number attached. Cannot delete via admin endpoint.");
            return;
        }

        if (await confirmAction({ title: "Delete User", description: `Permanently delete ${user.name}? This cannot be undone.`, destructive: true })) {
            try {
                const cleanPhone = user.phone_number.replace(/^\+91\s*/, '').replace(/\s/g, '');
                await apiClient.delete(`/api/v1/users/delete/${encodeURIComponent(cleanPhone)}`);
                toast.success("User deleted.");
                router.push("/users");
            } catch {
                toast.error("Deletion failed.");
            }
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto">
                {/* Header skeleton */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-9 w-9 rounded-xl" />
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-7 w-40 rounded" />
                            <Skeleton className="h-4 w-28 rounded" />
                        </div>
                    </div>
                    <Skeleton className="h-9 w-28 rounded-xl" />
                </div>
                {/* Grid skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 md:col-span-2">
                        <Skeleton className="h-5 w-44 rounded mb-6" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                                    <div className="flex flex-col gap-2 flex-1">
                                        <Skeleton className="h-3 w-20 rounded" />
                                        <Skeleton className="h-5 w-36 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="glass-card p-6 flex flex-col gap-4">
                        <Skeleton className="h-5 w-32 rounded" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 text-destructive/50" />
                <h3 className="text-lg font-bold text-foreground">Failed to Load User</h3>
                <p className="text-muted-foreground text-sm">Could not fetch user data from the server.</p>
                <button onClick={() => mutate()}
                    className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                    Retry
                </button>
            </div>
        );
    }

    if (!user) return <div className="text-muted-foreground p-6">User not found.</div>;

    return (
        <>
            <div className="flex flex-col gap-6 max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/users"
                            className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-xl transition-colors border border-(--card-border)"
                        >
                            <ArrowLeft className="h-5 w-5 text-foreground" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">{user.name}</h1>
                            <p className="text-sm text-muted-foreground">
                                {user.phone_number}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl text-sm font-medium transition-colors border border-destructive/20 cursor-pointer"
                        >
                            Delete User
                        </button>
                    </div>
                </div>

                {/* Profile Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Main Info Card */}
                    <div className="glass-card p-6 md:col-span-2">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Profile Information</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <InfoItem icon={<UserIcon />} label="Full Name" value={user.name} />
                            <InfoItem icon={<Mail />} label="Email Address" value={user.email || "No Email"} />
                            <InfoItem icon={<Phone />} label="Mobile Number" value={user.phone_number} />
                            <InfoItem icon={<Calendar />} label="Joined" value={formatDate(user.created_at)} />
                            <InfoItem icon={<GraduationCap />} label="Class" value={className} />
                        </div>
                    </div>

                    {/* Account Card */}
                    <div className="glass-card p-6 flex flex-col gap-4">
                        <h2 className="text-lg font-semibold text-foreground">Account</h2>

                        <div className="flex items-center gap-4 p-4 rounded-xl bg-foreground/5 border border-(--card-border)">
                            <div className="p-3 bg-foreground/10 rounded-lg">
                                <Activity className="h-6 w-6 text-foreground" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground font-medium">Account Status</p>
                                <p className={`text-lg font-bold ${user.is_active ? 'text-brand-500 dark:text-brand-400' : 'text-destructive'}`}>
                                    {user.is_active ? 'Active' : 'Suspended'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 rounded-xl bg-foreground/5 border border-(--card-border)">
                            <div className="p-3 bg-foreground/10 rounded-lg">
                                <Award className="h-6 w-6 text-foreground" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground font-medium">Plan</p>
                                <p className="text-lg font-bold text-foreground capitalize">{user.subscription_type || "free"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-brand-500" /> Activity
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <StatTile icon={<CheckCircle2 className="h-5 w-5" />} label="Questions Solved"
                            value={streak ? String(streak.total_questions_solved) : "—"} />
                        <StatTile icon={<Award className="h-5 w-5" />} label="Contest Rating"
                            value={user.current_rating !== undefined ? String(user.current_rating) : "—"}
                            sub={user.max_rating !== undefined ? `Max ${user.max_rating}${user.title ? ` · ${user.title}` : ""}` : (user.title || undefined)} />
                        <StatTile icon={<Trophy className="h-5 w-5" />} label="Contests"
                            value={ratingGraph ? String(ratingGraph.total_contests) : "—"} />
                        <StatTile icon={<Target className="h-5 w-5" />} label="Accuracy"
                            value={streak ? formatAccuracy(streak.accuracy_rate) : "—"} />
                        <StatTile icon={<Flame className="h-5 w-5" />} label="Current Streak"
                            value={streak ? `${streak.current_streak}d` : "—"}
                            sub={streak ? `Longest ${streak.longest_streak}d` : undefined} />
                    </div>

                    {fluctuations.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Contests</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-muted-foreground">
                                    <thead className="text-xs uppercase text-muted-foreground border-b border-(--border)">
                                        <tr>
                                            <th className="py-2 pr-4 font-medium">Contest</th>
                                            <th className="py-2 px-4 font-medium">Rank</th>
                                            <th className="py-2 px-4 font-medium">Score</th>
                                            <th className="py-2 px-4 font-medium">Rating</th>
                                            <th className="py-2 pl-4 font-medium text-right">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...fluctuations].reverse().slice(0, 10).map((f) => (
                                            <tr key={f.contest_id} className="border-b border-(--border) last:border-0">
                                                <td className="py-2 pr-4 text-foreground font-medium">{f.contest_name}</td>
                                                <td className="py-2 px-4">#{f.rank}</td>
                                                <td className="py-2 px-4">{f.score}</td>
                                                <td className="py-2 px-4">
                                                    <span className="text-foreground">{f.rating_after}</span>
                                                    <span className={`ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium ${f.rating_delta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                                        {f.rating_delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                        {f.rating_delta >= 0 ? `+${f.rating_delta}` : f.rating_delta}
                                                    </span>
                                                </td>
                                                <td className="py-2 pl-4 text-right">{formatDate(f.created_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Batch Management Card */}
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-brand-500" />
                            <h2 className="text-lg font-semibold text-foreground">Batch Assignment</h2>
                        </div>
                        {!editingBatch && (
                            <button
                                onClick={startEditBatch}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors border border-(--card-border) cursor-pointer"
                            >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                        )}
                    </div>

                    {editingBatch ? (
                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="block text-xs font-medium text-foreground mb-1.5">Select Batch</label>
                                <CustomSelect
                                    value={batchValue}
                                    onChange={setBatchValue}
                                    placeholder="No batch (unassign)"
                                    options={[
                                        { label: "No batch (unassign)", value: "" },
                                        ...batches.map(b => ({ label: b.batch_name, value: b.id })),
                                    ]}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSaveBatch}
                                    disabled={savingBatch}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                                >
                                    {savingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Save</>}
                                </button>
                                <button
                                    onClick={() => setEditingBatch(false)}
                                    disabled={savingBatch}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="h-4 w-4" /> Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            {user.batch_id ? (
                                <>
                                    <span className="px-3 py-1.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-lg text-sm font-medium border border-brand-500/20">
                                        {batches.find(b => b.id === user.batch_id)?.batch_name ?? user.batch_id}
                                    </span>
                                    <Link
                                        href={`/batches/${user.batch_id}`}
                                        className="text-xs text-muted-foreground hover:text-brand-500 transition-colors"
                                    >
                                        View batch →
                                    </Link>
                                </>
                            ) : (
                                <span className="text-sm text-muted-foreground">Not assigned to any batch.</span>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}

function InfoItem({ icon, label, value }: { icon: React.ReactElement, label: string, value: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="p-2.5 bg-foreground/5 rounded-xl text-muted-foreground border border-(--card-border)">
                <div className="h-5 w-5">
                    {icon}
                </div>
            </div>
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="font-semibold text-foreground mt-0.5">{value}</p>
            </div>
        </div>
    );
}

function StatTile({ icon, label, value, sub }: { icon: React.ReactElement, label: string, value: string, sub?: string }) {
    return (
        <div className="flex flex-col gap-1 p-4 rounded-xl bg-foreground/5 border border-(--card-border)">
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
    );
}
