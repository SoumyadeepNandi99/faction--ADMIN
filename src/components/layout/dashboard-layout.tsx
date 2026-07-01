"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "@/lib/axios";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

// Module-level flag: once verified in this browser session, never flash the spinner again
// even if the layout component remounts during navigation.
let sessionVerified = false;

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(!sessionVerified);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (sessionVerified) return;

        const verifySession = async () => {
            try {
                if (!localStorage.getItem("access_token")) {
                    router.push("/login");
                    return;
                }
                // Verify the session AND that the user is an admin. The CRM is
                // admin-only — a valid student session must not be allowed in.
                const res = await apiClient.get("/api/v1/users/me");
                if (res.data?.role !== "ADMIN") {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");
                    toast.error("This account is not authorized to access the admin CRM.");
                    router.push("/login");
                    return;
                }
                sessionVerified = true;
                setIsChecking(false);
            } catch (error) {
                console.error("Session verification failed", error);
                router.push("/login");
            }
        };

        verifySession();
    }, []);

    // Prevent rendering the protected layout until we know the session is valid
    if (isChecking) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="h-8 w-8 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex lg:hidden">
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="relative flex w-64 flex-col bg-background">
                        <Sidebar onNavigate={() => setIsMobileMenuOpen(false)} />
                    </div>
                </div>
            )}

            {/* Sidebar - Desktop */}
            <div className="hidden lg:flex lg:w-64 lg:flex-col">
                <Sidebar />
            </div>

            <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                <Topbar onMenuToggle={() => setIsMobileMenuOpen(true)} />

                <main className="flex-1 overflow-y-auto w-full">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
