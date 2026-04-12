/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const Millis = {
    SECOND: 1e3,
    MINUTE: 6e4,
    HOUR: 36e5,
    DAY: 864e5,
    WEEK: 6048e5
};

const settings = definePluginSettings({
    showForeverOnTop: {
        type: OptionType.BOOLEAN,
        description: "Show the Forever option at the top of the list instead of the bottom.",
        restartNeeded: true,
        default: true
    },
    extraSeconds: {
        type: OptionType.STRING,
        description: "Extra seconds to add, separated by a comma (e.g. 5, 10, 30)",
        restartNeeded: true,
        default: "15, 30, 45"
    },
    extraMinutes: {
        type: OptionType.STRING,
        description: "Extra minutes to add, separated by a comma (e.g. 5, 10, 30)",
        restartNeeded: true,
        default: "5, 10, 30"
    },
    extraHours: {
        type: OptionType.STRING,
        description: "Extra hours to add, separated by a comma (e.g. 2, 4, 6, 12)",
        restartNeeded: true,
        default: "2, 4, 6, 12"
    },
    extraDays: {
        type: OptionType.STRING,
        description: "Extra days to add, separated by a comma (e.g. 1, 2)",
        restartNeeded: true,
        default: "1, 2"
    },
    extraWeeks: {
        type: OptionType.STRING,
        description: "Extra weeks to add, separated by a comma (e.g. 1, 2, 3)",
        restartNeeded: true,
        default: "1, 2, 3"
    },
    extraMonths: {
        type: OptionType.STRING,
        description: "Extra months to add, separated by a comma (e.g. 1, 2, 3, 6)",
        restartNeeded: true,
        default: "1, 2, 3, 6"
    },
});

export default definePlugin({
    name: "CustomStatusTimeouts",
    description: "Adds configurable timeout presets to the status (presence) menu.",
    authors: [EquicordDevs.Kiri, EquicordDevs.thororen],
    settings,
    patches: [
        {
            find: "#{intl::DURATION_FOREVER}",
            replacement: {
                match: /\[\{duration.*?#{intl::DURATION_FOREVER}\)\}\]/,
                replace: "$self.buildTimeouts($&)"
            }
        }
    ],
    buildTimeouts(existing) {
        const parse = (str: string) => str.split(",").map(s => Number(s.trim())).filter(Boolean);

        const seconds = parse(settings.store.extraSeconds);
        const minutes = parse(settings.store.extraMinutes);
        const hours = parse(settings.store.extraHours);
        const days = parse(settings.store.extraDays);
        const weeks = parse(settings.store.extraWeeks);
        const months = parse(settings.store.extraMonths);

        const extra = [
            ...seconds.map(s => ({
                duration: s * Millis.SECOND,
                label: () => `For ${s} ${s === 1 ? "Second" : "Seconds"}`
            })),
            ...minutes.map(m => ({
                duration: m * Millis.MINUTE,
                label: () => `For ${m} ${m === 1 ? "Minute" : "Minutes"}`
            })),
            ...hours.map(h => ({
                duration: h * Millis.HOUR,
                label: () => `For ${h} ${h === 1 ? "Hour" : "Hours"}`
            })),
            ...days.map(d => ({
                duration: d * Millis.DAY,
                label: () => `For ${d} ${d === 1 ? "Day" : "Days"}`
            })),
            ...weeks.map(w => ({
                duration: w * Millis.WEEK,
                label: () => `For ${w} ${w === 1 ? "Week" : "Weeks"}`
            })),
            ...months.map(m => ({
                duration: m * 30 * Millis.DAY,
                label: () => `For ${m} ${m === 1 ? "Month" : "Months"}`
            })),
        ];

        return [...existing, ...extra].sort((a, b) => {
            if (a.duration === undefined) return settings.store.showForeverOnTop ? -1 : 1;
            if (b.duration === undefined) return settings.store.showForeverOnTop ? 1 : -1;
            return a.duration - b.duration;
        });
    }
});
