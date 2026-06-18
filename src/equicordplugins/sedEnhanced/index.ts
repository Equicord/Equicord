/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { MessageActions, MessageStore, PendingReplyStore, UserStore } from "@webpack/common";

const sedRegex = /^s(?<sep>[/|$#@!])(?<match>(?!\1)(?:(?![^\\]\1).)*.|)\1(?<replace>(?!\1)(?:(?![^\\]\1).)*.|)\1?(?<modes>[rgmisudyv]*)$/;

const settings = definePluginSettings({
    regexByDefault: {
        description: "Inverts the `r` flag, so using the `r` flag enables non-regex mode, and omitting it uses regex mode.",
        type: OptionType.BOOLEAN,
        default: false
    }
});

export default definePlugin({
    name: "SedEnhanced",
    description: "Expands on Discord's rudimentary `sed` support.",
    authors: [EquicordDevs.dawn, EquicordDevs.Willow, EquicordDevs.kat],
    patches: [
        {
            find: "searchReplace:{",
            replacement: {
                match: /searchReplace:\{match:(\i\(\))\.anyScopeRegex.{0,256}?action\(.{0,8}?\)\{.{0,600}?\}{3},/g,
                replace: "searchReplace:{match:$1.anyScopeRegex($self.sedRegex),action:$self.searchReplace},"
            }
        }
    ],
    settings,
    sedRegex,
    searchReplace(content, { isEdit, channel }) {
        if (isEdit) return;
        let toEdit: Message | null | undefined = null;
        const currentReply = PendingReplyStore.getPendingReply(channel.id)?.message;
        if (currentReply) {
            toEdit = currentReply;
            if (currentReply.author.id !== UserStore.getCurrentUser()?.id) return { content: "" };
        } else {
            toEdit = MessageStore.getLastEditableMessage(channel.id);
        }
        if (toEdit == null || toEdit.id == null) {
            return { content: "" };
        }
        const contentMatch = content.match(sedRegex);
        if (
            contentMatch?.groups?.match == null || contentMatch?.groups?.match === undefined ||
            contentMatch?.groups?.replace == null || contentMatch?.groups?.replace === undefined ||
            contentMatch?.groups?.modes == null || contentMatch?.groups?.modes === undefined
        ) return;
        let { match, replace, modes } = contentMatch.groups;
        const flags = modes?.split("") ?? [];
        const regexMode = flags.includes("r") !== settings.store.regexByDefault;
        if (!regexMode) {
            const thisIsntRegex = /\\([*?+/])/g;
            match = match.replace(thisIsntRegex, (_, x) => x);
            replace = replace.replace(thisIsntRegex, (_, x) => x);
        }

        let find: string | RegExp = match;
        let replaced = toEdit.content;
        if (regexMode) {
            try {
                find = new RegExp(match, "gmisudyv".split("").filter(f => flags.includes(f)).join(""));
            } catch { return { content: "" }; }
        }
        if (flags.includes("g")) {
            replaced = replaced.replaceAll(find, replace);
        } else {
            replaced = replaced.replace(find, replace);
        }

        if ((replaced == null || replaced.trim() === "") && toEdit.attachments.length === 0) {
            MessageActions.deleteMessage(channel.id, toEdit.id);
        } else if (replaced !== toEdit.content) {
            MessageActions.editMessage(channel.id, toEdit.id, { content: replaced });
        }
        return { content: "" };
    },
});
