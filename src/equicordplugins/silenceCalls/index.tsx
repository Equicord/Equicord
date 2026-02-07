/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { IconComponent, OptionType, ReporterTestable } from "@utils/types";
import { FluxDispatcher, React } from "@webpack/common";

const logger = new Logger("SilenceCalls");

const settings = definePluginSettings({
    restoreNotifications: {
        type: OptionType.BOOLEAN,
        description: "Disable notifications on deactivate",
        default: true
    },
    restoreSounds: {
        type: OptionType.BOOLEAN,
        description: "Disable sounds on deactivate",
        default: true
    },
    restoreContentProtection: {
        type: OptionType.BOOLEAN,
        description: "Hide Discord from screen capture on deactivate",
        default: false
    },
    restoreHideInvites: {
        type: OptionType.BOOLEAN,
        description: "Hide instant invites on deactivate",
        default: true
    },
    restoreHidePersonalInfo: {
        type: OptionType.BOOLEAN,
        description: "Hide personal information on deactivate",
        default: true
    },
    restoreAutoToggle: {
        type: OptionType.BOOLEAN,
        description: "Enable auto-toggle on deactivate",
        default: false
    }
});

const SilenceCallsIcon: IconComponent = ({ height = 20, width = 20, className, children }) => {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 24 24"
            className={className}
            style={{ scale: "1.2" }}
        >
            <path fill="currentColor" mask="url(#vc-silence-calls-mask)" d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-1.99 2H19.99L18 16z" />
            {children}
        </svg>
    );
};

function SilenceCallsDisabledIcon() {
    return (
        <SilenceCallsIcon>
            <mask id="vc-silence-calls-mask">
                <path fill="#fff" d="M0 0h24v24H0Z" />
                <path stroke="#000" strokeWidth="5.99068" d="M0 24 24 0" />
            </mask>
            <path fill="var(--status-danger)" d="m21.178 1.70703 1.414 1.414L4.12103 21.593l-1.414-1.415L21.178 1.70703Z" />
        </SilenceCallsIcon>
    );
}

let timer: ReturnType<typeof setTimeout> | null = null;
let bannerStyle: HTMLStyleElement | null = null;

function setStreamerMode(value: boolean) {
    try {
        void FluxDispatcher.dispatch({
            type: "STREAMER_MODE_UPDATE",
            key: "enabled",
            value
        });
    } catch (e) {
        logger.error("Failed to toggle streamer mode", e);
    }
}

function applySettings(s: Record<string, boolean>) {
    try {
        for (const [k, v] of Object.entries(s)) {
            void FluxDispatcher.dispatch({
                type: "STREAMER_MODE_UPDATE",
                key: k,
                value: v
            });
        }
    } catch (e) {
        logger.error("Failed to apply settings", e);
    }
}

function setBannerHidden(hide: boolean) {
    if (hide) {
        if (bannerStyle) return;
        bannerStyle = document.createElement("style");
        bannerStyle.id = "vc-silence-calls-banner";
        bannerStyle.textContent = "[class*=\"notice\"][class*=\"colorStreamerMode\"] { display: none !important; }";
        document.head.appendChild(bannerStyle);
    } else {
        bannerStyle?.remove();
        bannerStyle = null;
    }
}

function deactivate() {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }

    setStreamerMode(false);
    applySettings({
        disableNotifications: settings.store.restoreNotifications,
        disableSounds: settings.store.restoreSounds,
        enableContentProtection: settings.store.restoreContentProtection,
        hideInstantInvites: settings.store.restoreHideInvites,
        hidePersonalInformation: settings.store.restoreHidePersonalInfo,
        autoToggle: settings.store.restoreAutoToggle
    });

    setBannerHidden(false);
}

const SilenceButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const [active, setActive] = React.useState(false);

    if (!isMainChat) return null;

    const onClick = () => {
        if (active) {
            deactivate();
            setActive(false);
            return;
        }

        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        applySettings({
            disableNotifications: false,
            disableSounds: true,
            enableContentProtection: false,
            hideInstantInvites: false,
            hidePersonalInformation: false
        });

        setStreamerMode(true);
        setBannerHidden(true);
        setActive(true);

        timer = setTimeout(() => {
            deactivate();
            setActive(false);
            timer = null;
        }, 35000);
    };

    return (
        <ChatBarButton
            key={active ? "active" : "inactive"}
            tooltip={active ? "Deactivate SilenceCalls" : "Activate SilenceCalls"}
            onClick={onClick}
        >
            {active ? <SilenceCallsDisabledIcon /> : <SilenceCallsIcon />}
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "SilenceCalls",
    description: "Adds a bell icon in the chat bar that lets you silence a call.",
    authors: [EquicordDevs.YONN2222],
    reporterTestable: ReporterTestable.None,
    settings,

    chatBarButton: {
        icon: SilenceCallsIcon,
        render: SilenceButton
    },

    stop() {
        deactivate();
    }
});
