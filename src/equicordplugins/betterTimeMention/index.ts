/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { getIntlMessage } from "@utils/discord";
import definePlugin from "@utils/types";

interface Row {
    mention?: { timestamp: string; format: string; };
    description?: string;
}

const UNIT = String.raw`seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|wks?|w`;
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
const DURATION_RE = new RegExp(String.raw`^([+-])?\s*((?:\d+(?:\.\d+)?\s*(?:${UNIT})\s*)+)$`, "i");
const PART_RE = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*(${UNIT})`, "gi");

const ZONE = String.raw`(?:(?:utc|gmt)\s*(?:(?<sign>[+-])(?<oh>1[0-4]|0?\d)(?::?(?<om>[0-5]\d))?(?!\d))?|(?<iana>[a-z_]+(?:\/[a-z0-9_+-]+)+))`;
const TIME = String.raw`(?<hour>\d{1,2}):?(?<minute>\d{2})?\s*(?:(?<meridiem>am|pm)\b)?`;
const ZONED_RES = [new RegExp(`^${ZONE}\\s*${TIME}$`, "i"), new RegExp(`^${TIME}\\s*${ZONE}$`, "i")];

const DAY_MS = 86400000;
const MAX_MS = 8.64e15;

function dayLabel(ms: number) {
    const days = Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY_MS);
    if (days === 0) return getIntlMessage("TIMESTAMP_TODAY");
    if (days === 1) return getIntlMessage("TIMESTAMP_TOMORROW");
    if (days === -1) return getIntlMessage("TIMESTAMP_YESTERDAY");
}

function group(ms: number, format = "s"): Row[] {
    const timestamp = Math.round(ms / 1000).toString();
    return [{ mention: { timestamp, format }, description: dayLabel(ms) }, ...["f", "F", "R"].map(f => ({ mention: { timestamp, format: f } }))];
}

function offsetMinutes(zone: Record<string, string | undefined>, ms: number) {
    if (!zone.iana) return (zone.sign === "-" ? -1 : 1) * (Number(zone.oh ?? 0) * 60 + Number(zone.om ?? 0));

    const name = new Intl.DateTimeFormat("en-US", { timeZone: zone.iana, timeZoneName: "longOffset" })
        .formatToParts(ms).find(p => p.type === "timeZoneName")?.value ?? "";
    const match = /([+-])(\d{2}):(\d{2})/.exec(name);
    return match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
}

function parseZonedTime(query: string): Row[] | null {
    const zone = ZONED_RES.map(re => re.exec(query)?.groups).find(Boolean);
    if (!zone) return null;

    const meridiem = zone.meridiem?.toLowerCase();
    let hour = Number(zone.hour);
    const minute = Number(zone.minute ?? 0);
    if (minute > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) return null;
    if (meridiem) hour = hour % 12 + (meridiem === "pm" ? 12 : 0);

    const now = Date.now();
    let offset: number;
    try {
        offset = offsetMinutes(zone, now);
    } catch {
        return null;
    }

    const zoneNow = new Date(now + offset * 60000);
    const local = Date.UTC(zoneNow.getUTCFullYear(), zoneNow.getUTCMonth(), zoneNow.getUTCDate(), hour, minute);
    const at = (day: number) => {
        const wall = local + day * DAY_MS;
        const before = offsetMinutes(zone, wall - DAY_MS);
        const after = offsetMinutes(zone, wall + DAY_MS);
        const valid = [before, after].sort((a, b) => b - a).find(o => offsetMinutes(zone, wall - o * 60000) === o);
        return wall - (valid ?? before) * 60000;
    };

    const today = at(0);
    const next = today < now ? at(1) : today;

    return [
        { mention: { timestamp: Math.round(next / 1000).toString(), format: "t" }, description: getIntlMessage("TIMESTAMP_TIME_ONLY") },
        {},
        ...(next !== today ? [...group(next), {}] : []),
        ...group(today)
    ];
}

export default definePlugin({
    name: "BetterTimeMention",
    description: "Lets @time take durations like 24m or 2 hours and zoned times like UTC 02:45, 0300 GMT+2 or Europe/Berlin 15:00.",
    authors: [Devs.creations],
    tags: ["Chat", "Utility"],

    patches: [
        {
            find: 'autocompleteInputElementType:"timestampMentionInput"',
            replacement: {
                match: /(?<=return )\i(?=\}\(\i\)\}\}\))/,
                replace: "$self.choose(arguments[0],$&)"
            }
        }
    ],

    choose(query: string, rows: Row[]) {
        return rows.length ? rows : this.parseQuery(query) ?? rows;
    },

    parseQuery(query: string): Row[] | null {
        const trimmed = query.trim();
        if (trimmed.length > 64) return null;
        const match = DURATION_RE.exec(trimmed);
        if (!match) return parseZonedTime(trimmed);

        let seconds = 0;
        let hasSeconds = false;
        for (const [, amount, unit] of match[2].matchAll(PART_RE)) {
            const key = unit[0].toLowerCase();
            seconds += Number(amount) * UNIT_SECONDS[key];
            hasSeconds ||= key === "s";
        }

        const ms = Date.now() + (match[1] === "-" ? -seconds : seconds) * 1000;
        return Math.abs(ms) < MAX_MS ? group(ms, hasSeconds ? "S" : "s") : null;
    }
});
