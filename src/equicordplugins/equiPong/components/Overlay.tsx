/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { React } from "@webpack/common";

import { Game } from "./Game";

const cl = classNameFactory("emoji-pong-");

interface OverlayProps {
    onClose: () => void;
    startEmoji: {
        type: "text"; value: string;
        channelId?: string; contextId?: string; messageId?: string;
    } | {
        type: "image"; url: string; alt?: string;
        channelId?: string; contextId?: string; messageId?: string;
    } | null;
}

export function Overlay({ onClose, startEmoji }: OverlayProps) {
    return (
        <div className={cl("overlay")}
            role="dialog"
            aria-label="Equipong"
        >
            <Game onClose={onClose} startEmoji={startEmoji} />
        </div>
    );
}
