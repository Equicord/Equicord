/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    replace: {
        type: OptionType.STRING,
        description: t("questionMarkReplacement.settings.replace"),
        default: ":face_with_monocle:"
    },
});

function replaceQuestionMarks(content: string): string {
    const allQuestionMarks = content.split("").every(char => char === "?");

    if (allQuestionMarks) {
        return content.replace(/\?/g, settings.store.replace);
    } else {
        return content;
    }
}

export default definePlugin({
    name: "QuestionMarkReplacement",
    description: t("questionMarkReplacement.description"),
    authors: [Devs.nyx],

    settings,

    start() {
        this.preSend = addMessagePreSendListener((_, msg) => {
            msg.content = replaceQuestionMarks(msg.content);
        });
    },

    stop() {
        removeMessagePreSendListener(this.preSend);
    }
});
