/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { openModal } from "@utils/modal";

import { VoiceTimeModal } from "./VoiceTimeModal";

function VoiceTimeIcon({ className }: { className?: string; }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            width={24}
            height={24}
            fill="currentColor"
        >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
        </svg>
    );
}

export function ToolBarButton() {
    return (
        <HeaderBarButton
            tooltip="Voice Time Tracker"
            icon={VoiceTimeIcon}
            onClick={() => openModal(props => <VoiceTimeModal modalProps={props} />)}
        />
    );
}

export { VoiceTimeIcon };
