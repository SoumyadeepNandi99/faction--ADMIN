/**
 * Faction Legends — squad reproduction (CRM side).
 *
 * The app builds each student's Dream XI with PURE, DETERMINISTIC logic:
 *   player(slot) = POOL[slot][ hash(`${userId}-${slot}`) % POOL[slot].length ]
 *   earned(slot) = eventProgress >= milestones[slot-1]
 * No device state, no storage — just (userId, stream, progress). So the CRM can
 * reproduce the EXACT squad a student sees, given those three inputs.
 *
 * ⚠️ This file is a byte-for-byte port of the app's
 * faction-app/src/features/legends/{legendsCore.ts, legendsConfig.js}. The FNV
 * hash and the player-pool arrays MUST stay identical to the app, or the CRM
 * would show different players than the student. If the app's pools/hash change,
 * update this file to match.
 */

export type PoolKey = "GK" | "DEF" | "MID" | "FWD" | "LEGEND";
export type LegendsStream = "JEE" | "NEET" | "FOUNDATION";

export interface LegendsPlayer {
    name: string;
    rating: number;
    stats: number[]; // [PAC, SHO, PAS, DRI, DEF, PHY]
}

export interface SquadSlot {
    slot: number;
    pool: PoolKey;
    positionLabel: string;
    jersey: number;
    player: LegendsPlayer;
    milestone: number;
    earned: boolean;
    remaining: number;
    rarity: "gold" | "special" | "locked";
}

const TOTAL_SLOTS = 11;

const SLOT_POOL: Record<number, PoolKey> = {
    1: "GK", 2: "GK",
    3: "DEF", 4: "DEF", 5: "DEF",
    6: "MID", 7: "MID", 8: "MID",
    9: "FWD", 10: "FWD",
    11: "LEGEND",
};

const SLOT_POSITION_LABEL: Record<number, string> = {
    1: "GK", 2: "GK", 3: "LB", 4: "CB", 5: "RB",
    6: "CM", 7: "CDM", 8: "CAM", 9: "LW", 10: "RW", 11: "ST",
};

const SLOT_JERSEY: Record<number, number> = {
    1: 1, 2: 12, 3: 3, 4: 4, 5: 2, 6: 6, 7: 8, 8: 10, 9: 11, 10: 7, 11: 9,
};

