/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { getGuildAcronym } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, ComponentDispatch, Constants, DraftStore, DraftType, GuildChannelStore, GuildStore, IconUtils, PermissionsBits, PermissionStore, React, RestAPI, SelectedChannelStore, showToast, Toasts, UserStore } from "@webpack/common";
import { type GhostState, hideGhost as hideDragGhost, isGhostVisible, mountGhost as mountDragGhost, scheduleGhostPosition as scheduleDragGhostPosition, showGhost as showDragGhost, unmountGhost as unmountDragGhost } from "./ghost";
import { collectPayloadStrings, extractChannelFromUrl, extractChannelPath, extractSnowflakeFromString, extractStrings, extractUserFromAvatar, parseFromStrings, tryParseJson } from "./utils";

type DropEntity =
    | { kind: "user"; id: string; }
    | { kind: "channel"; id: string; guildId?: string; }
    | { kind: "guild"; id: string; };

type DraftActions = {
    saveDraft(channelId: string, draft: string, draftType: number): void;
    changeDraft(channelId: string, draft: string, draftType: number): void;
    setDraft?: (channelId: string, draft: string, draftType: number) => void;
};

const settings = definePluginSettings({
    userOutput: {
        type: OptionType.SELECT,
        description: "User drop output.",
        options: [
            { label: "Mention user", value: "mention", default: true },
            { label: "User ID", value: "id" },
        ],
    },
    channelOutput: {
        type: OptionType.SELECT,
        description: "Channel drop output.",
        options: [
            { label: "#channel mention", value: "mention", default: true },
            { label: "Channel link", value: "link" },
        ],
    },
    inviteExpireAfter: {
        type: OptionType.SELECT,
        description: "Invite expiration.",
        options: [
            { label: "30 minutes", value: 1800 },
            { label: "1 hour", value: 3600 },
            { label: "6 hours", value: 21600 },
            { label: "12 hours", value: 43200 },
            { label: "1 day", value: 86400 },
            { label: "7 days", value: 604800 },
            { label: "Never", value: 0, default: true },
        ],
    },
    inviteMaxUses: {
        type: OptionType.SELECT,
        description: "Invite max uses.",
        options: [
            { label: "No limit", value: 0, default: true },
            { label: "1 use", value: 1 },
            { label: "5 uses", value: 5 },
            { label: "10 uses", value: 10 },
            { label: "25 uses", value: 25 },
            { label: "50 uses", value: 50 },
            { label: "100 uses", value: 100 },
        ],
    },
    inviteTemporaryMembership: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Grant temporary membership.",
    },
    reuseExistingInvites: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Reuse existing invite instead of creating a new one.",
    },
    allowChatBodyDrop: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Allow dropping into the main chat body to insert text.",
    },
});

const DraftActions = findByPropsLazy("saveDraft", "changeDraft") as DraftActions;
const logger = new Logger("Dragify");
let pluginInstance: any = null;
let activeGuildDragId: string | null = null;
let activeUserDragId: string | null = null;
let activeDragEntity: DropEntity | null = null;
let lastDropAt = 0;
let lastHandledDrop: { at: number; key: string; } = { at: 0, key: "" };
let lastDragEventAt = 0;
let guildGhostCleanupTimer: number | null = null;
let dragifyActive = false;
let dragStateWatchdog: number | null = null;

function clearDragState() {
    activeUserDragId = null;
    activeGuildDragId = null;
    activeDragEntity = null;
    dragifyActive = false;
}

function setDragifyDataTransfer(dataTransfer: DataTransfer | null, payload: string) {
    if (!dataTransfer) return;
    if (dataTransfer.clearData) {
        dataTransfer.clearData("text/plain");
        dataTransfer.clearData("text/uri-list");
        dataTransfer.clearData("text/html");
    }
    dataTransfer.setData("application/json", payload);
    dataTransfer.setData("application/dragify", payload);
    dataTransfer.setData("text/plain", "");
}
const inviteCache = new Map<string, { code: string; expiresAt: number | null; maxUses: number | null; uses: number | null; }>();

