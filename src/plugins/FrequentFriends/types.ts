/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type PresenceStatus = "online" | "idle" | "dnd" | "offline" | "invisible";

export interface FrequencyData {
    ds: number;
    vs: number;
    dl: number;
    vl: number;
    af: number;
}