const PLAYER_POOLS: Record<PoolKey, LegendsPlayer[]> = {
    GK: [
        { name: "Manuel Neuer", rating: 90, stats: [58, 25, 60, 55, 42, 84] },
        { name: "Thibaut Courtois", rating: 90, stats: [52, 22, 58, 50, 40, 86] },
        { name: "Alisson Becker", rating: 89, stats: [56, 24, 62, 54, 44, 88] },
        { name: "Gianluigi Buffon", rating: 88, stats: [50, 20, 55, 48, 46, 82] },
        { name: "Iker Casillas", rating: 88, stats: [60, 21, 57, 56, 42, 80] },
        { name: "Petr Cech", rating: 87, stats: [54, 19, 54, 52, 45, 83] },
        { name: "Ederson Moraes", rating: 88, stats: [57, 30, 78, 55, 40, 84] },
    ],
    DEF: [
        { name: "Sergio Ramos", rating: 89, stats: [72, 60, 68, 70, 88, 84] },
        { name: "Virgil van Dijk", rating: 90, stats: [77, 60, 71, 72, 90, 86] },
        { name: "Paolo Maldini", rating: 89, stats: [78, 55, 72, 74, 89, 82] },
        { name: "Cafu", rating: 87, stats: [90, 58, 76, 82, 82, 80] },
        { name: "Roberto Carlos", rating: 88, stats: [93, 82, 78, 84, 80, 82] },
        { name: "Franz Beckenbauer", rating: 88, stats: [74, 60, 80, 76, 87, 80] },
        { name: "Carles Puyol", rating: 86, stats: [75, 45, 62, 66, 87, 84] },
        { name: "Marcelo Vieira", rating: 86, stats: [88, 62, 80, 88, 74, 76] },
    ],
    MID: [
        { name: "Andres Iniesta", rating: 90, stats: [76, 72, 88, 90, 62, 68] },
        { name: "Xavi Hernandez", rating: 90, stats: [68, 74, 92, 86, 60, 66] },
        { name: "Zinedine Zidane", rating: 91, stats: [74, 82, 89, 92, 60, 78] },
        { name: "Steven Gerrard", rating: 89, stats: [78, 85, 84, 82, 70, 82] },
        { name: "Frank Lampard", rating: 88, stats: [72, 86, 82, 80, 66, 78] },
        { name: "Kevin De Bruyne", rating: 91, stats: [76, 86, 93, 87, 64, 78] },
        { name: "Luka Modric", rating: 89, stats: [80, 76, 89, 90, 66, 68] },
        { name: "Paul Pogba", rating: 87, stats: [76, 82, 84, 85, 66, 84] },
    ],
    FWD: [
        { name: "Ronaldinho", rating: 91, stats: [86, 88, 88, 95, 40, 74] },
        { name: "Thierry Henry", rating: 90, stats: [92, 89, 80, 90, 44, 80] },
        { name: "Zlatan Ibrahimovic", rating: 90, stats: [78, 92, 82, 86, 46, 88] },
        { name: "Neymar Jr", rating: 90, stats: [90, 85, 86, 94, 38, 62] },
        { name: "Kylian Mbappe", rating: 91, stats: [97, 90, 82, 92, 40, 78] },
        { name: "Robert Lewandowski", rating: 91, stats: [80, 92, 79, 86, 44, 84] },
        { name: "Sergio Aguero", rating: 89, stats: [84, 90, 78, 88, 38, 76] },
        { name: "Ronaldo Nazario", rating: 91, stats: [95, 93, 78, 92, 45, 82] },
    ],
    LEGEND: [
        { name: "Lionel Messi", rating: 94, stats: [88, 92, 92, 96, 40, 66] },
        { name: "Cristiano Ronaldo", rating: 93, stats: [90, 95, 82, 89, 42, 84] },
        { name: "Diego Maradona", rating: 93, stats: [86, 90, 88, 96, 42, 70] },
        { name: "Pele", rating: 94, stats: [90, 94, 88, 93, 50, 80] },
    ],
};

// Per-stream milestone thresholds (11 slots). MUST match legendsConfig.js.
export const STREAM_MILESTONES: Record<LegendsStream, number[]> = {
    JEE: [15, 40, 70, 100, 135, 170, 205, 235, 265, 285, 300],
    NEET: [30, 75, 135, 200, 270, 340, 415, 480, 535, 575, 600],
    FOUNDATION: [20, 50, 90, 135, 180, 225, 275, 315, 350, 380, 400],
};

/**
 * FNV-1a 32-bit — byte-for-byte identical to the app's hashString. Stable across
 * engines, so hash(`${userId}-${slot}`) picks the same player everywhere.
 */
export function hashString(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
}

function assignPlayer(userId: string, slot: number): LegendsPlayer {
    const pool = SLOT_POOL[slot];
    const players = PLAYER_POOLS[pool];
    const idx = hashString(`${userId}-${slot}`) % players.length;
    return players[idx];
}

const slotRarity = (slot: number): "gold" | "special" =>
    SLOT_POOL[slot] === "LEGEND" ? "gold" : "special";

/**
 * Build the full 11-slot squad for a student at a given event progress — the
 * exact squad they see in the app. `earned` slots are unlocked; the rest show
 * their milestone + how many more solves remain.
 */
export function buildSquad(userId: string, stream: LegendsStream, eventProgress: number): SquadSlot[] {
    const milestones = STREAM_MILESTONES[stream] ?? STREAM_MILESTONES.JEE;
    const squad: SquadSlot[] = [];
    for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
        const milestone = milestones[slot - 1];
        const earned = eventProgress >= milestone;
        squad.push({
            slot,
            pool: SLOT_POOL[slot],
            positionLabel: SLOT_POSITION_LABEL[slot],
            jersey: SLOT_JERSEY[slot],
            player: assignPlayer(userId, slot),
            milestone,
            earned,
            remaining: earned ? 0 : Math.max(0, milestone - eventProgress),
            rarity: earned ? slotRarity(slot) : "locked",
        });
    }
    return squad;
}