export default definePlugin({
    name: "Dragify",
    description: "Drop users, channels, or servers into chat to insert mentions or invites.",
    authors: [EquicordDevs.justjxke],
    settings,

    patches: [
        // Chat input form (wire drop handlers)
        {
            find: "editor:eR,channelId:k.id,guildId:k.guild_id",
            replacement: {
                match: /className:\i\(\)\(\i,\i\.slateContainer\),/,
                replace: "$&onDragOver:e=>$self.onDragOver(e),"
            }
        },
        // Chat input text area (drop handlers for contenteditable)
        {
            find: "editor:eR,channelId:k.id,guildId:k.guild_id",
            replacement: {
                match: /className:\i\(\)\(\i\.slateTextArea,\i\),/,
                replace: "$&onDragOver:e=>$self.onDragOver(e),"
            }
        },
        {
            find: "editor:eR,channelId:k.id,guildId:k.guild_id",
            replacement: {
                match: /onKeyDown:(\i),/,
                replace: "onKeyDown:e=>{if($self.onEditorKeyDown(e))return;$1(e)},"
            }
        },
        // Voice user rows (voice channel sidebar)
        {
            find: "avatarContainer,onContextMenu",
            replacement: {
                match: /className:(\i)\.avatarContainer,onContextMenu:(\i)/,
                replace: "className:$1.avatarContainer,onContextMenu:$2,draggable:!0,onDragStart:e=>$self.onUserDragStart(e)"
            }
        },
        // Voice user rows (voice channel sidebar list)
        {
            find: "voiceUser]:!0",
            replacement: {
                match: /className:\i\(\)\(\i,\{[^}]*?\[\i\.voiceUser\]:!0[^}]*?\}\),/,
                replace: "$&\"data-user-id\":arguments[0].user?.id,draggable:!0,onDragStart:e=>$self.onUserDragStart(e,{id:arguments[0].user?.id}),"
            }
        },
        // Voice user rows (content node for data-user-id fallback)
        {
            find: "voiceUser]:!0",
            replacement: {
                match: /className:\i\(\)\(\i\.content,\{\[\i\.flipped\]:\i\}\)/,
                replace: "$&,\"data-user-id\":arguments[0].user?.id"
            }
        },
        // Voice channel container (voice channel sidebar)
        {
            find: "voiceUsers,!u",
            replacement: {
                match: /className:\i\(\)\(\i\.voiceUsers,!\i&&\i\.collapsed\),role:"group"/,
                replace: "$&,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e)"
            }
        },
        // Member list rows (server member list)
        {
            find: "membersWrap",
            replacement: {
                match: /user:(\i),currentUser:(\i),/,
                replace: "user:$1,\"data-user-id\":$1.id,draggable:!0,onDragStart:e=>$self.onUserDragStart(e,{id:$1.id}),currentUser:$2,"
            }
        },
        // Voice channel list rows (guild sidebar)
        {
            find: "className:a()(this.getModeClass(),{[V.disabled]:this.isDisabled()}),\"data-dnd-name\":e.name,children:[(0,r.jsx)(u.yRy",
            replacement: {
                match: /"data-dnd-name":(\i)\.name,/,
                replace: "\"data-dnd-name\":$1.name,draggable:!0,onDragStart:t=>$self.onChannelDragStart(t,{id:$1.id,guild_id:$1.guild_id}),"
            }
        },
        // Channel list items (text/voice/thread/forum)
        {
            find: "\"data-dnd-name\":U.name",
            replacement: {
                match: /className:(\i)\.draggable,"data-dnd-name":(\i)\.name/,
                replace: "className:$1.draggable,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e,{id:$2.id,guild_id:$2.guild_id}),\"data-dnd-name\":$2.name"
            }
        },
        // Thread rows in channel list (sidebar thread items)
        {
            find: "__invalid_threadMainContent",
            replacement: {
                match: /(?<=className:\i\.link,)/,
                replace: "draggable:!0,onDragStart:e=>$self.onChannelDragStart(e),"
            }
        },
        // Thread rows in channel list (threaded child rows)
        {
            find: "basicChannelRowLink",
            replacement: {
                match: /(className:\i\(\)\(\[\i\.link,\i\.basicChannelRowLink,\i\]\),)children:/,
                replace: "$1draggable:!0,onDragStart:e=>$self.onChannelDragStart(e),children:"
            }
        },
        // Channel list items (modern list wrapper)
        {
            find: "shouldShowThreadsPopout",
            replacement: {
                match: /"data-dnd-name":(\i)\.name,/,
                replace: "\"data-dnd-name\":$1.name,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e,{id:$1.id,guild_id:$1.guild_id}),"
            }
        },
        // Thread rows (active threads popout)
        {
            find: "isForumPost()?e.shiftKey:!e.shiftKey",
            replacement: {
                match: /className:(\i)\.row,onClick:(\i)=>\{\(0,(\i)\.ok\)\((\i),/,
                replace: "className:$1.row,draggable:!0,onDragStart:$2=>$self.onChannelDragStart($2,{id:$4.id,guild_id:$4.guild_id}),onClick:$2=>{(0,$3.ok)($4,"
            }
        },
        // Member list rows
        {
            find: "onContextMenu:J,onMouseEnter:eD",
            replacement: {
                match: /onContextMenu:(\i),onMouseEnter:(\i)(?=.{0,500}?user:(\i),guildId:)/,
                replace: "onContextMenu:$1,draggable:!0,onDragStart:$2=>$self.onUserDragStart($2,$3),onMouseEnter:$2"
            }
        },
        // Chat usernames
        {
            find: "N.username",
            replacement: {
                match: /,"data-text":/,
                replace: ",draggable:!0,onDragStart:e=>$self.onUserDragStart(e,arguments[0].author),\"data-user-id\":arguments[0].author.id,\"data-text\":"
            }
        },
        // DM list entries
        {
            find: "href:eN?void 0:eh,target:\"_blank\",ref:ed,className:L.link",
            replacement: {
                match: /className:(\i)\.link,/,
                replace: "className:$1.link,draggable:!0,onDragStart:e=>$self.onDmDragStart(e),"
            }
        },
        // Forum post rows (forum channel list)
        {
            find: "\"data-item-id\":t,onClick:Z,onContextMenu:w",
            replacement: {
                match: /"data-item-id":(\i),/,
                replace: "\"data-item-id\":$1,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e,{id:$1}),"
            }
        },
        {
            find: "[aria-owns=folder-items-",
            replacement: {
                match: /"data-dnd-name":(\i)\.name,"data-drop-hovering":(\i),children:\(0,(\i)\.jsx\)\((\i)\.LYs/,
                replace: "\"data-dnd-name\":$1.name,draggable:!0,onDragStart:e=>$self.onGuildDragStart(e,$1.id),\"data-drop-hovering\":$2,children:(0,$3.jsx)($4.LYs"
            }
        },
        // Chat avatars (popout)
        {
            find: "className:K.avatar,src:u,avatarDecoration:d,status:a,size:f.EFr.SIZE_80",
            replacement: {
                match: /className:(\i)\.avatar,src:(\i),avatarDecoration:(\i),status:(\i),size:(\i)\.EFr\.SIZE_80,"aria-label":(\i)\.username/,
                replace: "className:$1.avatar,src:$2,avatarDecoration:$3,status:$4,size:$5.EFr.SIZE_80,draggable:!0,onDragStart:e=>$self.onUserDragStart(e),\"aria-label\":$6.username"
            }
        },
        // Chat avatars (no popout)
        {
            find: "children:ee(X(q({},W)",
            replacement: {
                match: /avatarSrc:(\i),avatarDecorationSrc:(\i),compact:(\i),onClick:(\i),onContextMenu:(\i),onMouseDown:void 0,onKeyDown:void 0,showCommunicationDisabledStyles:(\i),className:(\i)\}\)\)\}\)/,
                replace: "avatarSrc:$1,avatarDecorationSrc:$2,compact:$3,onClick:$4,onContextMenu:$5,onMouseDown:void 0,onKeyDown:void 0,showCommunicationDisabledStyles:$6,className:$7,draggable:!0,onDragStart:e=>$self.onUserDragStart(e)}))})"
            }
        },
    ],

    onDragOver(event: React.DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },

    async onDrop(event: React.DragEvent, channel?: Channel | null) {
        const { dataTransfer } = event;
        if (!dataTransfer || dataTransfer.files?.length) return;

        const dragifyData = dataTransfer.getData("application/dragify");
        const hasActiveEntity = Boolean(activeDragEntity || activeUserDragId || activeGuildDragId);
        if (dragifyData || hasActiveEntity) {
            lastDropAt = Date.now();
            event.preventDefault();
            event.stopPropagation();
        }

        const resolvedChannel = channel
            ?? (SelectedChannelStore?.getChannelId?.()
                ? ChannelStore.getChannel(SelectedChannelStore.getChannelId())
                : null);
        if (!resolvedChannel) return;

        if (dragifyData) {
            const parsed = tryParseJson(dragifyData);
            if (parsed?.kind && parsed.id) {
                const fromDragify: DropEntity | null =
                    parsed.kind === "user"
                        ? { kind: "user", id: parsed.id }
                        : parsed.kind === "channel"
                            ? { kind: "channel", id: parsed.id, guildId: parsed.guildId }
                            : parsed.kind === "guild"
                                ? { kind: "guild", id: parsed.id }
                                : null;
                if (fromDragify) {
                    const key = `${fromDragify.kind}:${fromDragify.id}:${resolvedChannel.id}`;
                    const now = Date.now();
                    if (lastHandledDrop.key === key && now - lastHandledDrop.at < 150) return;
                    lastHandledDrop = { key, at: now };
                    await this.handleDropEntity(fromDragify, resolvedChannel, dragifyData);
                    return;
                }
            }
        }

        const payloads = await collectPayloadStrings(dataTransfer);
        let entity = parseFromStrings(payloads, { ChannelStore, GuildStore, UserStore });
        if (!entity && activeDragEntity) {
            entity = activeDragEntity;
        } else if (!entity && activeUserDragId) {
            entity = { kind: "user", id: activeUserDragId };
        } else if (!entity && activeGuildDragId) {
            entity = { kind: "guild", id: activeGuildDragId };
        }
        if (!entity) {
            return;
        }

        const key = `${entity.kind}:${entity.id}:${resolvedChannel.id}`;
        const now = Date.now();
        if (lastHandledDrop.key === key && now - lastHandledDrop.at < 150) return;
        lastHandledDrop = { key, at: now };
        await this.handleDropEntity(entity, resolvedChannel, payloads);
    },

    async handleDropEntity(entity: DropEntity, channel: Channel, payloads: string[] | string) {
        try {
            const text = await this.buildText(entity, channel);
            if (!text) {
                clearDragState();
                return;
            }
            if (entity.kind === "user") {
                this.insertText(channel.id, text, { removeUnknownUser: true });
            } else {
                this.insertText(channel.id, text);
            }
            clearDragState();
        } catch (error) {
            logger.error("Failed handling drop", error);
            showToast("Dragify failed to handle drop.", Toasts.Type.FAILURE);
        }
    },

    shouldHandle(dataTransfer?: DataTransfer | null): boolean {
        if (!dataTransfer || dataTransfer.files?.length) return false;
        return parseFromStrings(extractStrings(dataTransfer), { ChannelStore, GuildStore, UserStore }) !== null;
    },

    async buildText(entity: DropEntity, currentChannel: Channel): Promise<string | null> {
        switch (entity.kind) {
            case "user":
                return settings.store.userOutput === "id" ? entity.id : `<@${entity.id}>`;
            case "channel":
                return this.formatChannel(entity.id, entity.guildId);
            case "guild":
                return await this.createInvite(entity.id, currentChannel);
            default:
                return null;
        }
    },

    formatChannel(channelId: string, guildId?: string): string | null {
        if (settings.store.channelOutput === "link") {
            const channel = ChannelStore.getChannel(channelId);
            const effectiveGuildId = guildId ?? channel?.guild_id ?? "@me";
            return `https://discord.com/channels/${effectiveGuildId}/${channelId}`;
        }
        return `<#${channelId}>`;
    },

    async createInvite(guildId: string, currentChannel: Channel): Promise<string | null> {
        const inviteChannel = this.findInviteChannel(guildId, currentChannel);
        const fallbackChannelId = inviteChannel ? null : await this.fetchInviteChannelId(guildId);

        if (settings.store.reuseExistingInvites) {
            const cached = inviteCache.get(guildId);
            if (cached && !this.isInviteExpired(cached)) return `https://discord.gg/${cached.code}`;
            const reused = await this.fetchReusableInvite(guildId, inviteChannel ?? null);
            if (reused) return `https://discord.gg/${reused}`;
        }

        const inviteChannelId = inviteChannel?.id ?? fallbackChannelId;
        if (!inviteChannelId) {
            showToast("No channel available for invites.", Toasts.Type.FAILURE);
            return null;
        }
        if (inviteChannel && inviteChannel.guild_id !== guildId) {
            showToast("No channel available for invites.", Toasts.Type.FAILURE);
            return null;
        }

        try {
            const maxAge = Number(settings.store.inviteExpireAfter ?? 0);
            const maxUses = Number(settings.store.inviteMaxUses ?? 0);
            const { body } = await RestAPI.post({
                url: `/channels/${inviteChannelId}/invites`,
                body: {
                    max_age: Number.isFinite(maxAge) ? maxAge : 0,
                    max_uses: Number.isFinite(maxUses) ? maxUses : 0,
                    temporary: settings.store.inviteTemporaryMembership,
                    unique: true,
                },
            });
            const code = typeof body === "object" && body ? (body as { code?: string; }).code : null;
            if (!code) throw new Error("Invite response missing code");
            inviteCache.set(guildId, {
                code,
                expiresAt: maxAge > 0 ? Date.now() + maxAge * 1000 : null,
                maxUses: maxUses === 0 ? null : maxUses,
                uses: 0,
            });
            showToast("Invite created.", Toasts.Type.SUCCESS);
            return `https://discord.gg/${code}`;
        } catch (error) {
            logger.error("Failed to create invite", error);
            showToast("Unable to create invite.", Toasts.Type.FAILURE); // uh oh!
            return null;
        }
    },

    async fetchInviteChannelId(guildId: string): Promise<string | null> {
        try {
            const { body } = await RestAPI.get({ url: `/guilds/${guildId}/channels` });
            if (!Array.isArray(body)) return null;

            const candidates = (body as Array<any>)
                .filter(ch => ch && typeof ch.id === "string")
                .filter(ch => {
                    const { type } = ch;
                    return type === ChannelType.GUILD_TEXT
                        || type === ChannelType.GUILD_ANNOUNCEMENT
                        || type === ChannelType.GUILD_FORUM
                        || type === ChannelType.GUILD_MEDIA;
                })
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            return candidates[0]?.id ?? null;
        } catch {
            return null;
        }
    },

    async fetchReusableInvite(guildId: string, inviteChannel: Channel | null): Promise<string | null> {
        const cached = inviteCache.get(guildId);
        if (cached && !this.isInviteExpired(cached)) return cached.code;

        try {
            const channelId = inviteChannel?.id ?? null;
            const url = channelId ? `/channels/${channelId}/invites` : `/guilds/${guildId}/invites`;

            const { body } = await RestAPI.get({ url });
            if (!Array.isArray(body)) return null;

            const now = Date.now();
            const invite = (body as Array<any>).find(inv => {
                const expiresAt = inv.expires_at ? Date.parse(inv.expires_at) : null;
                const maxUsesRaw = inv.max_uses ?? null;
                const maxUses = maxUsesRaw === 0 ? null : maxUsesRaw;
                const uses = inv.uses ?? null;
                const notExpired = expiresAt === null || expiresAt > now;
                const usesLeft = maxUses === null || uses === null || uses < maxUses;
                return notExpired && usesLeft && typeof inv.code === "string";
            });

            if (invite?.code) {
                inviteCache.set(guildId, {
                    code: invite.code,
                    expiresAt: invite.expires_at ? Date.parse(invite.expires_at) : null,
                    maxUses: invite.max_uses === 0 ? null : invite.max_uses ?? null,
                    uses: invite.uses ?? null,
                });
                return invite.code;
            }
        } catch {
            // If we cannot list invites (permissions/403), fall back silently.
            return null;
        }

        return null;
    },

    isInviteExpired(invite: { expiresAt: number | null; maxUses: number | null; uses: number | null; }): boolean {
        const now = Date.now();
        const expired = invite.expiresAt !== null && invite.expiresAt <= now;
        const exhausted = invite.maxUses !== null && invite.maxUses !== 0 && invite.uses !== null && invite.uses >= invite.maxUses;
        return expired || exhausted;
    },

    findInviteChannel(guildId: string, currentChannel: Channel): Channel | null {
        if (currentChannel.guild_id === guildId && this.canCreateInvite(currentChannel)) return currentChannel;

        const guild = GuildStore.getGuild(guildId);
        const preferredIds = [
            guild?.systemChannelId,
            guild?.rulesChannelId,
            guild?.publicUpdatesChannelId,
        ].filter(Boolean) as string[];
        for (const id of preferredIds) {
            const channel = ChannelStore.getChannel(id);
            if (this.canCreateInvite(channel)) return channel;
        }

        const selectableStore = (GuildChannelStore.getSelectableChannels?.(guildId) ?? []).map(e => e.channel).filter(Boolean) as Channel[];
        const selectableCollection = (() => {
            const collection = (GuildChannelStore as any).getChannels?.(guildId);
            const result: Channel[] = [];
            if (collection?.SELECTABLE) {
                const values = Object.values(collection.SELECTABLE) as any[];
                for (const val of values) {
                    const ch = (val as any).channel ?? val;
                    if (ch) result.push(ch as Channel);
                }
            }
            return result;
        })();

        const candidates = [...selectableStore, ...selectableCollection]
            .filter(ch => ch && ch.guild_id === guildId)
            .filter((ch, idx, arr) => arr.findIndex(c => c.id === ch.id) === idx)
            .sort((a, b) => {
                const pa = (a as any).position ?? 0;
                const pb = (b as any).position ?? 0;
                if (pa === pb) return a.id.localeCompare(b.id);
                return pa - pb;
            });

        for (const channel of candidates) {
            if (this.canCreateInvite(channel)) return channel;
        }

        return null;
    },

    canCreateInvite(channel?: Channel | null): channel is Channel {
        if (!channel || !channel.guild_id) return false;
        if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM) return false;
        if (channel.type === ChannelType.GUILD_CATEGORY) return false;
        if (typeof channel.isThread === "function" && channel.isThread()) return false;
        return PermissionStore.can(PermissionsBits.CREATE_INSTANT_INVITE, channel);
    },

    insertText(channelId: string, text: string, options?: { removeUnknownUser?: boolean; }) {
        const insertAction = (Constants as any)?.CkL?.INSERT_TEXT ?? "INSERT_TEXT";
        const dispatcher = ComponentDispatch as any;
        if (dispatcher?.dispatchToLastSubscribed) {
            dispatcher.dispatchToLastSubscribed(insertAction, { plainText: text, rawText: text });
            return;
        }

        let existing = DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "";
        if (options?.removeUnknownUser) {
            existing = existing.replace(/@unknown[- ]user/gi, "").trim();
        }
        const needsSpace = existing.length > 0 && !existing.endsWith(" ");
        const nextValue = needsSpace ? `${existing} ${text}` : `${existing}${text}`;

        const setDraftAction = (DraftActions as any).setDraft as DraftActions["setDraft"];
        const setDraftStore = (DraftStore as any).setDraft as DraftActions["setDraft"];
        const emitChange = (DraftStore as any).emitChange as (() => void) | undefined;

        if (setDraftAction) {
            setDraftAction(channelId, nextValue, DraftType.ChannelMessage);
        } else if (setDraftStore) {
            setDraftStore.call(DraftStore, channelId, nextValue, DraftType.ChannelMessage);
        } else {
            DraftActions.changeDraft(channelId, nextValue, DraftType.ChannelMessage);
        }

        DraftActions.saveDraft(channelId, nextValue, DraftType.ChannelMessage);
        if (emitChange) emitChange.call(DraftStore);
    },

    onChannelDragStart(event: DragEvent, channel?: Pick<Channel, "id" | "guild_id"> | { id: string; guildId?: string; }) {
        if (activeUserDragId) return;
        const existingDragify = event.dataTransfer?.getData("application/dragify") ?? "";
        if (existingDragify) {
            const parsed = tryParseJson(existingDragify);
            if (parsed?.kind === "user") return;
        }
        const targetEl = event.target as HTMLElement | null;
        if (targetEl?.closest?.("[class*=\"voiceUser\"]")) {
            logger.debug("Channel dragstart from voice user target");
        }
        if (targetEl?.closest?.("[data-user-id]")) return;

        const targetResolved = this.extractChannelIdFromTarget(event.target as HTMLElement | null);
        const resolved = channel ?? targetResolved;
        const channelId = resolved?.id ?? targetResolved?.id;
        if (!channelId) return;

        const channelObj = ChannelStore.getChannel(channelId);
        const resolvedGuildId = resolved ? ("guild_id" in resolved ? resolved.guild_id : resolved.guildId) : undefined;
        const guildId = resolvedGuildId ?? targetResolved?.guildId ?? channelObj?.guild_id;
        if (channelObj?.isDM?.() || channelObj?.type === ChannelType.DM) {
            const recipientId = this.getDmRecipientId(channelObj);
            if (recipientId) {
                this.onUserDragStart(event, { id: recipientId });
                return;
            }
        }
        this.showGhost({ kind: "channel", id: channelId, guildId }, event);
        const payload = JSON.stringify({ kind: "channel", id: channelId, guildId });
        activeDragEntity = { kind: "channel", id: channelId, guildId };
        dragifyActive = true;
        lastDragEventAt = Date.now();
        setDragifyDataTransfer(event.dataTransfer ?? null, payload);
    },

    onUserDragStart(event: DragEvent, user?: { id: string; }) {
        const searchTarget = event.target as HTMLElement | null;
        if (searchTarget && typeof (searchTarget as any).closest === "function") {
            const chatMessage = searchTarget.closest("[data-author-id]") as HTMLElement | null;
            if (chatMessage) {
                const authorId = chatMessage.getAttribute("data-author-id");
        const parsed = authorId ? extractSnowflakeFromString(authorId) : null;
                if (parsed) {
                    user = { id: parsed };
                }
            }
        }
        const currentTarget = (event as unknown as { currentTarget?: EventTarget | null; }).currentTarget as HTMLElement | null;
        const target = (event.target as HTMLElement | null) ?? null;
        const userIdFromParam =
            user?.id
            ?? (user as any)?.userId
            ?? (user as any)?.user?.id
            ?? null;
        const userIdFromDom =
            currentTarget?.getAttribute?.("data-user-id")
            ?? currentTarget?.closest?.("[data-user-id]")?.getAttribute?.("data-user-id")
            ?? target?.getAttribute?.("data-user-id")
            ?? target?.closest?.("[data-user-id]")?.getAttribute?.("data-user-id")
            ?? null;
        const userIdFromEvent = this.extractUserIdFromEvent(event);
        const rawUserId =
            userIdFromParam
            ?? userIdFromDom
            ?? this.extractUserIdFromTarget(currentTarget)
            ?? this.extractUserIdFromTarget(target)
            ?? userIdFromEvent
            ?? event.dataTransfer?.getData("data-user-id")
            ?? null;
        const userId = rawUserId ? (extractSnowflakeFromString(rawUserId) ?? rawUserId) : null;
        if (!userId || !/^\d{17,20}$/.test(userId)) return;
        const payload = JSON.stringify({ kind: "user", id: userId });
        event.stopPropagation();
        activeUserDragId = userId;
        activeDragEntity = { kind: "user", id: userId };
        dragifyActive = true;
        lastDragEventAt = Date.now();
        this.showGhost({ kind: "user", id: userId }, event);
        setDragifyDataTransfer(event.dataTransfer ?? null, payload);
        event.dataTransfer?.setData("data-user-id", userId);
    },

    onDmDragStart(event: DragEvent, channel?: Channel | null) {
        let resolvedChannel = channel ?? null;
        const channelId = resolvedChannel?.id ?? null;
        if (!resolvedChannel && event.target) {
            const targetChannel = this.extractChannelIdFromTarget(event.target as HTMLElement | null);
            if (targetChannel?.id) resolvedChannel = ChannelStore.getChannel(targetChannel.id) ?? null;
        } else if (channelId && !resolvedChannel?.getRecipientId) {
            resolvedChannel = ChannelStore.getChannel(channelId) ?? resolvedChannel;
        }
        if (!resolvedChannel) return;
        const recipientId = this.getDmRecipientId(resolvedChannel);
        if (recipientId) {
            this.onUserDragStart(event, { id: recipientId });
            return;
        }

        this.onChannelDragStart(event, resolvedChannel);
    },

    onGuildDragStart(event: DragEvent, guildId: string) {
        this.showGhost({ kind: "guild", id: guildId }, event);
        const payload = JSON.stringify({ kind: "guild", id: guildId });
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
        activeGuildDragId = guildId;
        activeDragEntity = { kind: "guild", id: guildId };
        dragifyActive = true;
        lastDragEventAt = Date.now();
        setDragifyDataTransfer(event.dataTransfer ?? null, payload);
    },

    start() {
        pluginInstance = this;
        this.mountGhost();
        window.addEventListener("dragover", this.globalDragOver, true);
        window.addEventListener("drop", this.globalDrop, true);
        window.addEventListener("dragstart", this.globalDragStart, true);
        window.addEventListener("mousemove", this.globalDragMove, true);
        window.addEventListener("drag", this.globalDragMove, true);
        window.addEventListener("dragover", this.globalDragMove, true);
        window.addEventListener("dragend", this.globalDragEnd, true);
        if (dragStateWatchdog === null) {
            dragStateWatchdog = window.setInterval(() => {
                if (!dragifyActive) return;
                if (Date.now() - lastDragEventAt < 1200) return;
                activeUserDragId = null;
                activeGuildDragId = null;
                activeDragEntity = null;
                dragifyActive = false;
                hideDragGhost();
            }, 500);
        }
    },

    stop() {
        window.removeEventListener("dragover", this.globalDragOver, true);
        window.removeEventListener("drop", this.globalDrop, true);
        window.removeEventListener("dragstart", this.globalDragStart, true);
        window.removeEventListener("mousemove", this.globalDragMove, true);
        window.removeEventListener("drag", this.globalDragMove, true);
        window.removeEventListener("dragover", this.globalDragMove, true);
        window.removeEventListener("dragend", this.globalDragEnd, true);
        clearDragState();
        if (guildGhostCleanupTimer !== null) {
            clearTimeout(guildGhostCleanupTimer);
            guildGhostCleanupTimer = null;
        }
        if (dragStateWatchdog !== null) {
            clearInterval(dragStateWatchdog);
            dragStateWatchdog = null;
        }
        this.unmountGhost();
        pluginInstance = null;
    },

    globalDragOver: (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst) return;
        if (!inst.isMessageInputEvent(event)) return;
        const hasActiveGuildDrag = activeGuildDragId !== null;
        const hasActiveEntity = Boolean(activeDragEntity || activeUserDragId);
        const shouldHandle = hasActiveGuildDrag || hasActiveEntity || dragifyActive || inst.shouldHandle(event.dataTransfer);
        if (!shouldHandle) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },

    globalDrop: async (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst) return;
        if (!inst.isMessageInputEvent(event)) return;
        const channelId = SelectedChannelStore?.getChannelId?.();
        const channel = channelId ? ChannelStore.getChannel(channelId) : null;
        if (!channel) return;

        const types = event.dataTransfer?.types ?? [];
        const hasDragify = types.includes("application/dragify");
        const likelyJson = types.includes("application/json");
        const hasActiveGuildDrag = activeGuildDragId !== null;
        const hasActiveUserDrag = activeUserDragId !== null;
        const hasActiveEntity = activeDragEntity !== null;

        const payloads = await collectPayloadStrings(event.dataTransfer as DataTransfer);
        const entity = parseFromStrings(payloads, { ChannelStore, GuildStore, UserStore });
        if (!hasDragify && !entity && !likelyJson && !hasActiveGuildDrag && !hasActiveUserDrag && !hasActiveEntity) return;

        lastDropAt = Date.now();
        event.preventDefault();
        event.stopPropagation();
        inst.onDrop(event as unknown as React.DragEvent, channel);
        hideDragGhost();
    },

    globalDragStart: (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst || !event.dataTransfer) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (!event.dataTransfer.types?.includes("application/dragify")) {
            if (typeof document !== "undefined" && typeof event.clientX === "number" && typeof event.clientY === "number") {
                const atPoint = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
                const userTarget = atPoint?.closest?.("[data-user-id]") as HTMLElement | null;
                if (userTarget) {
                    const nestedUserId = userTarget.getAttribute("data-user-id")
                        ?? userTarget.querySelector?.("[data-user-id]")?.getAttribute("data-user-id")
                        ?? null;
                    const userId = nestedUserId ?? inst.extractUserIdFromTarget(userTarget);
                    if (userId) {
                        inst.onUserDragStart(event, { id: userId });
                        return;
                    }
                }
            }

            const path = event.composedPath?.() ?? [];
            for (const entry of path) {
                const el = entry as HTMLElement | null;
                if (!el) continue;
                const userTarget = el.closest?.("[data-user-id]") as HTMLElement | null;
                if (!userTarget) continue;
                const userId = inst.extractUserIdFromTarget(userTarget);
                if (userId) {
                    inst.onUserDragStart(event, { id: userId });
                }
                return;
            }
        }

        const authorContainer = target.closest?.("[data-author-id]") as HTMLElement | null;
        const authorId = authorContainer?.getAttribute?.("data-author-id") ?? null;
        if (authorId && target.getAttribute?.("data-text") && !event.dataTransfer.types?.includes("application/dragify")) {
            inst.onUserDragStart(event, { id: authorId });
            return;
        }

        const userIdFromTarget = inst.extractUserIdFromEvent(event) ?? inst.extractUserIdFromTarget(target);
        if (userIdFromTarget && !event.dataTransfer.types?.includes("application/dragify")) {
            inst.onUserDragStart(event, { id: userIdFromTarget });
            return;
        }

        const channelFromTarget = inst.extractChannelIdFromTarget(target);
        if (channelFromTarget && !event.dataTransfer.types?.includes("application/dragify")) {
            if (target.closest?.("[data-user-id]")) return;
            inst.onChannelDragStart(event, channelFromTarget);
            return;
        }

        const guildId = inst.extractGuildIdFromTarget(target);
        if (!guildId) return;

        if (!event.dataTransfer.types?.includes("application/dragify")) {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "copyMove";
            activeGuildDragId = guildId;
            setDragifyDataTransfer(event.dataTransfer, JSON.stringify({ kind: "guild", id: guildId }));
            inst.showGhost({ kind: "guild", id: guildId }, event);
        }
    },
    globalDragEnd: (_event: DragEvent) => {
        const now = Date.now();
        setTimeout(() => {
            if (Date.now() - lastDropAt < 100) return;
            clearDragState();
            hideDragGhost();
        }, 0);
    },
    globalDragMove: (event: DragEvent | MouseEvent) => {
        if (!isGhostVisible()) return;
        if (typeof event.clientX !== "number" || typeof event.clientY !== "number") return;
        if (event instanceof DragEvent) {
            lastDragEventAt = Date.now();
            if (activeGuildDragId !== null || activeDragEntity?.kind === "guild") {
                if (guildGhostCleanupTimer !== null) clearTimeout(guildGhostCleanupTimer);
                guildGhostCleanupTimer = window.setTimeout(() => {
                    if (Date.now() - lastDragEventAt < 200) return;
                    activeGuildDragId = null;
                    if (activeDragEntity?.kind === "guild") activeDragEntity = null;
                    hideDragGhost();
                }, 300);
            }
        }
        scheduleDragGhostPosition(event.clientX + 16, event.clientY + 20);
    },
    isMessageInputEvent(event: DragEvent): boolean {
        const target = event.target as Element | null;
        if (this.isMessageInputElement(target)) return true;
        if (settings.store.allowChatBodyDrop && this.isChatBodyElement(target)) return true;

        const path = event.composedPath?.() ?? [];
        for (const entry of path) {
            const el = entry as Element | null;
            if (this.isMessageInputElement(el)) return true;
            if (settings.store.allowChatBodyDrop && this.isChatBodyElement(el)) return true;
        }

        if (typeof document !== "undefined" && typeof event.clientX === "number" && typeof event.clientY === "number") {
            const elements = document.elementsFromPoint?.(event.clientX, event.clientY);
            if (elements && elements.length) {
                for (const el of elements) {
                    if (this.isMessageInputElement(el)) return true;
                    if (settings.store.allowChatBodyDrop && this.isChatBodyElement(el)) return true;
                }
            } else {
                const atPoint = document.elementFromPoint(event.clientX, event.clientY);
                if (this.isMessageInputElement(atPoint)) return true;
                if (settings.store.allowChatBodyDrop && this.isChatBodyElement(atPoint)) return true;
            }
        }

        return false;
    },

    resolveElementFromNode(node: Node | null): Element | null {
        if (!node) return null;
        if (node instanceof Element) return node;
        return (node as ChildNode).parentElement ?? null;
    },

    applySelectAll(editor: HTMLElement): boolean {
        editor.focus?.();
        let handled = false;
        try {
            handled = Boolean(document.execCommand?.("selectAll"));
        } catch {
            handled = false;
        }
        if (!handled) {
            const selection = document.getSelection?.();
            if (!selection) return false;
            const range = document.createRange();
            range.selectNodeContents(editor);
            selection.removeAllRanges();
            selection.addRange(range);
            handled = true;
        }
        return handled;
    },

    onEditorKeyDown(event: KeyboardEvent): boolean {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "a") return false;
        const target = this.resolveElementFromNode(event.currentTarget as Node | null);
        const editor = (target as HTMLElement | null)?.closest?.("[data-slate-editor],[role=\"textbox\"],[contenteditable=\"true\"]") as HTMLElement | null;
        if (!editor) return false;
        if (!this.applySelectAll(editor)) return false;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return true;
    },

    isMessageInputElement(el: Element | null): boolean {
        if (!el) return false;
        const selector = "[data-slate-editor],[role=\"textbox\"],[contenteditable=\"true\"],[aria-label^=\"Message \"]";
        return Boolean((el as HTMLElement).closest?.(selector));
    },

    isChatBodyElement(el: Element | null): boolean {
        if (!el) return false;
        const selector = "[role=\"log\"],[data-list-id^=\"chat-messages\"]";
        return Boolean((el as HTMLElement).closest?.(selector));
    },

    extractGuildIdFromTarget(target: HTMLElement): string | null {
        let el: HTMLElement | null = target;
        while (el) {
            const listId = el.getAttribute("data-list-id");
            const rawId = el.getAttribute("data-list-item-id") ?? "";
            const isGuildContext = (listId && /guild/i.test(listId)) || /guild/i.test(rawId);

            if (!isGuildContext) {
                el = el.parentElement;
                continue;
            }

            const parts = rawId.split("___");
            const candidate = parts[parts.length - 1] ?? rawId;
            if (/^\d{17,20}$/.test(candidate)) return candidate;

            const direct =
                extractSnowflakeFromString(rawId) ??
                extractSnowflakeFromString(listId ?? "") ??
                extractSnowflakeFromString(el.getAttribute("data-guild-id") ?? "");
            if (direct) return direct;

            el = el.parentElement;
        }
        return null;
    },

    extractChannelIdFromTarget(target: HTMLElement | null): { id: string; guildId?: string; } | null {
        let el: HTMLElement | null = target;
        while (el) {
            const listId = el.getAttribute("data-list-id") ?? "";
            const rawId = el.getAttribute("data-list-item-id") ?? "";
            const channelIdAttr = el.getAttribute("data-channel-id") ?? el.getAttribute("data-item-id") ?? "";
            const threadIdAttr = el.getAttribute("data-thread-id") ?? "";
            const href = el.getAttribute("href") ?? "";
            const isChannelContext = /(channel|thread|private|forum)/i.test(listId) || /(channel|thread|private|forum)/i.test(rawId);

            const pathMatch = extractChannelPath(href);
            if (pathMatch?.channelId) {
                const guildId = pathMatch.guildId === "@me" ? undefined : pathMatch.guildId;
                return { id: pathMatch.channelId, guildId };
            }

            const fullMatch = extractChannelFromUrl(href);
            if (fullMatch?.channelId) {
                const guildId = fullMatch.guildId === "@me" ? undefined : fullMatch.guildId;
                return { id: fullMatch.channelId, guildId };
            }

            const candidate = isChannelContext
                ? (extractSnowflakeFromString(threadIdAttr)
                    ?? extractSnowflakeFromString(channelIdAttr)
                    ?? extractSnowflakeFromString(rawId)
                    ?? extractSnowflakeFromString(listId))
                : null;
            if (candidate) {
                const guildId = extractSnowflakeFromString(el.getAttribute("data-guild-id") ?? "") ?? undefined;
                return { id: candidate, guildId };
            }

            el = el.parentElement;
        }
        return null;
    },

    extractUserIdFromTarget(target: HTMLElement | null): string | null {
        let el: HTMLElement | null = target;
        while (el) {
            if (typeof (el as any).getAttribute !== "function") {
                el = (el as any).parentElement ?? null;
                continue;
            }
            const dataUserId = el.getAttribute("data-user-id") ?? el.getAttribute("data-userid") ?? "";
            const dataAuthorId = el.getAttribute("data-author-id") ?? "";
            const listId = el.getAttribute("data-list-item-id") ?? el.getAttribute("data-item-id") ?? "";
            const href = el.getAttribute("href") ?? "";
            const src = el.getAttribute("src") ?? "";
            const aria = el.getAttribute("aria-label") ?? "";

            const explicit = extractSnowflakeFromString(dataUserId)
                ?? extractSnowflakeFromString(dataAuthorId);
            if (explicit) return explicit;

            const listCandidate = extractSnowflakeFromString(listId);
            if (listCandidate) {
                if (UserStore.getUser(listCandidate)) return listCandidate;
                const channel = ChannelStore.getChannel(listCandidate);
                if (channel?.isDM?.() || channel?.type === ChannelType.DM || channel?.type === ChannelType.GROUP_DM) {
                    return this.getDmRecipientId(channel);
                }
            }

            const profile = href.match(userProfileUrlRegex);
            if (profile?.[1]) return profile[1];

            const avatar = src.match(guildUserAvatarRegex) ?? src.match(userAvatarRegex);
            if (avatar?.[1]) return avatar[1];

            const styleAttr = el.getAttribute("style") ?? "";
            const bgImage = (el as HTMLElement).style?.backgroundImage ?? "";
            const styleAvatar = extractUserFromAvatar(styleAttr + " " + bgImage);
            if (styleAvatar) return styleAvatar;

            const ariaMatch = extractSnowflakeFromString(aria);
            if (ariaMatch) return ariaMatch;

            el = el.parentElement;
        }
        return null;
    },

    extractUserIdFromEvent(event: DragEvent): string | null {
        const path = event.composedPath?.() ?? [];
        for (const entry of path) {
            const candidate = this.extractUserIdFromTarget(entry as HTMLElement | null);
            if (candidate) return candidate;
        }

        const target = event.target as HTMLElement | null;
        if (target) {
            const direct = target.closest?.("[data-author-id],[data-user-id]") as HTMLElement | null;
            if (direct) {
                return this.extractUserIdFromTarget(direct);
            }
        }

        if (typeof document !== "undefined" && typeof event.clientX === "number" && typeof event.clientY === "number") {
            const elements = document.elementsFromPoint?.(event.clientX, event.clientY);
            if (elements && elements.length) {
                for (const el of elements) {
                    const candidate = this.extractUserIdFromTarget(el as HTMLElement | null);
                    if (candidate) return candidate;
                }
            }
        }

        return null;
    },

    mountGhost() {
        mountDragGhost();
    },

    unmountGhost() {
        unmountDragGhost();
    },

    showGhost(entity: DropEntity, event?: DragEvent) {
        const ghost = this.buildGhost(entity);
        if (!ghost) return;
        const position = event && typeof event.clientX === "number" && typeof event.clientY === "number"
            ? { x: event.clientX + 16, y: event.clientY + 20 }
            : undefined;
        showDragGhost({ ...ghost, entityId: entity.id }, position);
    },

    buildGhost(entity: DropEntity): Omit<GhostState, "visible" | "x" | "y"> | null {
        if (entity.kind === "user") {
            const user = UserStore.getUser(entity.id);
            const title = user?.globalName ?? user?.username ?? "Unknown user";
            const subtitle = user?.username ? `@${user.username}` : "User";
            const iconUrl = user?.getAvatarURL?.(void 0, 80, true) ?? undefined;
            return { kind: "user", title, subtitle, iconUrl, symbol: "@", badge: "user", entityId: entity.id, exiting: false };
        }

        if (entity.kind === "channel") {
            const channel = ChannelStore.getChannel(entity.id);
            const isThread = Boolean(channel && typeof channel.isThread === "function" && channel.isThread());
            const title = channel?.name
                ? `${isThread ? "" : "#"}${channel.name}`
                : `${isThread ? "" : "#"}${entity.id}`;
            const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
            const subtitle = guild?.name ?? (entity.guildId ? "Server" : "Direct Messages");
            let iconUrl: string | undefined;
            if (guild?.icon) {
                iconUrl = IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 64 }) ?? undefined;
            } else if (channel?.isDM?.() || channel?.type === ChannelType.DM || channel?.type === ChannelType.GROUP_DM) {
                const recipientId = this.getDmRecipientId(channel);
                const recipient = recipientId ? UserStore.getUser(recipientId) : null;
                iconUrl = recipient?.getAvatarURL?.(void 0, 80, true) ?? undefined;
            }
            let badge = "channel";
            if (channel) {
                if (isThread) {
                    badge = "thread";
                } else {
                    switch (channel.type) {
                        case ChannelType.GUILD_VOICE:
                        case ChannelType.GUILD_STAGE_VOICE:
                            badge = "voice";
                            break;
                        case ChannelType.GUILD_FORUM:
                            badge = "forum";
                            break;
                        case ChannelType.GUILD_MEDIA:
                            badge = "media";
                            break;
                        case ChannelType.GUILD_ANNOUNCEMENT:
                            badge = "announcement";
                            break;
                        case ChannelType.DM:
                        case ChannelType.GROUP_DM:
                            badge = "dm";
                            break;
                        default:
                            badge = "channel";
                    }
                }
            }
            return { kind: "channel", title, subtitle, iconUrl, badge, entityId: entity.id, exiting: false };
        }

        const guild = GuildStore.getGuild(entity.id);
        const title = guild?.name ?? "Server";
        const subtitle = "Server";
        const iconUrl = guild?.icon
            ? IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 64 }) ?? undefined
            : undefined;
        const symbol = guild ? getGuildAcronym(guild) : "S";
        return { kind: "guild", title, subtitle, iconUrl, symbol, badge: "server", entityId: entity.id, exiting: false };
    },

    getDmRecipientId(channel?: Channel | null): string | null {
        if (!channel) return null;
        const raw =
            (channel as any).getRecipientId?.()
            ?? (channel as any).recipientId
            ?? channel.recipients?.[0]
            ?? (channel as any).rawRecipients?.[0]
            ?? null;
        return typeof raw === "string" ? raw : null;
    },
});
