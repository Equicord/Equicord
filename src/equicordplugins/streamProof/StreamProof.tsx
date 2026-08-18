/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { React, UserStore, useStateFromStores } from "@webpack/common";

const StreamStore = findByPropsLazy("getActiveStreamForUser", "getAllActiveStreams");
const cl = classNameFactory("vc-streamproof-");

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Whether StreamProof is currently enabled",
        default: false,
        hidden: true
    },

    blurMessages: {
        type: OptionType.BOOLEAN,
        description: "Blur message text",
        default: true
    },

    blurMedia: {
        type: OptionType.BOOLEAN,
        description: "Blur images, videos, embeds and attachments",
        default: true
    },

    blurDMs: {
        type: OptionType.BOOLEAN,
        description: "Blur direct messages in the DM list",
        default: true
    },

    blurProfileBio: {
        type: OptionType.BOOLEAN,
        description: "Blur profile bios",
        default: true
    },

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

let autoEnabledStreamProof = false;
function isStreaming(): boolean {
    const user = UserStore.getCurrentUser();
    if (!user) return false;

    return Boolean(StreamStore.getActiveStreamForUser(user.id));
}

function handleStreamChange() {
    if (!settings.store.autoStreamProof) return;

    if (isStreaming()) {
        if (!settings.store.enabled) {
            enableStreamProof();
            autoEnabledStreamProof = true;
        }
    } else if (autoEnabledStreamProof) {
        disableStreamProof();
        autoEnabledStreamProof = false;
    }
}

function enableStreamProof() {
    settings.store.enabled = true;
}

function disableStreamProof() {
    settings.store.enabled = false;
}

function StreamProofContentRevealed({ children }: { children: React.ReactNode }) {
    const [revealed, setRevealed] = React.useState(false);

    return (
        <span
            className={cl(revealed ? "revealed" : "blurred")}
            onClick={() => setRevealed(true)}
        >
            {children}
        </span>
    );
}

function StreamProofContent({ children }: { children: React.ReactNode }) {
    const { enabled, blurMessages } = settings.use(["enabled", "blurMessages"]);

    if (!enabled || !blurMessages) return children;

    return <StreamProofContentRevealed>{children}</StreamProofContentRevealed>;
}

function StreamProofMediaRevealed({ children }: { children: React.ReactNode }) {
    const [revealed, setRevealed] = React.useState(false);

    return (
        <div
            className={cl(revealed ? "revealed" : "media-blurred")}
            onClickCapture={e => {
                if (!revealed) {
                    e.preventDefault();
                    e.stopPropagation();
                    setRevealed(true);
                }
            }}
        >
            {children}
        </div>
    );
}

function StreamProofMedia({ children }: { children: React.ReactNode }) {
    const { enabled, blurMedia } = settings.use(["enabled", "blurMedia"]);

    if (!enabled || !blurMedia) return children;

    return <StreamProofMediaRevealed>{children}</StreamProofMediaRevealed>;
}

function StreamProofDMRevealed({ children }: { children: React.ReactNode }) {
    const [revealed, setRevealed] = React.useState(false);

    return (
        <div
            className={cl(revealed ? "revealed" : "blurred")}
            onClickCapture={e => {
                if (!revealed) {
                    e.preventDefault();
                    e.stopPropagation();
                    setRevealed(true);
                }
            }}
        >
            {children}
        </div>
    );
}

function StreamProofDM({ children }: { children: React.ReactNode }) {
    const { enabled, blurDMs } = settings.use(["enabled", "blurDMs"]);

    if (!enabled || !blurDMs) return children;

    return <StreamProofDMRevealed>{children}</StreamProofDMRevealed>;
}

function StreamProofBioRevealed({ children }: { children: React.ReactNode }) {
    const [revealed, setRevealed] = React.useState(false);

    return (
        <span
            className={cl(revealed ? "revealed" : "blurred")}
            onClick={() => setRevealed(true)}
        >
            {children}
        </span>
    );
}

function StreamProofBio({ children }: { children: React.ReactNode }) {
    const { enabled, blurProfileBio } = settings.use(["enabled", "blurProfileBio"]);

    if (!enabled || !blurProfileBio) return children;

    return <StreamProofBioRevealed>{children}</StreamProofBioRevealed>;
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
    const { enabled } = settings.use(["enabled"]);

    if (!isMainChat) return null;

    function toggle() {
        if (settings.store.enabled) {
            disableStreamProof();
        } else {
            enableStreamProof();
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

    patches: [
        {
            find: '.CUSTOM_GIFT?""',
            replacement: {
                match: /childrenMessageContent:(\i),/g,
                replace: "childrenMessageContent:$self.wrapContent($1),"
            }
        },
        {
            find: "this.renderAttachments(",
            replacement: {
                match: /(?<=\i=)this\.render(?:Attachments|Embeds|StickersAccessories|ComponentAccessories)\((\i)\)/g,
                replace: "$self.wrapMedia($&)"
            }
        },
        {
            find: "parseBioReact",
            replacement: {
                match: /\(0,\i\.parseBioReact\)\((\i)\)/,
                replace: "$self.wrapBio($&)"
            }
        },
        {
            find: "PrivateChannel.renderAvatar",
            replacement: {
                match: /(?<=children:)(\(0,\i\.jsx\)\(\i\.\i,\{ref:\i,avatar:.*?withDisplayNameStyles:\i\}\))/,
                replace: "$self.wrapDM($1)"
            }
        }
    ],

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

    wrapContent(content: React.ReactNode) {
        return <StreamProofContent>{content}</StreamProofContent>;
    },

    wrapMedia(content: React.ReactNode) {
        return <StreamProofMedia>{content}</StreamProofMedia>;
    },

    wrapBio(content: React.ReactNode) {
        return <StreamProofBio>{content}</StreamProofBio>;
    },

    wrapDM(content: React.ReactNode) {
        return <StreamProofDM>{content}</StreamProofDM>;
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
