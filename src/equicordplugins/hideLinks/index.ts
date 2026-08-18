/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const DEFAULT_LABEL = "\u{E0132}";

const mediaExtensionRegex = /\.(?:png|jpe?g|gifv?|webp|avif|bmp|tiff?|svg|mp4|webm|mov|m4v|mkv|avi|wmv|flv|ogv|mp3|m4a|aac|ogg|oga|opus|wav|flac)(?:[?#].*)?$/i;

const linkRegex = /```[\s\S]*?(?:```|$)|`[^`\n]+`|\[[^\]]*\]\(<(https?:\/\/[^<>\s]+)>\)|\[[^\]]*\]\((https?:\/\/[^<>\s]+?)\)|<(https?:\/\/[^<>\s]+)>|\bhttps?:\/\/[^\s[\]<>]+/g;

const settings = definePluginSettings({
    applyToAllLinks: {
        type: OptionType.BOOLEAN,
        description: "Hide the hyperlink label of every link, not just media links",
        default: false
    },
    useCustomCharacter: {
        type: OptionType.BOOLEAN,
        description: "Use a custom character as the hyperlink label instead of Variation Selector-67 (U+E0132)",
        default: false
    },
    customCharacter: {
        type: OptionType.STRING,
        description: "The character used as the hyperlink label when the custom character option is enabled",
        default: DEFAULT_LABEL,
        hidden() { return !this.store.useCustomCharacter; },
        isValid(value: string) {
            if (!value) return "The hyperlink label character cannot be empty";
            return true;
        }
    },
    onlyMatchingLinks: {
        type: OptionType.STRING,
        description: "Only hide links matching these patterns, one per line. Each line is either a JavaScript regular expression (e.g. .*\\.mp4$) or a glob where * matches anything (e.g. *.mp4). Patterns match the link without its query string or fragment. Leave empty to hide all media links (or every link when the apply-to-all option is enabled).",
        default: "",
        multiline: true,
        placeholder: "*.mp4\n.*discord(?:app)?\\.net.*"
    }
});

let cachedPattern: string | null = null;
let filters: RegExp[] = [];

function recompileFilters(pattern: string) {
    cachedPattern = pattern;
    filters = pattern.split("\n")
        .map(line => {
            line = line.trim();
            if (!line) return null;

            try {
                return new RegExp(line, "i");
            } catch { }

            try {
                return new RegExp(`^${line.replace(/[\\^$.|?+()[\]{}]/g, "\\$&").replaceAll("*", ".*")}$`, "i");
            } catch {
                return null;
            }
        })
        .filter((filter): filter is RegExp => filter != null);
}

function trimBareUrl(url: string) {
    let end = url.length;
    for (;;) {
        if (end === 0) break;

        const char = url[end - 1];
        if (".,;:!?'\"".includes(char)) {
            end--;
            continue;
        }

        if (char === ")") {
            const before = url.slice(0, end);
            if (before.split(")").length <= before.split("(").length) break;
            end--;
            continue;
        }

        break;
    }

    return url.slice(0, end);
}

export default definePlugin({
    name: "HideLinks",
    description: "Hides the hyperlink label of media links with an invisible character (Variation Selector-67, U+E0132)",
    searchTerms: ["invisible", "hyperlink", "masked", "media", "e0132"],
    tags: ["Chat", "Privacy", "Customisation"],
    authors: [EquicordDevs.nickname],
    dependencies: ["MessageEventsAPI"],

    settings,

    hideLinks(content: string) {
        const label = settings.store.useCustomCharacter && settings.store.customCharacter
            ? settings.store.customCharacter
            : DEFAULT_LABEL;

        const pattern = settings.store.onlyMatchingLinks;
        if (pattern !== cachedPattern) recompileFilters(pattern);

        return content.replace(linkRegex, (match, maskedAngleUrl, maskedUrl, autolinkUrl) => {
            if (match.startsWith("`")) return match;

            let url = maskedAngleUrl ?? maskedUrl ?? autolinkUrl ?? match;
            let trailing = "";
            if (!maskedAngleUrl && !maskedUrl && !autolinkUrl) {
                url = trimBareUrl(url);
                trailing = match.slice(url.length);
            }

            if (!settings.store.applyToAllLinks && !mediaExtensionRegex.test(url)) return match;
            const filterTarget = url.replace(/[?#].*$/, "");
            if (filters.length && !filters.some(filter => filter.test(filterTarget))) return match;

            return url.includes(")") ? `[${label}](<${url}>)${trailing}` : `[${label}](${url})${trailing}`;
        });
    },

    onBeforeMessageSend(_: string, messageObj: MessageObject) {
        messageObj.content = this.hideLinks(messageObj.content);
    },

    onBeforeMessageEdit(_: string, __: string, messageObj: MessageObject) {
        messageObj.content = this.hideLinks(messageObj.content);
    }
});
