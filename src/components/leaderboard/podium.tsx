"use client";

/**
 * Faction-web-style podium (top 3 on gold/silver/bronze pedestals). Generic over
 * the entry shape so every leaderboard tab can feed it its own metric.
 *
 * Ported from faction-web's `LeaderboardView`; the `fx-podium-*` / `fx-pedestal`
 * styles live in `globals.css`.
 */

import { Crown, Medal, Award } from "lucide-react";

/** Per-place styling for the podium (1st = gold, 2nd = silver, 3rd = bronze). */
const PLACE = {
    1: { color: "#FFD54A", glow: "rgba(255,213,74,0.55)", height: "h-28", icon: Crown, avatar: 92 },
    2: { color: "#CBD5E1", glow: "rgba(203,213,225,0.40)", height: "h-20", icon: Medal, avatar: 72 },
    3: { color: "#E8996B", glow: "rgba(232,153,107,0.40)", height: "h-16", icon: Award, avatar: 72 },
} as const;

export interface PodiumEntry {
    id: string;
    name: string | null;
    avatar_url?: string | null;
    /** Pre-formatted metric text, e.g. "1h 20m", "2,340", "18". */
    metric: string;
    /** Small unit shown after the metric, e.g. "solved", "on task", "rating". */
    metricUnit?: string;
}

/** Avatar: photo if available, else an initials circle with an optional ring. */
function Avatar({ name, url, size, ring }: { name: string | null; url?: string | null; size: number; ring?: string }) {
    if (url) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={url}
                alt={name || "avatar"}
                className="rounded-full object-cover"
                style={{ height: size, width: size, border: ring ? `3px solid ${ring}` : undefined }}
            />
        );
    }
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-bold text-brand-600 dark:text-brand-400"
            style={{
                height: size,
                width: size,
                fontSize: Math.round(size * 0.4),
                border: ring ? `3px solid ${ring}` : "1px solid color-mix(in srgb, var(--color-brand-500) 20%, transparent)",
            }}
        >
            {name?.[0]?.toUpperCase() || "?"}
        </div>
    );
}

export function Podium({ top3, unit }: { top3: PodiumEntry[]; unit?: string }) {
    // Render order [2nd, 1st, 3rd] so 1st sits centered and tallest.
    const order: Array<{ e: PodiumEntry; place: 1 | 2 | 3 } | null> = [
        top3[1] ? { e: top3[1], place: 2 } : null,
        top3[0] ? { e: top3[0], place: 1 } : null,
        top3[2] ? { e: top3[2], place: 3 } : null,
    ];

    return (
        <div className="fx-podium-stage relative overflow-hidden rounded-3xl px-4 pt-8 pb-0 sm:px-8">
            {/* Ambient glow + scanline grid */}
            <div className="fx-podium-grid pointer-events-none absolute inset-0 opacity-[0.18]" />
            <div
                className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full blur-3xl"
                style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent 70%)" }}
            />

            {/* Section label */}
            <div className="relative mb-6 flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-linear-to-r from-transparent to-white/40" />
                <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">Top Ranked</span>
                <span className="h-px w-8 bg-linear-to-l from-transparent to-white/40" />
            </div>

            {/* Pedestals */}
            <div className="relative flex items-end justify-center gap-1.5 sm:gap-2">
                {order.map((slot, i) => {
                    if (!slot) return <div key={i} className="w-24 sm:w-28" />;
                    const { e, place } = slot;
                    const meta = PLACE[place];
                    const Icon = meta.icon;
                    const unitText = e.metricUnit ?? unit;
                    return (
                        <div key={e.id} className="group flex w-24 flex-col items-center sm:w-28">
                            {/* Crown / medal above the champion */}
                            <Icon
                                className={`mb-1.5 drop-shadow ${place === 1 ? "size-7" : "size-5"}`}
                                style={{ color: meta.color, filter: `drop-shadow(0 0 8px ${meta.glow})` }}
                                fill={place === 1 ? meta.color : "none"}
                            />

                            {/* Avatar with neon halo */}
                            <div className="relative">
                                <span
                                    className="absolute -inset-1.5 rounded-full opacity-70 blur-md transition-opacity group-hover:opacity-100"
                                    style={{ background: meta.glow }}
                                />
                                <span
                                    className="relative block rounded-full"
                                    style={{ boxShadow: `0 0 0 3px ${meta.color}, 0 0 22px ${meta.glow}` }}
                                >
                                    <Avatar name={e.name} url={e.avatar_url} size={meta.avatar} ring={meta.color} />
                                </span>
                            </div>

                            {/* Name + metric */}
                            <span className="mt-2.5 max-w-full truncate px-1 text-[13px] font-bold text-white">
                                {e.name || "Unknown"}
                            </span>
                            <span className="text-xs font-extrabold tabular-nums" style={{ color: meta.color }}>
                                {e.metric}
                                {unitText && <span className="ml-0.5 font-semibold text-white/50">{unitText}</span>}
                            </span>

                            {/* The pedestal block */}
                            <div
                                className={`fx-pedestal relative mt-3 flex w-full items-start justify-center rounded-t-xl pt-2.5 ${meta.height}`}
                                style={{ ["--p-color" as string]: meta.color, ["--p-glow" as string]: meta.glow }}
                            >
                                <span
                                    className="font-display text-3xl font-black leading-none"
                                    style={{ color: meta.color, textShadow: `0 0 18px ${meta.glow}` }}
                                >
                                    {place}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
