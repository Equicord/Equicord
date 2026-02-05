// Authors: Bluscream, Cursor.AI
// Created at 2025-10-05 18:00:43
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";
import {
    ChannelStore,
    GuildChannelStore,
    GuildStore,
    SelectedChannelStore,
    UserStore,
    VoiceStateStore,
} from "@webpack/common";

interface VoiceStateChangeEvent {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfVideo?: boolean;
    selfStream?: boolean;
}

interface PreviousVoiceState {
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfVideo?: boolean;
    selfStream?: boolean;
}

const settings = definePluginSettings({
    // Main Settings - Updated with new variable names
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable voice channel join/leave logging",
        default: true,
        restartNeeded: false,
    },
    onlyMonitorOwnChannel: {
        type: OptionType.BOOLEAN,
        description: "Only monitor your current voice channel",
        default: false,
        restartNeeded: false,
    },
    triggerOnOwnEvents: {
        type: OptionType.BOOLEAN,
        description: "Trigger chat messages on your own voice events",
        default: false,
        restartNeeded: false,
    },
    consoleLogging: {
        type: OptionType.BOOLEAN,
        description: "Enable console logging for voice state updates",
        default: false,
        restartNeeded: false,
    },

    // Author Settings
    authorName: {
        type: OptionType.STRING,
        description:
            "Author name for bot messages (displayed as the sender). Variables: {username}=username, {displayname}=display name, {userid}=user ID",
        default: "Clyde",
        placeholder: "Clyde or {username}",
        restartNeeded: false,
    },
    authorIconUrl: {
        type: OptionType.STRING,
        description:
            "Author icon URL for bot messages (leave empty for default). Variables: {username}=username, {displayname}=display name, {userid}=user ID, {avatar}=avatar URL",
        default: "",
        placeholder: "https://example.com/avatar.png or {avatar}",
        restartNeeded: false,
    },

    // Event Type Toggles
    eventUserJoined: {
        name: "Event: Join",
        type: OptionType.BOOLEAN,
        description: "Log user join events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserLeft: {
        name: "Event: Leave",
        type: OptionType.BOOLEAN,
        description: "Log user leave events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserConnected: {
        name: "Event: Connect",
        type: OptionType.BOOLEAN,
        description: "Log user connect events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserDisconnected: {
        name: "Event: Disconnect",
        type: OptionType.BOOLEAN,
        description: "Log user disconnect events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserMoved: {
        name: "Event: Move",
        type: OptionType.BOOLEAN,
        description: "Log user move events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserDefault: {
        name: "Event: Default",
        type: OptionType.BOOLEAN,
        description: "Log user default events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserMuted: {
        name: "Event: Mute",
        type: OptionType.BOOLEAN,
        description: "Log user mute events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserUnmuted: {
        name: "Event: Unmute",
        type: OptionType.BOOLEAN,
        description: "Log user unmute events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserDeafens: {
        name: "Event: Deafen",
        type: OptionType.BOOLEAN,
        description: "Log user deafen events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserUndeafens: {
        name: "Event: Undeafen",
        type: OptionType.BOOLEAN,
        description: "Log user undeafen events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserCameraOn: {
        name: "Event: Camera On",
        type: OptionType.BOOLEAN,
        description: "Log user camera on events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserCameraOff: {
        name: "Event: Camera Off",
        type: OptionType.BOOLEAN,
        description: "Log user camera off events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserStreamStart: {
        name: "Event: Stream Start",
        type: OptionType.BOOLEAN,
        description: "Log user stream start events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserStreamStop: {
        name: "Event: Stream Stop",
        type: OptionType.BOOLEAN,
        description: "Log user stream stop events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserServerMuted: {
        name: "Event: Server Mute",
        type: OptionType.BOOLEAN,
        description: "Log user server mute events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserServerUnmuted: {
        name: "Event: Server Unmute",
        type: OptionType.BOOLEAN,
        description: "Log user server unmute events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserServerDeafened: {
        name: "Event: Server Deafen",
        type: OptionType.BOOLEAN,
        description: "Log user server deafen events to voice text chat",
        default: true,
        restartNeeded: false,
    },
    eventUserServerUndeafened: {
        name: "Event: Server Undeafen",
        type: OptionType.BOOLEAN,
        description: "Log user server undeafen events to voice text chat",
        default: true,
        restartNeeded: false,
    },

    // Message Templates
    messageUserJoined: {
        type: OptionType.STRING,
        description: "Message format for when someone joins",
        default: "🎉 <@{userid}> joined <#{newChannelId}>",
        placeholder: "🎉 <@{userid}> joined <#{newChannelId}>",
        restartNeeded: false,
    },
    messageUserLeft: {
        type: OptionType.STRING,
        description: "Message format for when someone leaves",
        default: "👋 <@{userid}> left <#{oldChannelId}>",
        placeholder: "👋 <@{userid}> left <#{oldChannelId}>",
        restartNeeded: false,
    },
    messageUserConnected: {
        type: OptionType.STRING,
        description: "Message format for when someone connects to voice",
        default: "🔊 <@{userid}> connected to <#{newChannelId}>",
        placeholder: "🔊 <@{userid}> connected to <#{newChannelId}>",
        restartNeeded: false,
    },
    messageUserDisconnected: {
        type: OptionType.STRING,
        description: "Message format for when someone disconnects from voice",
        default: "🔇 <@{userid}> disconnected from <#{oldChannelId}>",
        placeholder: "🔇 <@{userid}> disconnected from <#{oldChannelId}>",
        restartNeeded: false,
    },
    messageUserMoved: {
        type: OptionType.STRING,
        description:
            "Message format for when someone moves between voice channels",
        default: "🔄 <@{userid}> moved to <#{newChannelId}>",
        placeholder: "🔄 <@{userid}> moved to <#{newChannelId}>",
        restartNeeded: false,
    },
    messageUserDefault: {
        type: OptionType.STRING,
        description: "Default message format for fallback",
        default: "📢 <@{userid}> changed voice channel",
        placeholder: "📢 <@{userid}> changed voice channel",
        restartNeeded: false,
    },
    messageUserMuted: {
        type: OptionType.STRING,
        description: "Message format for when someone mutes themselves",
        default: "🔇 <@{userid}> muted themselves",
        placeholder: "🔇 <@{userid}> muted themselves",
        restartNeeded: false,
    },
    messageUserUnmuted: {
        type: OptionType.STRING,
        description: "Message format for when someone unmutes themselves",
        default: "🔊 <@{userid}> unmuted themselves",
        placeholder: "🔊 <@{userid}> unmuted themselves",
        restartNeeded: false,
    },
    messageUserDeafened: {
        type: OptionType.STRING,
        description: "Message format for when someone deafens themselves",
        default: "🤐 <@{userid}> deafened themselves",
        placeholder: "🤐 <@{userid}> deafened themselves",
        restartNeeded: false,
    },
    messageUserUndeafened: {
        type: OptionType.STRING,
        description: "Message format for when someone undeafens themselves",
        default: "👂 <@{userid}> undeafened themselves",
        placeholder: "👂 <@{userid}> undeafened themselves",
        restartNeeded: false,
    },
    messageUserCameraOn: {
        type: OptionType.STRING,
        description: "Message format for when someone enables camera",
        default: "📹 <@{userid}> enabled their camera",
        placeholder: "📹 <@{userid}> enabled their camera",
        restartNeeded: false,
    },
    messageUserCameraOff: {
        type: OptionType.STRING,
        description: "Message format for when someone disables camera",
        default: "📴 <@{userid}> disabled their camera",
        placeholder: "📴 <@{userid}> disabled their camera",
        restartNeeded: false,
    },
    messageUserStreamStart: {
        type: OptionType.STRING,
        description: "Message format for when someone starts streaming",
        default: "📺 <@{userid}> started streaming",
        placeholder: "📺 <@{userid}> started streaming",
        restartNeeded: false,
    },
    messageUserStreamStop: {
        type: OptionType.STRING,
        description: "Message format for when someone stops streaming",
        default: "⏹️ <@{userid}> stopped streaming",
        placeholder: "⏹️ <@{userid}> stopped streaming",
        restartNeeded: false,
    },
    messageUserServerMuted: {
        type: OptionType.STRING,
        description:
            "Message format for when someone gets muted by server/admin",
        default: "🔇 <@{userid}> was muted by server/admin",
        placeholder: "🔇 <@{userid}> was muted by server/admin",
        restartNeeded: false,
    },
    messageUserServerUnmuted: {
        type: OptionType.STRING,
        description:
            "Message format for when someone gets unmuted by server/admin",
        default: "🔊 <@{userid}> was unmuted by server/admin",
        placeholder: "🔊 <@{userid}> was unmuted by server/admin",
        restartNeeded: false,
    },
    messageUserServerDeafened: {
        type: OptionType.STRING,
        description:
            "Message format for when someone gets deafened by server/admin",
        default: "🤐 <@{userid}> was deafened by server/admin",
        placeholder: "🤐 <@{userid}> was deafened by server/admin",
        restartNeeded: false,
    },
    messageUserServerUndeafened: {
        type: OptionType.STRING,
        description:
            "Message format for when someone gets undeafened by server/admin",
        default: "👂 <@{userid}> was undeafened by server/admin",
        placeholder: "👂 <@{userid}> was undeafened by server/admin",
        restartNeeded: false,
    },
    messageTemplateReference: {
        type: OptionType.STRING,
        description:
            "Template Reference - Variables: {username}=username, {displayname}=display name, {userid}=user ID, {oldChannelName}=previous channel name, {oldChannelId}=previous channel ID, {newChannelName}=new channel name, {newChannelId}=new channel ID, {guildName}=server name, {guildId}=server ID, {now}=current time and date",
        default:
            "{username} {displayname} {userid} {avatar} {oldChannelName} {oldChannelId} {newChannelName} {newChannelId} {guildName} {guildId} {now}",
        placeholder:
            "{username} {displayname} {userid} {avatar} {oldChannelName} {oldChannelId} {newChannelName} {newChannelId} {guildName} {guildId} {now}",
        readonly: true,
        restartNeeded: false,
        onChange(newVal: string) {
            settings.store.messageTemplateReference =
                settings.def.messageTemplateReference.default;
        },
    },
});

