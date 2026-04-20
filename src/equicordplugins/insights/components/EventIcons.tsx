/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";
import { React } from "@webpack/common";

import { cl } from "../store";
import { LogEventType } from "../types";

const iconProps = { xmlns: "http://www.w3.org/2000/svg", height: "18", width: "18" };

const JoinIcon = () =>
    <svg {...iconProps}><g fill="none" fillRule="evenodd"><path d="m18 0h-18v18h18z" /><path d="m0 8h14.2l-3.6-3.6 1.4-1.4 6 6-6 6-1.4-1.4 3.6-3.6h-14.2" fill="currentColor" /></g></svg>;

const LeaveIcon = () =>
    <svg {...iconProps}><g fill="none" fillRule="evenodd"><path d="m18 0h-18v18h18z" /><path d="m3.8 8 3.6-3.6-1.4-1.4-6 6 6 6 1.4-1.4-3.6-3.6h14.2v-2" fill="currentColor" /></g></svg>;

const MoveIcon = () =>
    <svg {...iconProps}><g fill="none" fillRule="evenodd"><path d="m18 0h-18v18h18z" /><path d="m0 8h14.2l-3.6-3.6 1.4-1.4 6 6-6 6-1.4-1.4 3.6-3.6h-14.2" fill="currentColor" /></g></svg>;

const MuteIcon = () =>
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z" fill="currentColor" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
        <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>;

const DeafenIcon = () =>
    <svg {...iconProps} viewBox="0 0 24 24">
        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3v-7zM21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v-7z" fill="currentColor" />
        <path d="M3 14v-2a9 9 0 0 1 18 0v2" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>;

const VideoIcon = () =>
    <svg {...iconProps} viewBox="0 0 24 24">
        <rect x="2" y="6" width="14" height="12" rx="2" fill="currentColor" />
        <path d="M17 9.5l5-3v11l-5-3v-5z" fill="currentColor" />
    </svg>;

const StreamIcon = () =>
    <svg {...iconProps} viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="14" rx="2" fill="currentColor" />
        <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" />
    </svg>;

const iconMap: Record<LogEventType, () => React.ReactNode> = {
    join: JoinIcon,
    leave: LeaveIcon,
    move: MoveIcon,
    server_mute: MuteIcon,
    server_deafen: DeafenIcon,
    self_mute: MuteIcon,
    self_deafen: DeafenIcon,
    self_video: VideoIcon,
    self_stream: StreamIcon,
};

const colorMap: Record<LogEventType, string> = {
    join: "positive",
    leave: "danger",
    move: "warning",
    server_mute: "danger",
    server_deafen: "danger",
    self_mute: "warning",
    self_deafen: "warning",
    self_video: "positive",
    self_stream: "brand",
};

export default function EventIcon({ type }: { type: LogEventType; }) {
    const IconComponent = iconMap[type];
    return <div className={classes(cl("icon"), cl(`icon-${colorMap[type]}`))}><IconComponent /></div>;
}
