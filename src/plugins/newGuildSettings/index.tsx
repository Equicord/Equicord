/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
    findGroupChildrenByChildId,
    NavContextMenuPatchCallback
} from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { CogWheel } from "@components/Icons";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { Guild } from "@vencord/discord-types";
import { findByCodeLazy, findByPropsLazy, findStoreLazy, mapMangledModuleLazy } from "@webpack";
import { ChannelStore, Menu } from "@webpack/common";

const { updateGuildNotificationSettings } = findByPropsLazy("updateGuildNotificationSettings");
const { toggleShowAllChannels } = mapMangledModuleLazy(".onboardExistingMember(", {
    toggleShowAllChannels: m => {
        const s = String(m);
        return s.length < 100 && !s.includes("onboardExistingMember") && !s.includes("getOptedInChannels");
    }
});
const isOptInEnabledForGuild = findByCodeLazy(".COMMUNITY)||", ".isOptInEnabled(");
const CollapsedVoiceChannelStore = findStoreLazy("CollapsedVoiceChannelStore");
const collapsedChannels = findByPropsLazy("toggleCollapseGuild");

const settings = definePluginSettings({
    guild: {
        description: t("vencord.newGuildSettings.settings.guild"),
        type: OptionType.BOOLEAN,
        default: true
    },
    messages: {
        description: t("vencord.newGuildSettings.settings.messages"),
        type: OptionType.SELECT,
        options: [
            { label: t("vencord.newGuildSettings.settings.allMessages"), value: 0 },
            { label: t("vencord.newGuildSettings.settings.onlyMentions"), value: 1 },
            { label: t("vencord.newGuildSettings.settings.nothing"), value: 2 },
            { label: t("vencord.newGuildSettings.settings.serverDefault"), value: 3, default: true }
        ],
    },
    everyone: {
        description: t("vencord.newGuildSettings.settings.everyone"),
        type: OptionType.BOOLEAN,
        default: true
    },
    role: {
        description: t("vencord.newGuildSettings.settings.role"),
        type: OptionType.BOOLEAN,
        default: true
    },
    highlights: {
        description: t("vencord.newGuildSettings.settings.highlights"),
        type: OptionType.BOOLEAN,
        default: true
    },
    events: {
        description: t("vencord.newGuildSettings.settings.events"),
        type: OptionType.BOOLEAN,
        default: true
    },
    showAllChannels: {
        description: t("vencord.newGuildSettings.settings.showAllChannels"),
        type: OptionType.BOOLEAN,
        default: true
    },
    mobilePush: {
        description: t("vencord.newGuildSettings.settings.mobilePush"),
        type: OptionType.BOOLEAN,
        default: true
    },
    voiceChannels: {
        description: t("vencord.newGuildSettings.settings.voiceChannels"),
        type: OptionType.BOOLEAN,
        default: false
    }
});

const makeContextMenuPatch: (shouldAddIcon: boolean) => NavContextMenuPatchCallback = (shouldAddIcon: boolean) => (children, { guild }: { guild: Guild, onClose(): void; }) => {
    if (!guild) return;

    const group = findGroupChildrenByChildId("privacy", children);
    group?.push(
        <Menu.MenuItem
            label={t("vencord.newGuildSettings.applySettings")}
            id="vc-newguildsettings-apply"
            icon={shouldAddIcon ? CogWheel : void 0}
            action={() => applyDefaultSettings(guild.id)}
        />
    );
};

function applyVoiceNameHidingToGuild(guildId: string) {
    if (!settings.store.voiceChannels) return;

    try {
        ChannelStore.getChannelIds(guildId).filter(channelId => {
            const channel = ChannelStore.getChannel(channelId);
            return channel.isGuildVocal() && !CollapsedVoiceChannelStore.isCollapsed(channelId);
        }).forEach(id => collapsedChannels.update(id));
    } catch (error) {
        console.warn("[NewGuildSettings] Error applying voice name hiding:", error);
    }
}

function applyDefaultSettings(guildId: string | null) {
    if (guildId === "@me" || guildId === "null" || guildId == null) return;

    updateGuildNotificationSettings(guildId,
        {
            muted: settings.store.guild,
            mobile_push: !settings.store.mobilePush,
            suppress_everyone: settings.store.everyone,
            suppress_roles: settings.store.role,
            mute_scheduled_events: settings.store.events,
            notify_highlights: settings.store.highlights ? 1 : 0
        });

    if (settings.store.messages !== 3) {
        updateGuildNotificationSettings(guildId,
            {
                message_notifications: settings.store.messages,
            });
    }

    if (settings.store.showAllChannels && isOptInEnabledForGuild(guildId)) {
        toggleShowAllChannels(guildId);
    }

    if (settings.store.voiceChannels) {
        applyVoiceNameHidingToGuild(guildId);
    }
}

export default definePlugin({
    name: "NewGuildSettings",
    description: t("vencord.newGuildSettings.description"),
    tags: ["MuteNewGuild", "mute", "server"],
    authors: [Devs.Glitch, Devs.Nuckyz, Devs.carince, Devs.Mopi, Devs.GabiRP],
    isModified: true,
    contextMenus: {
        "guild-context": makeContextMenuPatch(false),
        "guild-header-popout": makeContextMenuPatch(true)
    },
    patches: [
        {
            find: ",acceptInvite(",
            replacement: {
                match: /INVITE_ACCEPT_SUCCESS.+?,(\i)=null!=.+?;/,
                replace: (m, guildId) => `${m}$self.applyDefaultSettings(${guildId});`
            }
        },
        {
            find: "{joinGuild:",
            replacement: {
                match: /guildId:(\i),lurker:(\i).{0,20}}\)\);/,
                replace: (m, guildId, lurker) => `${m}if(!${lurker})$self.applyDefaultSettings(${guildId});`
            }
        }
    ],
    settings,
    applyDefaultSettings
});
