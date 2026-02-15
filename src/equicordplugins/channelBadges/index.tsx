/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { Devs, EquicordDevs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { GuildStore, React, SelectedGuildStore } from "@webpack/common";
import { JSX } from "react";

import { isEnabled, returnChannelBadge, settings } from "./settings";

function renderBadge(id: number, title: string) {
    const { css, label, color } = returnChannelBadge(id);

    return (
        <div
            key={id}
            className={`channel-badge channel-badge-${css}`}
            style={color ? { backgroundColor: color } : undefined}
            title={title}
        >
            {label}
        </div>
    );
}

export default definePlugin({
    name: "ChannelBadges",
    description: t("channelBadges.description"),
    authors: [EquicordDevs.creations, Devs.thororen],
    settings,
    patches: [
        // TY TypingIndicator
        // Normal Channels
        {
            find: "UNREAD_IMPORTANT:",
            replacement: {
                match: /\.Children\.count.+?:null(?<=,channel:(\i).+?)/,
                replace: "$&,$self.renderChannelBadges($1)"
            }
        },
        // Threads
        {
            find: "18V16H9v2H6Zm3",
            replacement: {
                match: /mentionsCount:\i.+?null(?<=channel:(\i).+?)/,
                replace: "$&,$self.renderChannelBadges($1)"
            }
        }
    ],
    renderChannelBadges(channel: Channel) {
        if (!channel || !isEnabled(channel.type)) return null;

        const { type, nsfw, threadMetadata } = channel;
        const isPrivate = channel.isPrivate() || threadMetadata?.locked || channel.isArchivedThread();
        const isNSFW = nsfw || channel.isNSFW();

        const selectedGuildId = SelectedGuildStore.getGuildId();
        const guild = selectedGuildId ? GuildStore.getGuild(selectedGuildId) : null;

        const badgeConditions = [
            { id: 6101, condition: isPrivate, title: t("channelBadges.tooltips.lockedChannel") },
            { id: 6100, condition: isNSFW, title: t("channelBadges.tooltips.nsfwChannel") },
            { id: 6102, condition: guild?.rulesChannelId === channel.id, title: t("channelBadges.tooltips.rulesChannel") },
        ];

        let badges: JSX.Element[] = [];

        if (settings.store.oneBadgePerChannel) {
            const first = badgeConditions.find(({ id, condition }) => condition && isEnabled(id));
            if (first) {
                badges.push(renderBadge(first.id, first.title));
            } else {
                badges.push(renderBadge(type, returnChannelBadge(type).label));
            }
        } else {
            badges = badgeConditions
                .filter(({ id, condition }) => condition && isEnabled(id))
                .map(({ id, title }) => renderBadge(id, title));

            badges.push(renderBadge(type, returnChannelBadge(type).label));
        }

        return <div className="badge-container">{badges}</div>;
    }
});