function findAssociatedTextChannel(voiceChannelId: string): string | null {
    const voiceChannel = ChannelStore.getChannel(voiceChannelId);
    if (!voiceChannel || !voiceChannel.guild_id) return null;

    // In Discord, voice channels often have the same ID as their associated text channel
    // Try using the voice channel ID directly as the text channel ID
    const textChannel = ChannelStore.getChannel(voiceChannelId);
    if (textChannel && textChannel.type === 0) {
        // Type 0 is GUILD_TEXT
        return voiceChannelId;
    }

    // Fallback: try to find a text channel with the same name
    const guildChannels = GuildChannelStore.getChannels(voiceChannel.guild_id);
    if (!guildChannels || !(guildChannels as any).SELECTABLE) {
        return voiceChannelId; // Still try the voice channel ID as fallback
    }

    const associatedTextChannel = (guildChannels as any).SELECTABLE.find(
        ({ channel }) =>
            channel.name === voiceChannel.name &&
            channel.parent_id === voiceChannel.parent_id
    )?.channel;

    return associatedTextChannel ? associatedTextChannel.id : voiceChannelId;
}

function getTypeAndChannelId(
    { channelId, oldChannelId }: VoiceStateChangeEvent,
    isMe: boolean
) {
    // Track my last voice channel ID for proper move detection
    if (isMe) {
        if (channelId !== myLastVoiceChannelId) {
            oldChannelId = myLastVoiceChannelId;
            myLastVoiceChannelId = channelId;
        }
    }

    if (channelId !== oldChannelId) {
        // User connected to voice for the first time (no previous channel)
        if (channelId && !oldChannelId) return ["connect", channelId];
        // User disconnected from voice entirely (no new channel)
        if (!channelId && oldChannelId) return ["disconnect", oldChannelId];
        // User moved between channels (both channels exist)
        if (channelId && oldChannelId) return ["move", channelId]; // Move from oldChannelId to channelId
    }

    return ["", ""];
}

