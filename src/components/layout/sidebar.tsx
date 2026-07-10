"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    BookOpen,
    FileText,
    Award,
    MessageSquare,
    Megaphone,
    LogOut,
    Trophy,
    Youtube,
    BadgeCheck,
    GraduationCap,
    Layers,
    Map,
    NotebookText,
    CalendarClock,
    GalleryHorizontalEnd,
    BarChart3,
} from "lucide-react";
import { apiClient } from "@/lib/axios";
import { confirmAction } from "@/components/ui/confirm-modal";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Founder Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Users", href: "/users", icon: Users },
    { name: "Batches", href: "/batches", icon: Layers },
    { name: "Curriculum", href: "/curriculum", icon: BookOpen },
    { name: "Content & QBank", href: "/content", icon: FileText },
    { name: "Problem of the Day", href: "/potd", icon: CalendarClock },
    { name: "Treasures", href: "/treasures", icon: Map },
    { name: "Home Banners", href: "/banners", icon: GalleryHorizontalEnd },
    { name: "Notes", href: "/notes", icon: NotebookText },
    { name: "Assessments", href: "/assessments", icon: Award },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "YouTube Videos", href: "/videos", icon: Youtube },
    { name: "Badges", href: "/badges", icon: BadgeCheck },
    { name: "PYQ Manager", href: "/pyq", icon: GraduationCap },
    { name: "Community", href: "/community", icon: MessageSquare },
    { name: "Broadcasts", href: "/broadcasts", icon: Megaphone },
];

interface SidebarProps {
    onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
    const pathname = usePathname();

    const handleLogout = async () => {
        const confirmed = await confirmAction({
            title: "Confirm Logout",
            description: "Are you sure you want to securely log out of the admin panel?",
            confirmText: "Logout",
            destructive: false
        });
        if (!confirmed) return;

        try {
            await apiClient.post("/api/v1/auth/logout");
        } catch (error) {
            console.error("Logout API failed, clearing local tokens anyway");
        } finally {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/login";
        }
    };

    return (
        <div className="flex h-full w-64 flex-col glass-panel border-r">
            <div className="flex h-16 shrink-0 items-center px-6">
                <div className="flex items-center gap-2">
                    {/* Logo Placeholder */}
                    <div className="h-8 w-8 rounded-lg bg-linear-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                        <span className="text-white font-bold tracking-tighter">FD</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-foreground">Faction Admin</span>
                </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
                <nav className="flex-1 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={onNavigate}
                                className={`
                  group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
                  ${isActive
                                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20"
                                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                    }
                `}
                            >
                                <item.icon
                                    className={`h-5 w-5 shrink-0 transition-colors ${isActive ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground group-hover:text-foreground"}`}
                                    aria-hidden="true"
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-(--sidebar-border) space-y-2">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive group transition-all"
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    Logout
                </button>
            </div>
        </div>
    );
}
