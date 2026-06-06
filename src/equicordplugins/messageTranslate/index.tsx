/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { updateMessage } from "@api/MessageUpdater";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { ChannelStore, UserStore } from "@webpack/common";
import type { ReactNode } from "react";

import { getIgnoredChannels, getIgnoredGuilds, getIgnoredUsers, settings } from "./settings";
import { MessageWithContent } from "./types";
import { clearCache, getCached, hasFailed, isInProgress, translate } from "./utils/translate";

const cl = classNameFactory("mt-");
const translatedMessages = new Map<string, string>();

function shouldTranslate(message: MessageWithContent): boolean {
    if (!message.content || typeof message.content !== "string") return false;
    if (hasFailed(message.id, message.content)) return false;

    if (settings.store.skipOwnMessages) {
        const currentUserId = UserStore.getCurrentUser()?.id;
        if (currentUserId && message.author?.id === currentUserId) return false;
    }

    if (settings.store.skipBotMessages && message.author?.bot) return false;
    if (message.author && getIgnoredUsers().has(message.author.id)) return false;
    if (message.channel_id && getIgnoredChannels().has(message.channel_id)) return false;

    const guildId = message.channel_id ? ChannelStore.getChannel(message.channel_id)?.guild_id : null;
    if (guildId && getIgnoredGuilds().has(guildId)) return false;

    return true;
}

function triggerReRender(message: MessageWithContent) {
    updateMessage(message.channel_id, message.id);
}

export default definePlugin({
    name: "MessageTranslate",
    description: "Auto translate messages to your language with caching, per-channel toggles, and more options.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.creations],
    dependencies: ["MessageUpdaterAPI"],
    settings,

    patches: [
        {
            find: '.CUSTOM_GIFT?""',
            replacement: [
                {
                    match: /(message:(\i),message:\{id:\i\},channel:\i,channel:\{id:\i\}.{0,140}renderContentOnly:\i,hideInviteEmbedBanner:\i\}=\i;)/,
                    replace: "$1$2=$self.transformMessage($2);",
                },
                {
                    match: /childrenMessageContent:(\i),onMouseMove:/g,
                    replace: "childrenMessageContent:$self.wrapContent($1,arguments[0].message.id),onMouseMove:",
                },
            ],
        },
    ],

    transformMessage(message: MessageWithContent): MessageWithContent {
        if (!settings.store.autoTranslate || !shouldTranslate(message)) {
            translatedMessages.delete(message.id);
            return message;
        }

        const cached = getCached(message.id);
        if (cached) {
            if (cached.original !== message.content) {
                clearCache(message.id);
                translatedMessages.delete(message.id);
                return message;
            }

            translatedMessages.set(message.id, cached.sourceLang);
            return Object.assign(Object.create(Object.getPrototypeOf(message)), message, {
                content: cached.translated,
            }) as MessageWithContent;
        }

        translatedMessages.delete(message.id);
        if (!isInProgress(message.id)) {
            translate(message.id, message.content).then(result => {
                if (result) triggerReRender(message);
            });
        }

        return message;
    },

    wrapContent(content: ReactNode, messageId: string): ReactNode {
        const sourceLang = translatedMessages.get(messageId);
        if (!sourceLang) return content;
        return (
            <>
                {content}
                {settings.store.showIndicator && (
                    <div className={cl("indicator")}>translated from {sourceLang}</div>
                )}
            </>
        );
    },
});