let myLastVoiceChannelId: string | undefined;
const previousVoiceStates = new Map<string, PreviousVoiceState>();

// Console logging function
function logToConsole(message: string, data?: any) {
    if (settings.store.consoleLogging) {
        console.log(`[blu-voicelog] ${message}`, data || "");
    }
}

// Function to send a formatted message
async function sendFormattedMessage(
    messageTemplate: string,
    voiceState: VoiceStateChangeEvent,
    userId: string,
    targetChannelId: string,
    user: any,
    guild?: any
) {
    if (!messageTemplate || messageTemplate.trim() === "") {
        return;
    }

    const now = new Date().toLocaleString();
    const newVoiceChannel = voiceState.channelId
        ? ChannelStore.getChannel(voiceState.channelId)
        : null;
    const oldVoiceChannel = voiceState.oldChannelId
        ? ChannelStore.getChannel(voiceState.oldChannelId)
        : null;

    const message = messageTemplate
        .replace(/{username}/g, user.username)
        .replace(/{displayname}/g, user.globalName || user.username)
        .replace(/{userid}/g, userId)
        .replace(
            /{oldChannelName}/g,
            oldVoiceChannel?.name || "Unknown Channel"
        )
        .replace(/{oldChannelId}/g, voiceState.oldChannelId || "")
        .replace(
            /{newChannelName}/g,
            newVoiceChannel?.name || "Unknown Channel"
        )
        .replace(/{newChannelId}/g, voiceState.channelId || "")
        .replace(/{guildName}/g, guild?.name || "Unknown Guild")
        .replace(/{guildId}/g, guild?.id || "")
        .replace(/{now}/g, now);

    try {
        // Process template variables in author settings
        const authorName = settings.store.authorName
            .replace(/{username}/g, user.username)
            .replace(/{displayname}/g, user.globalName || user.username)
            .replace(/{userid}/g, userId);

        const authorIconUrl = settings.store.authorIconUrl
            .replace(/{username}/g, user.username)
            .replace(/{displayname}/g, user.globalName || user.username)
            .replace(/{userid}/g, userId)
            .replace(/{avatar}/g, user.getAvatarURL?.() || "");

        const authorConfig: { username: string; avatar_url?: string } = {
            username: authorName,
        };

        if (authorIconUrl.trim()) {
            authorConfig.avatar_url = authorIconUrl.trim();
        }

        sendBotMessage(targetChannelId, {
            content: message,
            author: authorConfig,
        });
    } catch (error) {
        // Silently handle errors
    }
}

