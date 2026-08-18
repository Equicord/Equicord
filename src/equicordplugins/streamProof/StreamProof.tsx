/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { React, UserStore, useState, useStateFromStores } from "@webpack/common";

const StreamStore = findByPropsLazy("getActiveStreamForUser", "getAllActiveStreams");

const settings = definePluginSettings({
    autoStreamProof: {
        type: OptionType.BOOLEAN,
        description: "Automatically enable StreamProof when you start streaming",
        default: false,
        onChange(value) {
            if (value && isStreaming()) {
                enableStreamProof();
            }
        }
    }
});

let clickHandler: ((e: MouseEvent) => void) | null = null;
let streamProofActive = false;

function isStreaming(): boolean {
    const user = UserStore.getCurrentUser();
    if (!user) return false;

    if (StreamStore.getActiveStreamForUser(user.id)) return true;

    const streams = StreamStore.getAllActiveStreams();
    return streams?.some((s: any) => s.ownerId === user.id) ?? false;
}
function handleStreamChange() {
    if (!settings.store.autoStreamProof) return;

    if (isStreaming()) {
        enableStreamProof();
    } else {
        disableStreamProof();
    }
}

function enableStreamProof() {
    if (streamProofActive) return;
    streamProofActive = true;

    document.body.classList.add("stream-proof-enabled");

    if (!clickHandler) {
        clickHandler = e => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            const selectors = [
                '[class*="messageContent_"]',
                '[class*="markup_"]',
                '[class*="imageWrapper_"]',
                '[class*="embedWrapper_"]',
                '[id^="message-accessories-"] article',
                '[class*="attachment_"]',
                '[class*="video_"]',
                '[class*="voiceMessage_"]',
                '[class*="wrapperPaused_"]',
                '[class*="wrapperPlaying_"]',
                '[class*="audioAttachment_"]',
                '[class*="fileUpload_"]',
                '[class*="wrapperAudio_"]',
                '[class*="mediaBarInteraction_"]',
                '[class*="newMosaicStyle_"]',
                '[class*="stickerAsset_"]',
                '[class*="channel_"][class*="interactive_"]'
            ].join(", ");

            const targetElement = target.closest(selectors);
            if (targetElement && !targetElement.classList.contains("stream-proof-revealed")) {
                targetElement.classList.add("stream-proof-revealed");
                e.preventDefault();
                e.stopPropagation();
            }
        };

        document.addEventListener("click", clickHandler, true);
    }
}

function disableStreamProof() {
    if (!streamProofActive) return;
    streamProofActive = false;

    document.body.classList.remove("stream-proof-enabled");

    if (clickHandler) {
        document.removeEventListener("click", clickHandler, true);
        clickHandler = null;
    }

    document.querySelectorAll(".stream-proof-revealed").forEach(el => {
        el.classList.remove("stream-proof-revealed");
    });
}

function EyeIcon() {
    return (
        <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path
                fill="currentColor"
                d="M12 5C5.648 5 1 12 1 12s4.648 7 11 7 11-7 11-7-4.648-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
            />
        </svg>
    );
}

function EyeSlashIcon() {
    return (
        <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path
                fill="currentColor"
                d="M2.22 2.22a.75.75 0 0 1 1.06 0l18.5 18.5a.75.75 0 1 1-1.06 1.06l-3.56-3.56A11.18 11.18 0 0 1 12 19C5.648 19 1 12 1 12s1.81-2.73 4.69-4.95L2.22 3.28a.75.75 0 0 1 0-1.06ZM7.1 8.52A8.87 8.87 0 0 0 3.07 12 9.57 9.57 0 0 0 12 17c1.47 0 2.85-.34 4.1-.93l-1.7-1.7A3 3 0 0 1 10.63 10.6L7.1 8.52ZM12 5c1.92 0 3.7.52 5.25 1.37l-1.5 1.5A8.87 8.87 0 0 0 20.93 12a9.57 9.57 0 0 1-3.37 3.44l1.5 1.5C21.42 15.2 23 12 23 12s-4.648-7-11-7Z"
            />
        </svg>
    );
}

const StreamProofButton: ChatBarButtonFactory = ({ isMainChat }) => {
    useStateFromStores([StreamStore], () => isStreaming());
    const [enabled, setEnabled] = useState(streamProofActive);

    if (!isMainChat) return null;

    function toggle() {
        if (streamProofActive) {
            disableStreamProof();
            setEnabled(false);
        } else {
            enableStreamProof();
            setEnabled(true);
        }
    }

    const tooltip = enabled
        ? "StreamProof : ON — click to disable"
        : "StreamProof : OFF — click to enable";

    return (
        <ChatBarButton tooltip={tooltip} onClick={toggle}>
            <span style={{ color: enabled ? "var(--status-danger)" : "currentColor" }}>
                {enabled ? <EyeSlashIcon /> : <EyeIcon />}
            </span>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "StreamProof",
    description: "Hides messages, links, images, DMs, but not the screen share/voice grid. Toggle via chat bar button.",
    authors: [EquicordDevs.noxify],
    dependencies: ["ChatInputButtonAPI"],
    enabledByDefault: true,
    settings,

    chatBarButton: {
        icon: EyeSlashIcon,
        render: StreamProofButton
    },

   flux: {
    STREAM_START: handleStreamChange,
    STREAM_STOP: handleStreamChange,
    STREAM_CREATE: handleStreamChange,
    STREAM_DELETE: handleStreamChange
},

    start() {
        if (settings.store.autoStreamProof && isStreaming()) {
            enableStreamProof();
        }
    },

    stop() {
        disableStreamProof();
    }
});
