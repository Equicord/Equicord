/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { findByPropsLazy, findStore } from "@webpack";
import { ChannelStore, IconUtils, MessageStore, NavigationRouter, PresenceStore, RelationshipStore, SelectedChannelStore, StreamerModeStore, UserStore } from "@webpack/common";

import { setContainerPosition, showNotification, teardownNotifications } from "./components/Notifications";

const MuteStore = findByPropsLazy("isSuppressEveryoneEnabled");
const SelectedChannelActionCreators = findByPropsLazy("selectPrivateChannel");
const ChannelRTCActions = findByPropsLazy("updateChatOpen", "toggleParticipants");

const ID_REGEX = /^\d{17,20}$/;

let ignoredUsers: string[] = [];
let notifyFor: string[] = [];

enum NotificationLevel {
    ALL_MESSAGES = 0,
    ONLY_MENTIONS = 1,
    NO_MESSAGES = 2
}

export const settings = definePluginSettings({
    position: {
        type: OptionType.SELECT,
        description: "The position of the toast notification.",
        options: [
            {
                label: "Bottom Left",
                value: "bottom-left",
                default: true
            },
            {
                label: "Top Left",
                value: "top-left"
            },
            {
                label: "Top Right",
                value: "top-right"
            },
            {
                label: "Bottom Right",
                value: "bottom-right"
            },
        ],
        onChange: value => setContainerPosition(value),
    },
    timeout: {
        type: OptionType.SLIDER,
        description: "Time in seconds notifications will be shown for.",
        default: 5,
        markers: makeRange(1, 15, 1)
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "The visible opacity of the notification.",
        default: 100,
        markers: makeRange(10, 100, 10)
    },
    maxNotifications: {
        type: OptionType.SLIDER,
        description: "Maximum number of notifications displayed at once.",
        default: 3,
        markers: makeRange(1, 5, 1)
    },
    disableInStreamerMode: {
        type: OptionType.BOOLEAN,
        description: "Do not show notifications when streamer mode is enabled.",
        default: true
    },
    respectDoNotDisturb: {
        type: OptionType.BOOLEAN,
        description: "Do not show notifications when your status is Do Not Disturb.",
        default: false
    },
    directMessages: {
        type: OptionType.BOOLEAN,
        description: "Show notifications for direct messages.",
        default: true
    },
    groupMessages: {
        type: OptionType.BOOLEAN,
        description: "Show notifications for group messages.",
        default: true
    },
    friendServerNotifications: {
        type: OptionType.BOOLEAN,
        description: "Show notifications when friends send messages in servers they share with you.",
        default: true
    },
    ignoreUsers: {
        type: OptionType.STRING,
        description: "A list of user IDs (separate by commas) to ignore displaying notifications for.",
        onChange: () => { ignoredUsers = parseIdList(settings.store.ignoreUsers); },
        default: "",
        placeholder: "000000000000000000,111111111111111111,222222222222222222"
    },
    notifyFor: {
        type: OptionType.STRING,
        description: "A list of channel IDs (separate by commas) to always receive notifications from.",
        onChange: () => { notifyFor = parseIdList(settings.store.notifyFor); },
        default: "",
        placeholder: "000000000000000000,111111111111111111,222222222222222222"
    },
    exampleButton: {
        type: OptionType.COMPONENT,
        description: "Show an example toast notification.",
        component: () => <Button onClick={showExampleNotification}>Show Example Notification</Button>
    }
});

