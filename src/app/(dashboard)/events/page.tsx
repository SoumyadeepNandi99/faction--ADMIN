"use client";

/**
 * Events module — list view.
 *
 * Events are defined in `@/lib/events/config` (the app's live "World Cup" is the
 * Faction Legends season; there's no backend event record, so the CRM mirrors
 * the definition). Each card links to the event's leaderboard. No app/backend
 * changes — the detail page reads existing study-stats read-only.
 */

import { useRouter } from "next/navigation";
import { Trophy, CalendarDays, ArrowRight, Users } from "lucide-react";
import { EVENTS, eventStatus, type EventStatus } from "@/lib/events/config";
import { formatDate } from "@/lib/datetime";

const STATUS_BADGE: Record<EventStatus, string> = {
    ongoing: "bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20",
    upcoming: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20",
    ended: "bg-foreground/10 text-muted-foreground",
};
const STATUS_LABEL: Record<EventStatus, string> = {
    ongoing: "Ongoing",
    upcoming: "Upcoming",
    ended: "Ended",
};

export default function EventsPage() {
    const router = useRouter();
    const events = EVENTS.map(e => ({ ...e, status: eventStatus(e) }));

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Events</h1>
                    <p className="text-muted-foreground">
                        Live student events and their leaderboards. Progress is drawn from each
                        student&apos;s Faction Legends progress in the app.
                    </p>
                </div>
            </div>

            {events.length === 0 ? (
                <div className="glass-card p-12 text-center flex flex-col items-center">
                    <CalendarDays className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold text-foreground">No Events</h3>
                    <p className="text-muted-foreground mt-1 text-sm">There are no events configured yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {events.map(e => (
                        <div
                            key={e.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/events/${e.id}`)}
                            onKeyDown={ev => {
                                if (ev.key === "Enter" || ev.key === " ") {
                                    ev.preventDefault();
                                    router.push(`/events/${e.id}`);
                                }
                            }}
                            className="glass-card flex flex-col p-6 relative overflow-hidden group cursor-pointer hover:border-brand-500/40 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition-colors"
                        >
                            {e.status === "ongoing" && (
                                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full pointer-events-none" />
                            )}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-foreground/5 rounded-xl border border-(--card-border) text-2xl leading-none">
                                        {e.emoji}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-foreground group-hover:text-brand-500 transition-colors line-clamp-1">
                                            {e.name}
                                        </h3>
                                        <p className="text-xs text-muted-foreground font-mono tracking-wide">{e.tag}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${STATUS_BADGE[e.status]}`}>
                                    {e.status === "ongoing" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                                    {STATUS_LABEL[e.status]}
                                </span>
                            </div>

                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{e.description}</p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground font-medium">
                                        {formatDate(e.startDateISO)} – {formatDate(e.endDateISO)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Trophy className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground font-medium">Questions solved</span>
                                </div>
                            </div>

                            <div className="mt-auto flex items-center justify-between pt-2 border-t border-(--card-border)">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Users className="h-3.5 w-3.5" /> Participant leaderboard
                                </span>
                                <span className="flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400 group-hover:gap-2 transition-all">
                                    View leaderboard <ArrowRight className="h-4 w-4" />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
