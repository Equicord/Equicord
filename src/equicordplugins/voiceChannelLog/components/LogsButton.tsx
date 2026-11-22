/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { ChannelStore, SelectedChannelStore, useStateFromStores } from "@webpack/common";

import { cl } from "../utils";
import { openVoiceChannelLog } from "./VoiceChannelLogModal";

function LogIcon({ height = 24, width = 24 }: { height?: number; width?: number; }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            height={height}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
            <path d="M16 9a5 5 0 0 1 0 6" />
            <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
        </svg>
    );
}

export function OpenLogsButton() {
    const voiceChannelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId());

    if (!voiceChannelId) return null;

    const channel = ChannelStore.getChannel(voiceChannelId);
    if (!channel) return null;

    return (
        <HeaderBarButton
            className={cl("toolbar-btn")}
            onClick={() => openVoiceChannelLog(channel)}
            tooltip="Voice Channel Logs"
            icon={LogIcon}
        />
    );
}

export { LogIcon };
