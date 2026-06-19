/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
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
            find: ".SLASH_COMMAND_USED,{",
            replacement: {
                match: /searchReplace:\{match:(\i\(\)\.anyScopeRegex)/,
                replace: "searchReplace:{match:$1($self.sedRegex),action:$self.searchReplace},_eq_$&"
            }
        }
    ],
    settings,
    sedRegex,
    searchReplace(content, { isEdit, channel }) {
        if (isEdit) return;

        const pendingReply = PendingReplyStore.getPendingReply(channel.id)?.message;
        const toEdit = pendingReply ?? MessageStore.getLastEditableMessage(channel.id);
        if (pendingReply && pendingReply.author.id !== UserStore.getCurrentUser()?.id || toEdit?.id == null) return { content: "" };

        const groups = content.match(sedRegex)?.groups;
        if (groups?.match == null || groups?.replace == null || groups?.modes == null) return;

        let { match: pattern, replace, modes } = groups;
        const flags = modes.split("");
        const isRegex = flags.includes("r") !== settings.store.regexByDefault;

        if (!isRegex) {
            const escapeChars = /\\([*?+/])/g;
            pattern = pattern.replace(escapeChars, (_, x) => x);
            replace = replace.replace(escapeChars, (_, x) => x);
        }

        let find: string | RegExp = pattern;
        if (isRegex) {
            try {
                const regexFlags = flags.filter(f => "gmisudyv".includes(f)).join("");
                find = new RegExp(pattern, regexFlags);
            } catch {
                return { content: "" };
            }
        }

        const replaced = flags.includes("g") ? toEdit.content.replaceAll(find, replace) : toEdit.content.replace(find, replace);
        if (!replaced.trim() && toEdit.attachments.length === 0) {
            MessageActions.deleteMessage(channel.id, toEdit.id);
        } else if (replaced !== toEdit.content) {
            MessageActions.editMessage(channel.id, toEdit.id, { content: replaced });
        }

        return { content: "" };
    }
});
