/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { IconComponent } from "@utils/types";
import { React } from "@webpack/common";

import { openViewScheduledModal } from "./index";

export let isScheduleModeEnabled = false;
export let setScheduleModeEnabled: (enabled: boolean) => void = () => { };

export const CalendarIcon: IconComponent = ({ height = 20, width = 20, className, color }) => (
    <svg
        aria-hidden="true"
        role="img"
        width={width}
        height={height}
        className={className}
        viewBox="0 0 24 24"
        style={{ scale: "1.2" }}
    >
        <g fill="none" fillRule="evenodd">
            <path
                fill={color || "currentColor"}
                d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"
            />
            <rect width="24" height="24" />
        </g>
    </svg>
);

export const TimerIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg
        aria-hidden="true"
        role="img"
        width={width}
        height={height}
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
    >
        <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0 0 12 4c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
    </svg>
);

export const ScheduledMessagesButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const [enabled, setEnabled] = React.useState(isScheduleModeEnabled);

    React.useEffect(() => {
        setScheduleModeEnabled = (value: boolean) => {
            isScheduleModeEnabled = value;
            setEnabled(value);
        };
        return () => {
            setScheduleModeEnabled = () => { };
        };
    }, []);

    if (!isMainChat) return null;

    const toggleScheduleMode = () => {
        const newValue = !enabled;
        isScheduleModeEnabled = newValue;
        setEnabled(newValue);
    };

    return (
        <ChatBarButton
            tooltip={enabled ? "Schedule Mode ON (click to disable, right-click for list)" : "Schedule Mode OFF (click to enable, right-click for list)"}
            onClick={toggleScheduleMode}
            onContextMenu={e => {
                e.preventDefault();
                openViewScheduledModal();
            }}
            buttonProps={{
                "aria-haspopup": "dialog"
            }}
        >
            <CalendarIcon color={enabled ? "var(--status-positive)" : undefined} />
        </ChatBarButton>
    );
};