// Function to detect and handle voice state changes
async function detectVoiceStateChanges(
    voiceState: VoiceStateChangeEvent,
    userId: string,
    isMe: boolean
) {
    const previousState = previousVoiceStates.get(userId);

    // Log all voice state changes to console if enabled
    logToConsole(
        `Voice state update for user ${userId}:`,
        JSON.stringify(voiceState, null, 2)
    );

    // Skip my own events if triggerOnOwnEvents is disabled
    if (!settings.store.triggerOnOwnEvents && isMe) {
        return;
    }

    // Get current voice channel for filtering
    const currentUserId = UserStore.getCurrentUser().id;
    const myCurrentVoiceChannelId = SelectedChannelStore.getVoiceChannelId();
    const currentChannelId = voiceState.channelId || voiceState.oldChannelId;

    // If only monitoring own channel, skip events not related to my channel
    if (settings.store.onlyMonitorOwnChannel) {
        if (
            !myCurrentVoiceChannelId ||
            currentChannelId !== myCurrentVoiceChannelId
        ) {
            return;
        }
    }

    // Get user information
    const user = UserStore.getUser(userId);
    if (!user) {
        return;
    }

    // Get voice channel and guild information
    const voiceChannel = currentChannelId
        ? ChannelStore.getChannel(currentChannelId)
        : null;
    const guildId = voiceChannel?.guild_id;
    const guild = guildId ? GuildStore.getGuild(guildId) : null;

    // Get the text channel to send the message to
    const targetTextChannelId = currentChannelId
        ? findAssociatedTextChannel(currentChannelId)
        : null;
    if (!targetTextChannelId) {
        return;
    }

    const now = new Date().toLocaleString();

    // Check for mute/unmute changes (self-mute)
    if (previousState && previousState.selfMute !== voiceState.selfMute) {
        if (voiceState.selfMute && settings.store.eventUserMuted) {
            await sendFormattedMessage(
                settings.store.messageUserMuted,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        } else if (!voiceState.selfMute && settings.store.eventUserUnmuted) {
            await sendFormattedMessage(
                settings.store.messageUserUnmuted,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        }
    }

    // Check for deafen/undeafen changes (self-deafen)
    if (previousState && previousState.selfDeaf !== voiceState.selfDeaf) {
        if (voiceState.selfDeaf && settings.store.eventUserDeafens) {
            await sendFormattedMessage(
                settings.store.messageUserDeafened,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        } else if (!voiceState.selfDeaf && settings.store.eventUserUndeafens) {
            await sendFormattedMessage(
                settings.store.messageUserUndeafened,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        }
    }

    // Check for camera on/off changes
    if (previousState && previousState.selfVideo !== voiceState.selfVideo) {
        if (voiceState.selfVideo && settings.store.eventUserCameraOn) {
            await sendFormattedMessage(
                settings.store.messageUserCameraOn,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        } else if (!voiceState.selfVideo && settings.store.eventUserCameraOff) {
            await sendFormattedMessage(
                settings.store.messageUserCameraOff,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        }
    }

    // Check for stream start/stop changes
    if (previousState && previousState.selfStream !== voiceState.selfStream) {
        if (voiceState.selfStream && settings.store.eventUserStreamStart) {
            await sendFormattedMessage(
                settings.store.messageUserStreamStart,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        } else if (
            !voiceState.selfStream &&
            settings.store.eventUserStreamStop
        ) {
            await sendFormattedMessage(
                settings.store.messageUserStreamStop,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        }
    }

    // Check for server mute/unmute (mute field changes without self-mute changing)
    if (
        previousState &&
        previousState.mute !== voiceState.mute &&
        previousState.selfMute === voiceState.selfMute
    ) {
        if (voiceState.mute && settings.store.eventUserServerMuted) {
            await sendFormattedMessage(
                settings.store.messageUserServerMuted,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        } else if (!voiceState.mute && settings.store.eventUserServerUnmuted) {
            await sendFormattedMessage(
                settings.store.messageUserServerUnmuted,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        }
    }

    // Check for server deafen/undeafen (deaf field changes without self-deafen changing)
    if (
        previousState &&
        previousState.deaf !== voiceState.deaf &&
        previousState.selfDeaf === voiceState.selfDeaf
    ) {
        if (voiceState.deaf && settings.store.eventUserServerDeafened) {
            await sendFormattedMessage(
                settings.store.messageUserServerDeafened,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        } else if (
            !voiceState.deaf &&
            settings.store.eventUserServerUndeafened
        ) {
            await sendFormattedMessage(
                settings.store.messageUserServerUndeafened,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        }
    }

    // Check for join/leave/move events
    const [type, targetVoiceChannelId] = getTypeAndChannelId(voiceState, isMe);

    if (type === "move" && settings.store.eventUserMoved) {
        // Handle move events - post to both old and new channels
        const newVoiceChannelId = voiceState.channelId;
        const oldVoiceChannelId = voiceState.oldChannelId;

        if (newVoiceChannelId && oldVoiceChannelId) {
            // Post to old channel (leave message)
            const oldChannelTextId =
                findAssociatedTextChannel(oldVoiceChannelId);
            if (oldChannelTextId) {
                await sendFormattedMessage(
                    settings.store.messageUserMoved,
                    voiceState,
                    userId,
                    oldChannelTextId,
                    user,
                    guild
                );
            }

            // Post to new channel (join message)
            const newChannelTextId =
                findAssociatedTextChannel(newVoiceChannelId);
            if (newChannelTextId) {
                await sendFormattedMessage(
                    settings.store.messageUserMoved,
                    voiceState,
                    userId,
                    newChannelTextId,
                    user,
                    guild
                );
            }
        }
    } else if (type) {
        // Handle connect/disconnect events
        let messageTemplate;
        let shouldSend = false;

        switch (type) {
            case "join":
                messageTemplate = settings.store.messageUserJoined;
                shouldSend = settings.store.eventUserJoined;
                break;
            case "leave":
                messageTemplate = settings.store.messageUserLeft;
                shouldSend = settings.store.eventUserLeft;
                break;
            case "connect":
                messageTemplate = settings.store.messageUserConnected;
                shouldSend = settings.store.eventUserConnected;
                break;
            case "disconnect":
                messageTemplate = settings.store.messageUserDisconnected;
                shouldSend = settings.store.eventUserDisconnected;
                break;
            default:
                messageTemplate = settings.store.messageUserDefault;
                shouldSend = settings.store.eventUserDefault;
        }

        if (shouldSend) {
            await sendFormattedMessage(
                messageTemplate,
                voiceState,
                userId,
                targetTextChannelId,
                user,
                guild
            );
        }
    }

    // Update the previous state for this user
    previousVoiceStates.set(userId, {
        deaf: voiceState.deaf,
        mute: voiceState.mute,
        selfDeaf: voiceState.selfDeaf,
        selfMute: voiceState.selfMute,
        selfVideo: voiceState.selfVideo,
        selfStream: voiceState.selfStream,
    });
}

async function handleVoiceStateUpdate(voiceStates: VoiceStateChangeEvent[]) {
    if (!settings.store.enabled) return;

    const currentUserId = UserStore.getCurrentUser().id;

    for (const voiceState of voiceStates) {
        const { userId } = voiceState;
        const isMe = userId === currentUserId;

        // Handle all voice state changes in one place
        await detectVoiceStateChanges(voiceState, userId, isMe);
    }
}

export default definePlugin({
    name: "Voice Channel Logs",
    description: "Logs voice channel joins/leaves to the associated text chat",
    authors: [
        { name: "Bluscream", id: 467777925790564352n },
        { name: "Cursor.AI", id: 0n },
    ],

    settings,

    start() {
        // Plugin initialized
    },

    flux: {
        VOICE_STATE_UPDATES({
            voiceStates,
        }: {
            voiceStates: VoiceStateChangeEvent[];
        }) {
            handleVoiceStateUpdate(voiceStates).catch(() => {
                // Silently handle async errors
            });
        },
    },
});
