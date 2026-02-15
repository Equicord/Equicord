/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";
export default definePlugin({
    name: "NoBulletPoints",
    description: t("noBulletPoints.description"),
    authors: [Devs.Samwich],
    onBeforeMessageSend(channelId, msg) {
        msg.content = textProcessing(msg.content);
    },
});

function textProcessing(text: string): string {
    return text.replace(/(^|\n)(\s*)([*+-])\s+/g, "$1$2\\$3 ");
}