export default definePlugin({
    name: "ToastNotifications",
    description: "Show a pop-up toast notification, configurable for DMs, group, friends, or guild channels.",
    tags: ["Appearance", "Customisation", "Notifications"],
    authors: [EquicordDevs.Skully, EquicordDevs.Ethan, EquicordDevs.Buzzy],
    settings,
    flux: {
        MESSAGE_CREATE({ message }: { message: Message; }) {
            const channel: Channel = ChannelStore.getChannel(message.channel_id);
            if (!channel) return;

            const currentUser = UserStore.getCurrentUser();

            // Check global conditions for all message types.
            if (
                (message.author.id === currentUser.id) // If message is from the user.
                || (channel.id === SelectedChannelStore.getChannelId()) // If the user is currently in the channel.
                || (ignoredUsers.includes(message.author.id)) // If the user is ignored.
                || (settings.store.respectDoNotDisturb && PresenceStore.getStatus(currentUser.id) === "dnd") // If notifications are disabled while in DND.
                || (settings.store.disableInStreamerMode && StreamerModeStore.enabled) // If notifications are disabled in streamer mode.
            ) return;

            // Channel type checks.
            if (channel.guild_id) {
                if (!shouldNotifyForGuildMessage(message, channel)) return;
            } else {
                if (
                    (!settings.store.directMessages && channel.isDM()) // If DM notifications are disabled.
                    || (!settings.store.groupMessages && channel.isGroupDM()) // If group DM notifications are disabled.
                    || MuteStore.isChannelMuted(null, channel.id) // If the user has muted the DM/group channel.
                ) return;
            }

            // Retrieve the message component for the message.
            const mockedMessage: Message | undefined = MessageStore.getMessages(message.channel_id)?.receiveMessage(message)?.get(message.id);
            if (!mockedMessage) return console.error(`[ToastNotifications] Failed to retrieve mocked message from MessageStore for message ID ${message.id}!`);

            showNotification({
                message,
                mockedMessage,
                channel,
                onClick: () => channel.guild_id
                    ? navigateToChannel(channel)
                    : SelectedChannelActionCreators.selectPrivateChannel(channel.id)
            });
        }
    },

    start() {
        ignoredUsers = parseIdList(settings.store.ignoreUsers);
        notifyFor = parseIdList(settings.store.notifyFor);
    },

    stop() {
        teardownNotifications();
        ignoredUsers = [];
        notifyFor = [];
    }
});

/**
 * Splits a comma-separated string into a list of valid Discord snowflake IDs.
 */
function parseIdList(str: string): string[] {
    if (!str) return [];
    return str.replace(/\s/g, "").split(",").filter(id => ID_REGEX.test(id));
}

/**
 * Navigates the client to the given channel, opening the chat panel for voice channels.
 */
function navigateToChannel(channel: Channel) {
    if (!ChannelStore.hasChannel(channel.id)) return;
    NavigationRouter.transitionTo(`/channels/${channel.guild_id ?? "@me"}/${channel.id}/`);
    if (channel.isGuildVocal?.()) ChannelRTCActions.updateChatOpen(channel.id, true);
}

/**
 * Decides whether a guild message should trigger a notification based on the
 * channel allowlist, friend-server-notifications setting, channel/guild mutes,
 * and the user's configured notification level for the channel/guild.
 */
function shouldNotifyForGuildMessage(message: Message, channel: Channel): boolean {
    // Allowlist always wins.
    if (notifyFor.includes(channel.id)) return true;

    // Friend-in-server toggle.
    if (settings.store.friendServerNotifications && RelationshipStore.isFriend(message.author.id)) return true;

    // Respect the user's mute state for the guild/category/channel.
    if (MuteStore.isGuildOrCategoryOrChannelMuted(channel.guild_id, channel.id)) return false;

    // Resolve the user's configured notification level for the channel/guild.
    const userGuildSettings = findStore("UserGuildSettingsStore").getAllSettings().userGuildSettings[channel.guild_id];
    if (!userGuildSettings) return false;

    const channelOverride = userGuildSettings.channel_overrides?.[channel.id];
    const level: NotificationLevel = (channelOverride && typeof channelOverride === "object" && "message_notifications" in channelOverride)
        ? channelOverride.message_notifications
        : (typeof userGuildSettings.message_notifications === "number" ? userGuildSettings.message_notifications : NotificationLevel.NO_MESSAGES);

    if (level === NotificationLevel.NO_MESSAGES) return false;
    if (level === NotificationLevel.ALL_MESSAGES) return true;

    // Otherwise we only notify if the user was mentioned.
    return message.content.includes(`<@${UserStore.getCurrentUser().id}>`);
}

function showExampleNotification(): Promise<void> {
    return showNotification({
        title: "Example Notification",
        body: "This is an example toast notification!",
        icon: IconUtils.getUserAvatarURL(UserStore.getCurrentUser()),
        permanent: false
    });
}
