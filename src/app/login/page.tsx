"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/axios";
import { Lock, Phone, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await apiClient.post("/api/v1/auth/login", {
                phone_number: phone,
                password: password,
            });

            if (res.data.access_token) {
                localStorage.setItem("access_token", res.data.access_token);
                if (res.data.refresh_token) {
                    localStorage.setItem("refresh_token", res.data.refresh_token);
                }
                router.push("/");
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || "Invalid credentials or server error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center relative overflow-hidden selection:bg-brand-500/30">

            {/* Background Orbs */}
            <div className="absolute top-1/4 left-1/4 w-125 h-125 bg-brand-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-150 h-150 bg-accent-blue/10 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
                <div className="text-center mb-10">
                    <div className="mx-auto h-16 w-16 bg-linear-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 mb-6">
                        <span className="text-3xl font-bold tracking-tighter text-white">FD</span>
                    </div>
                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                        System Administrator
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Sign in to access the Faction Digital Ecosystem CRM
                    </p>
                </div>

                <div className="glass-card py-10 px-6 sm:px-12">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-medium leading-6 text-foreground mb-2">
                                Administrator Phone Number
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="block w-full rounded-xl border-0 bg-black/5 dark:bg-white/5 py-2.5 pl-10 text-foreground shadow-sm ring-1 ring-inset ring-foreground/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6 transition-all"
                                    placeholder="+91 9999999999"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium leading-6 text-foreground mb-2">
                                Secure Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full rounded-xl border-0 bg-black/5 dark:bg-white/5 py-2.5 pl-10 text-foreground shadow-sm ring-1 ring-inset ring-foreground/10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
                                {error}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative flex w-full justify-center items-center gap-2 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:from-brand-500 hover:to-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        Sign in to secure portal
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
