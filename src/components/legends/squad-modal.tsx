"use client";

import { useEffect, useMemo } from "react";
import { X, Lock, Check, Trophy } from "lucide-react";
import { buildSquad, type LegendsStream } from "@/lib/legends";
import type { LegendsProgressRow } from "@/lib/api/analytics";

/**
 * Shows a student's full 11-slot Faction Legends squad — the EXACT players and
 * unlocked/locked state they see in the app, reproduced deterministically from
 * (userId, stream, progress). See src/lib/legends.ts.
 */
export function SquadModal({ row, onClose }: { row: LegendsProgressRow; onClose: () => void }) {
    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const squad = useMemo(
        () => buildSquad(row.userId, row.stream as LegendsStream, row.progress),
        [row.userId, row.stream, row.progress],
    );
    const unlocked = squad.filter(s => s.earned).length;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="glass-card w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-(--panel-border) shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-brand-500" />
                            {row.name || "Unknown"} — Dream XI
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {row.stream === "FOUNDATION" ? "Foundation" : row.stream}
                            {row.className ? ` · Class ${row.className}` : ""} ·{" "}
                            <span className="font-semibold text-foreground">{row.progress}</span> / {row.target} solves ·{" "}
                            <span className="font-semibold text-foreground">{unlocked}/11</span> unlocked
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors cursor-pointer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Squad list */}
                <div className="overflow-y-auto p-4 flex flex-col gap-2">
                    {squad.map(s => (
                        <div
                            key={s.slot}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                                s.earned
                                    ? s.rarity === "gold"
                                        ? "bg-amber-500/10 border-amber-500/30"
                                        : "bg-brand-500/10 border-brand-500/25"
                                    : "bg-foreground/[0.03] border-(--panel-border) opacity-70"
                            }`}
                        >
                            {/* Position + jersey */}
                            <div
                                className={`h-9 w-9 rounded-lg flex flex-col items-center justify-center shrink-0 text-[10px] font-bold leading-none ${
                                    s.earned
                                        ? s.rarity === "gold"
                                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                            : "bg-brand-500/20 text-brand-600 dark:text-brand-400"
                                        : "bg-foreground/10 text-muted-foreground"
                                }`}
                            >
                                <span>{s.positionLabel}</span>
                                <span className="opacity-70">#{s.jersey}</span>
                            </div>

                            {/* Player name + milestone */}
                            <div className="flex-1 min-w-0">
                                <div className={`font-semibold truncate ${s.earned ? "text-foreground" : "text-muted-foreground"}`}>
                                    {s.player.name}
                                    {s.rarity === "gold" && s.earned && (
                                        <span className="ml-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 align-middle">LEGEND</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {s.earned
                                        ? `Unlocked at ${s.milestone} solves`
                                        : `Unlocks at ${s.milestone} · ${s.remaining} more to go`}
                                </div>
                            </div>

                            {/* State */}
                            {s.earned ? (
                                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <Check className="h-4 w-4" /> Unlocked
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                    <Lock className="h-3.5 w-3.5" /> Locked
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
