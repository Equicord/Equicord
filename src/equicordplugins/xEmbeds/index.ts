/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

function readXLink(input: string): string | null {
    const name = input.trim().toLowerCase() || "fixupx";
    const domain = name.includes(".") ? name : `${name}.com`;
    if (domain.length > 253) return null;
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) return null;
    return domain;
}

export function xEmbeds(content: string, site = "fixupx"): string {
    const xHost = readXLink(site) ?? "fixupx.com";
    function xSwap(text: string) {
        return text.replace(/(?<![\p{L}\p{N}_@./:\\-])https?:\/\/[^\s<>`]+/giu, url =>
            url.replace(/^(https?:\/\/)(?:www\.)?x\.com(?=\/(?:\w+|i\/web)\/status\/\d+(?:$|[/?#]|[.,!;:)"'\]}]+$))/i,
                (_, protocol: string) => `${protocol}${xHost}`)
        );
    }

    let fixed = "";
    let start = 0;
    let fence = "";

    for (const match of content.matchAll(/`+/g)) {
        let ticks = match[0];
        let pos = match.index;
        if (!fence) {
            let escapes = 0;
            for (let i = pos - 1; i >= 0 && content[i] === "\\"; i--) escapes++;
            if (escapes % 2) {
                ticks = ticks.slice(1);
                pos++;
                if (!ticks) continue;
            }
            fixed += xSwap(content.slice(start, pos)) + ticks;
            fence = ticks;
        } else {
            fixed += content.slice(start, pos) + ticks;
            if (ticks === fence) fence = "";
        }
        start = pos + ticks.length;
    }
    const rest = content.slice(start);
    return fixed + (fence ? rest : xSwap(rest));
}

const settings = definePluginSettings({
    replacementhost: {
        type: OptionType.STRING,
        description: "The replacement site name or domain for X post links. Defaults to fixupx.com.",
        default: "fixupx",
        isValid: (value: string) => readXLink(value) !== null || "Enter a site name or domain, such as fixupx.com."
    }
});

export default definePlugin({
    name: "XEmbeds",
    description: "Fixes embeds for X posts by swapping x.com for an embed site when you send a message.",
    authors: [EquicordDevs.rot],
    settings,
    onBeforeMessageSend(_, message) {
        message.content = xEmbeds(message.content, settings.store.replacementhost);
    },
    onBeforeMessageEdit(_channelId, _messageId, message) {
        message.content = xEmbeds(message.content, settings.store.replacementhost);
    }
});
