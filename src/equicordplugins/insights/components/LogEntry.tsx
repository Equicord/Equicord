/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openUserProfile } from "@utils/discord";
import { IconUtils, Timestamp, Tooltip, UserStore } from "@webpack/common";

import { cl } from "../store";
import { LogEntry } from "../types";
import EventIcon from "./EventIcons";

function getEventDescription(entry: LogEntry): string {
    switch (entry.type) {
        case "join": return "Joined the channel";
        case "leave": return "Left the channel";
        case "move":
            if (entry.newChannelId && entry.oldChannelId && entry.channelId === entry.oldChannelId)
                return "Moved to another channel";
            return "Moved from another channel";
        case "server_mute": return entry.enabled ? "Server muted" : "Server unmuted";
        case "server_deafen": return entry.enabled ? "Server deafened" : "Server undeafened";
        case "self_mute": return entry.enabled ? "Muted" : "Unmuted";
        case "self_deafen": return entry.enabled ? "Deafened" : "Undeafened";
        case "self_video": return entry.enabled ? "Turned on camera" : "Turned off camera";
        case "self_stream": return entry.enabled ? "Started screensharing" : "Stopped screensharing";
    }
}

export function LogEntryComponent({ entry }: { entry: LogEntry; }) {
    const user = UserStore.getUser(entry.userId);
    const username = user?.globalName ?? user?.username ?? "Unknown";

    return (
        <li className={cl("entry")}>
            <div className={cl("entry-timestamp")}>
                <Timestamp className={cl("timestamp")} timestamp={new Date(entry.timestamp)} compact isInline={false} cozyAlt />
            </div>
            <EventIcon type={entry.type} />
            <Tooltip text={username}>
                {tooltipProps => (
                    <img
                        {...tooltipProps}
                        className={cl("avatar")}
                        onClick={() => openUserProfile(entry.userId)}
                        src={user ? user.getAvatarURL(undefined, 32) : IconUtils.getDefaultAvatarURL(entry.userId)}
                        alt={username}
                    />
                )}
            </Tooltip>
            <div className={cl("log-content")}>
                <span className={cl("log-username")} onClick={() => openUserProfile(entry.userId)}>{username}</span>
                <span className={cl("log-description")}>{getEventDescription(entry)}</span>
            </div>
        </li>
    );
}
