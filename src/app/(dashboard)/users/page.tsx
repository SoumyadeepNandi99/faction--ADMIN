"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Search, Trash2, RefreshCw, Ban, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-modal";
import { formatDate } from "@/lib/datetime";

interface User {
    id: string;
    phone_number: string;
    name: string;
    email?: string | null;
    role: "STUDENT" | "ADMIN";
    is_active: boolean;
    subscription_type?: "free" | "premium";
    batch?: string | null;
    target_exams?: string[];
    school?: string | null;
    state?: string | null;
    city?: string | null;
    created_at: string;
    class_id?: string;
}

interface ClassItem { id: string; name: string; }

function extractUsers(data: any): User[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.users)) return data.users;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    return [];
}

export default function UsersPage() {
    const router = useRouter();
    const PAGE_SIZE = 50;
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showBannedOnly, setShowBannedOnly] = useState(false);
    const [page, setPage] = useState(0); // 0-based

    // Debounce the search box into the query param (so we don't refetch on every keystroke).
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Reset to the first page whenever the search or banned filter changes.
    useEffect(() => { setPage(0); }, [debouncedSearch, showBannedOnly]);

    // Server-side pagination + filtering: skip/limit page through, q searches ALL
    // users (name/phone), is_active=false lists banned. limit+1 is requested so we
    // can tell if there's a next page (bare-array response has no total count).
    const usersUrl = (() => {
        const p = new URLSearchParams();
        p.set("skip", String(page * PAGE_SIZE));
        p.set("limit", String(PAGE_SIZE + 1)); // fetch one extra to detect "has next"
        if (debouncedSearch) p.set("q", debouncedSearch);
        if (showBannedOnly) p.set("is_active", "false");
        return `/api/v1/users/?${p.toString()}`;
    })();

    const { data: usersData, error, isLoading: loading, mutate } = useSWR(
        usersUrl,
        { revalidateOnMount: true, revalidateIfStale: true }
    );
    const { data: classesData } = useSWR("/api/v1/class/");

    const rawUsers: User[] = extractUsers(usersData);
    const hasNextPage = rawUsers.length > PAGE_SIZE;
    const users: User[] = hasNextPage ? rawUsers.slice(0, PAGE_SIZE) : rawUsers;
    const classes: ClassItem[] = Array.isArray(classesData) ? classesData : (classesData?.classes || []);
    const classNameById = (id?: string | null) => (id ? classes.find((c) => c.id === id)?.name ?? "—" : "—");

    const handleDeleteUser = async (e: React.MouseEvent, phone: string) => {
        e.stopPropagation();
        if (!(await confirmAction({ title: "Delete User", description: `Permanently delete user with mobile ${phone}? This cannot be undone.`, destructive: true }))) return;

        try {
            const cleanPhone = phone.replace(/^\+\d+\s*/, '');
            await apiClient.delete(`/api/v1/users/delete/${cleanPhone}`);
            mutate((cur: any) => {
                const existing = extractUsers(cur);
                const filtered = existing.filter((u: User) => u.phone_number !== phone);
                return Array.isArray(cur) ? filtered : { ...cur, users: filtered };
            }, false);
            toast.success("User deleted.");
        } catch {
            toast.error("Failed to delete user.");
        }
    };

    const handleBanToggle = async (e: React.MouseEvent, user: User) => {
        e.stopPropagation();
        const banning = user.is_active; // active -> we're about to ban
        const ok = await confirmAction({
            title: banning ? "Ban User" : "Unban User",
            description: banning
                ? `Ban ${user.name || user.phone_number}? They will be logged out and cannot sign in until unbanned.`
                : `Unban ${user.name || user.phone_number}? They will be able to sign in again.`,
            destructive: banning,
        });
        if (!ok) return;
        try {
            await apiClient.post(`/api/v1/users/${user.id}/${banning ? "ban" : "unban"}`);
            // Optimistically flip is_active in the cached list.
            mutate((cur: any) => {
                const existing = extractUsers(cur);
                const updated = existing.map((u: User) =>
                    u.id === user.id ? { ...u, is_active: !banning } : u
                );
                return Array.isArray(cur) ? updated : { ...cur, users: updated };
            }, false);
            toast.success(banning ? "User banned." : "User unbanned.");
        } catch {
            toast.error(banning ? "Failed to ban user." : "Failed to unban user.");
        }
    };

    // Search + banned filtering are done server-side (q / is_active params), so
    // the current page is shown as-is.
    const filteredUsers = users;

    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">User Governance</h1>
                        <p className="text-muted-foreground">Manage accounts, monitor activity, and enforce platform rules.</p>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="glass-card p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search users by name, email, or mobile..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background border border-(--input) rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowBannedOnly((v) => !v)}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer w-full sm:w-auto justify-center ${showBannedOnly ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-background text-muted-foreground border-(--input) hover:text-foreground'}`}
                            title="Show only banned users"
                        >
                            <Ban className="h-4 w-4" />
                            {showBannedOnly ? "Banned only" : "All users"}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="px-3 py-1 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-full font-medium">
                            {filteredUsers.length > 0
                                ? `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + filteredUsers.length}`
                                : "0"} {showBannedOnly ? "Banned" : "Users"}
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-muted-foreground">
                            <thead className="bg-muted/50 text-xs uppercase text-foreground">
                                <tr>
                                    <th scope="col" className="px-6 py-4">User</th>
                                    <th scope="col" className="px-6 py-4">Contact</th>
                                    <th scope="col" className="px-6 py-4">Plan</th>
                                    <th scope="col" className="px-6 py-4">Class</th>
                                    <th scope="col" className="px-6 py-4">Batch / Exams</th>
                                    <th scope="col" className="px-6 py-4">Status</th>
                                    <th scope="col" className="px-6 py-4">Joined</th>
                                    <th scope="col" className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8}>
                                            <div className="p-4 space-y-4">
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <div key={i} className="flex items-center justify-between p-4 border rounded-xl border-(--card-border)">
                                                        <div className="flex items-center gap-4">
                                                            <Skeleton className="h-10 w-10 rounded-full" />
                                                            <div className="space-y-2">
                                                                <Skeleton className="h-4 w-32 rounded" />
                                                                <Skeleton className="h-3 w-24 rounded" />
                                                            </div>
                                                        </div>
                                                        <Skeleton className="h-8 w-24 rounded-full" />
                                                        <Skeleton className="h-8 w-16 rounded" />
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={8}>
                                            <div className="p-12 text-center flex flex-col items-center gap-3">
                                                <RefreshCw className="h-8 w-8 text-destructive/50" />
                                                <h3 className="text-lg font-bold text-foreground">Failed to Load Users</h3>
                                                <p className="text-muted-foreground text-sm">Could not fetch user data from the server.</p>
                                                <button onClick={() => mutate()}
                                                    className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                                                    Retry
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr className="border-t border-(--border)">
                                        <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                            No users found matching your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr
                                            key={user.id || user.phone_number}
                                            onClick={() => router.push(`/users/${user.id}`)}
                                            className="border-t border-(--border) hover:bg-muted/30 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold border border-brand-500/20">
                                                        {user.name?.charAt(0) || "U"}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-foreground">{user.name || "Unknown"}</div>
                                                        <div className="text-xs text-muted-foreground capitalize">{user.role.toLowerCase() || "Student"}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-foreground">{user.email || "No Email"}</div>
                                                <div className="text-xs">{user.phone_number || "No Mobile"}</div>
                                                {(user.city || user.state) && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">{[user.city, user.state].filter(Boolean).join(", ")}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.subscription_type === "premium" ? 'bg-accent-purple/10 text-accent-purple' : 'bg-foreground/5 text-muted-foreground border border-(--card-border)'}`}>
                                                    {user.subscription_type === "premium" ? "Premium" : "Free"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-foreground">{classNameById(user.class_id)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {user.batch && (
                                                        <span className="text-xs bg-brand-500/10 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded font-medium w-fit">
                                                            {user.batch}
                                                        </span>
                                                    )}
                                                    {user.target_exams && user.target_exams.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {user.target_exams.map(exam => (
                                                                <span key={exam} className="text-xs bg-foreground/5 text-muted-foreground px-1.5 py-0.5 rounded border border-(--card-border)">
                                                                    {exam}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!user.batch && (!user.target_exams || user.target_exams.length === 0) && (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'bg-destructive/10 text-destructive'}`}>
                                                    {user.is_active ? 'Active' : 'Suspended'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {formatDate(user.created_at)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={(e) => handleBanToggle(e, user)}
                                                    className={`p-2 rounded-md transition-colors cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 ${user.is_active ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10' : 'text-brand-600 dark:text-brand-400 hover:bg-brand-500/10'}`}
                                                    title={user.is_active ? "Ban User" : "Unban User"}
                                                >
                                                    {user.is_active ? <Ban className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                                </button>
                                                {user.phone_number && (
                                                    <button
                                                        onClick={(e) => handleDeleteUser(e, user.phone_number)}
                                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer sm:opacity-0 sm:group-hover:opacity-100"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!error && (
                        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-(--border)">
                            <span className="text-sm text-muted-foreground">
                                Page {page + 1}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page === 0 || loading}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-(--input) text-foreground hover:bg-muted/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage((p) => p + 1)}
                                    disabled={!hasNextPage || loading}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-(--input) text-foreground hover:bg-muted/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}
