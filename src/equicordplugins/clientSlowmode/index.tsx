/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore } from "@webpack/common";

function convertSec(v: number) {
  const sec = Math.max(0, Math.floor(v || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const settings = definePluginSettings({
  slowmode: {
    description: "Set Minutes / Seconds for Slowmode",
    type: OptionType.SLIDER,
    markers: [0, 30, 60, 120, 300, 600],
    default: 0,
    stickToMarkers: false,
    componentProps: {
      minValue: 0,
      maxValue: 600,
      step: 1,
      onValueChange: (v: number) => (settings.store.slowmode = Math.floor(v)),
      onValueRender: (v: number) => convertSec(v),
      onMarkerRender: (v: number) => convertSec(v)
    }
  }
});

let getChan: typeof ChannelStore.getChannel;

export default definePlugin({
    name: "ClientSlowmode",
    description: "Allows you to set slowmode, on your client minutes/seconds.",
    authors: [EquicordDevs.omaw],
    settings,
    start() {
        getChan = ChannelStore.getChannel;
        ChannelStore.getChannel = (id: string) => {
            const c = getChan(id);
            if (!c) return c;
            return new Proxy(c, {
                get(t, p) {
                    if (p === "rateLimitPerUser") {
                        return t.rateLimitPerUser > 0
                            ? t.rateLimitPerUser
                            : settings.store.slowmode;
                    }
                    return Reflect.get(t, p);
                }
            });
        };
    },
    stop() {
        if (getChan) {
            ChannelStore.getChannel = getChan;
            getChan = null!;
            settings.store.slowmode = 0;
        }
    }
});
