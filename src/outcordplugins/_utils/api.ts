/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Channel, Guild, Role } from "@vencord/discord-types"
import { ChannelType } from "@vencord/discord-types/enums"
import { Constants, RestAPI } from "@webpack/common"

async function perform(func: () => Promise<any>, maxRetries = 3, retry = 0) {
    try {
        return await func()
    } catch (e: any) {
        if (e.body?.retry_after && retry < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, e.body.retry_after))
            return perform(func, maxRetries, retry + 1)
        }
    }
}

// * VOICE
export async function disconnectUser(guildId: string, userId: string) {
    await perform(() =>
        RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: { channel_id: null },
        }),
    )
}

export async function unMuteUser(guildId: string, userId: string) {
    await perform(() =>
        RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: { mute: false },
        }),
    )
}

export async function unDeafenUser(guildId: string, userId: string) {
    await perform(() =>
        RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: { deaf: false },
        }),
    )
}

export async function fullMuteUser(guildId: string, userId: string) {
    await perform(() =>
        RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: { mute: true, deaf: true },
        }),
    )
}

export async function fullUnMuteUser(guildId: string, userId: string) {
    await perform(() =>
        RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: { mute: false, deaf: false },
        }),
    )
}

export async function moveUser(guildId: string, userId: string, channelId: string) {
    await perform(() =>
        RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: { channel_id: channelId }
        })
    )
}

// * GUILD
interface CreateGuildOptions {
    name: string
    icon?: string
    region?: string
}

export async function createGuild(options: CreateGuildOptions): Promise<Guild> {
    return await perform(() =>
        RestAPI.post({
            url: Constants.Endpoints.GUILDS,
            body: options,
        }),
    ).then(async (r) => await r.body)
}

// * GROUP
export async function leaveGroup(channelId: string, silent: boolean) {
    return await perform(() =>
        RestAPI.del({
            url: Constants.Endpoints.CHANNEL(channelId) + `?silent=${silent}`
        })
    )
}
export async function removeFromGroup(channelId: string, userId: string) {
    return await perform(() =>
        RestAPI.del({
            url: Constants.Endpoints.CHANNEL_RECIPIENT(channelId, userId)
        })
    )
}
export async function addToGroup(channelId: string, userId: string) {
    return await perform(() =>
        RestAPI.put({
            url: Constants.Endpoints.CHANNEL_RECIPIENT(channelId, userId)
        })
    )
}

// * ROLES
interface RoleOptions {
    name: string
    colors?: {
        primary_color: number | undefined
        secondary_color: number | undefined
        tertiary_color: number | undefined
    }
    description?: string | undefined
    hoist?: boolean
    mentionable?: boolean
    icon?: string | undefined
    permissions?: bigint
    position?: number
    unicodeEmoji?: string | undefined
}
export async function createRole(guildId: string, options: RoleOptions): Promise<Role> {
    return await perform(() =>
        RestAPI.post({
            url: Constants.Endpoints.GUILD_ROLES(guildId),
            body: options,
        }),
    ).then(async (r) => await r.body)
}
export async function deleteRole(guildId: string, roleId: string) {
    await perform(() =>
        RestAPI.del({
            url: Constants.Endpoints.GUILD_ROLE(guildId, roleId),
        }),
    )
}
export async function updateRolePositions(guildId: string, positions: { id: string; position: number }[]) {
    return await perform(() =>
        RestAPI.patch({
            url: Constants.Endpoints.GUILD_ROLES(guildId),
            body: positions,
        }),
    ).then(async (r) => await r?.body)
}

// * CHANNELS
interface CreateChannelOptions {
    name: string
    type: ChannelType
    topic?: string
    nsfw?: boolean
    parent_id?: string | null
    position?: number
    bitrate?: number
    user_limit?: number
    rate_limit_per_user?: number
    permission_overwrites?: {
        id: string
        type: number
        allow: string
        deny: string
    }[]
}
export async function createChannel(guildId: string, options: CreateChannelOptions): Promise<Channel> {
    return await perform(() =>
        RestAPI.post({
            url: Constants.Endpoints.GUILD_CHANNELS(guildId),
            body: options,
        }),
    ).then(async (r) => await r.body)
}
export async function deleteChannel(channelId: string) {
    await perform(() =>
        RestAPI.del({
            url: Constants.Endpoints.CHANNEL(channelId),
        }),
    )
}
export async function updateChannelPositions(guildId: string, positions: { id: string; position?: number; parent_id?: string | null; lock_permissions?: boolean }[]) {
    return await perform(() =>
        RestAPI.patch({
            url: Constants.Endpoints.GUILD_CHANNELS(guildId),
            body: positions,
        }),
    ).then(async (r) => await r?.body)
}

// * MESSAGES
export async function sendMessageWithFiles(
    channelId: string,
    payload: { content?: string; embeds?: any[] },
    files: File[],
    maxRetries = 3,
) {
    const doRequest = async () => {
        if (files.length === 0) {
            return await RestAPI.post({
                url: Constants.Endpoints.MESSAGES(channelId),
                body: payload,
            }).then((r) => r.body)
        }

        const formData = new FormData()
        formData.append("payload_json", JSON.stringify(payload))
        files.forEach((file, i) => formData.append(`files[${i}]`, file, file.name))

        return await RestAPI.post({
            url: Constants.Endpoints.MESSAGES(channelId),
            body: formData,
        }).then((r) => r.body)
    }

    return await perform(doRequest, maxRetries)
}
export async function ackMessage(channelId: string, messageId: string, manual = false, ackToken: string | null = null) {
    return await perform(() =>
        RestAPI.post({
            url: Constants.Endpoints.MESSAGE_ACK(channelId, messageId),
            body: { manual, mention_count: 0, token: ackToken },
        }),
    ).then(async (r) => await r?.body)
}
export async function fetchLastMessages(channelId: string, limit = 100, maxRetries = 5) {
    let retry = 0
    while (true) {
        try {
            const res = await RestAPI.get({
                url: Constants.Endpoints.MESSAGES(channelId),
                query: { limit },
            })
            return res?.body ?? []
        } catch (e: any) {
            const retryAfter = e?.body?.retry_after
            if (retryAfter && retry < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + 250))
                retry++
                continue
            }
            console.error(`[ScrapeServer] Échec du fetch des messages pour le salon ${channelId}`, e)
            return []
        }
    }
}
