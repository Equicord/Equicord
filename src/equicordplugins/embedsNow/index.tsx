/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings, Settings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { IconProps, OptionType, PluginSettingComponentDef } from "@utils/types";

import { rewriteLinks, Site, SITES } from "./links";

interface SiteSetting {
    type: OptionType.BOOLEAN;
    displayName: string;
    description: string;
    default: boolean;
}

const siteSettings = Object.fromEntries(Object.entries(SITES).map(([site, { name, description }]) => [site, {
    type: OptionType.BOOLEAN,
    displayName: name,
    description,
    default: true
} satisfies SiteSetting])) as Record<Site, SiteSetting>;

function section(title: string): PluginSettingComponentDef {
    return {
        type: OptionType.COMPONENT,
        component: () => (
            <div className={Margins.top16}>
                <Divider className={Margins.bottom16} />
                <Heading tag="h3">{title}</Heading>
            </div>
        )
    };
}

const settings = definePluginSettings({
    generalSection: section("General"),
    showToggleButton: {
        type: OptionType.BOOLEAN,
        description: "Show a chat bar button that turns embeds.now links on and off. While it is hidden, links always use embeds.now.",
        default: false
    },
    embedLinks: {
        type: OptionType.BOOLEAN,
        description: "Send supported links through embeds.now. Controlled by the chat bar button.",
        default: true,
        hidden: true
    },
    stripTracking: {
        type: OptionType.BOOLEAN,
        description: "Remove tracking parameters from supported links.",
        default: true
    },
    shortLinks: {
        type: OptionType.BOOLEAN,
        description: "Use short addresses like x.embeds.now instead of embeds.now/x.com.",
        default: true
    },
    sitesSection: section("Sites"),
    ...siteSettings
});

const BUTTON_KEYS: ("embedLinks" | "showToggleButton")[] = ["embedLinks", "showToggleButton"];
const LINK_ICON_PATH = "M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.43l-.47.47a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z";

function EmbedsNowIcon({ height = 20, width = 20, className, disabled }: IconProps & { disabled?: boolean; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" className={className}>
            <path fill="currentColor" mask={disabled ? "url(#vc-embeds-now-mask)" : undefined} d={LINK_ICON_PATH} />
            {disabled ? (
                <>
                    <mask id="vc-embeds-now-mask">
                        <path fill="#fff" d="M0 0h24v24H0Z" />
                        <path stroke="#000" strokeWidth="5.99068" d="M0 24 24 0" />
                    </mask>
                    <path fill="var(--status-danger)" d="m21.178 1.70703 1.414 1.414L4.12103 21.593l-1.414-1.415L21.178 1.70703Z" />
                </>
            ) : null}
        </svg>
    );
}

function isEmbedding() {
    const buttonShown = settings.store.showToggleButton && Settings.uiElements.chatBarButtons.EmbedsNow?.enabled !== false;
    return !buttonShown || settings.store.embedLinks;
}

const EmbedsNowButton: ChatBarButtonFactory = ({ isAnyChat }) => {
    const { embedLinks, showToggleButton } = settings.use(BUTTON_KEYS);
    if (!isAnyChat || !showToggleButton) return null;

    return (
        <ChatBarButton
            tooltip={embedLinks ? "Disable embeds.now links" : "Enable embeds.now links"}
            onClick={() => settings.store.embedLinks = !embedLinks}
        >
            <EmbedsNowIcon disabled={!embedLinks} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "EmbedsNow",
    description: "Adds embeds for platforms Discord can't preview and cleans up the ones it already supports.",
    tags: ["Chat", "Media", "Privacy"],
    authors: [EquicordDevs.zero],
    settings,

    settingsAboutComponent: () => (
        <Paragraph>
            This plugin only sends links through <Link href="https://embeds.now/">embeds.now</Link>, which is not part of it. The service is hosted by <Link href="https://github.com/Oxylad">Oxylad</Link>, and all credit for it goes to them.
        </Paragraph>
    ),

    chatBarButton: {
        icon: EmbedsNowIcon,
        render: EmbedsNowButton
    },

    onBeforeMessageSend(_, message) {
        message.content = rewriteLinks(message.content, settings.store, isEmbedding());
    },

    onBeforeMessageEdit(_, __, message) {
        message.content = rewriteLinks(message.content, settings.store, isEmbedding());
    }
});
