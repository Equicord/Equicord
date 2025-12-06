/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, DraftStore, DraftType, GuildChannelStore, GuildStore, PermissionsBits, PermissionStore, React, RestAPI, SelectedChannelStore, showToast, Toasts, UserStore } from "@webpack/common";

type DropEntity =
    | { kind: "user"; id: string; }
    | { kind: "channel"; id: string; guildId?: string; }
    | { kind: "guild"; id: string; };

type DraftActions = {
    saveDraft(channelId: string, draft: string, draftType: number): void;
    changeDraft(channelId: string, draft: string, draftType: number): void;
    setDraft?: (channelId: string, draft: string, draftType: number) => void;
};

const DraftActions = findByPropsLazy("saveDraft", "changeDraft") as DraftActions;
let pluginInstance: any = null;
let activeGuildDragId: string | null = null;

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
});

const userMentionRegex = /<@!?(\d{17,20})>/;
const userProfileUrlRegex = /discord(?:(?:app)?\.com|:\/\/-?)\/users\/(\d{17,20})/;
const userAvatarRegex = /cdn\.discordapp\.com\/(?:avatars|users)\/(\d{17,20})\//;
const guildUserAvatarRegex = /cdn\.discordapp\.com\/guilds\/\d{17,20}\/users\/(\d{17,20})\/avatars\//;
const channelMentionRegex = /<#(\d{17,20})>/;
const channelUrlRegex = /discord(?:(?:app)?\.com|:\/\/-?)\/channels\/(?:(@me)|(\d{17,20}))\/(\d{17,20})/;
const guildIconRegex = /cdn\.discordapp\.com\/icons\/(\d{17,20})\//;

export default definePlugin({
    name: "Dragify",
    description: "Drop users, channels, or servers into chat to insert mentions or invites.",
    authors: [EquicordDevs.justjxke],
    settings,

    patches: [
        // Chat input form (wire drop handlers)
        {
            find: "ref:this.inputFormRef,onSubmit:eQ,className:a()(eK.form",
            replacement: {
                match: "ref:this.inputFormRef,onSubmit:eQ,className:a()(eK.form,{[eK.formWithLoadedChatInput]:!P}),children:",
                replace: "ref:this.inputFormRef,onDragOverCapture:e=>Vencord.Plugins.plugins[\"Dragify\"].onDragOver(e,n),onDropCapture:e=>Vencord.Plugins.plugins[\"Dragify\"].onDrop(e,n),onDragOver:e=>Vencord.Plugins.plugins[\"Dragify\"].onDragOver(e,n),onDrop:e=>Vencord.Plugins.plugins[\"Dragify\"].onDrop(e,n),onSubmit:eQ,className:a()(eK.form,{[eK.formWithLoadedChatInput]:!P}),children:"
            }
        },
        // Voice user rows (voice channel sidebar)
        {
            find: "x.voiceUser",
            replacement: {
                match: /className:o\(\)\(x\.voiceUser/,
                replace: "draggable:!0,onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onUserDragStart(e,s),className:o()(x.voiceUser"
            }
        },
        // Voice channel container (voice channel sidebar)
        {
            find: "className:G.voiceUserContainer",
            replacement: {
                match: "className:G.voiceUserContainer",
                replace: "draggable:!0,onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onChannelDragStart(e,{id:a.id,guild_id:a.guild_id}),className:G.voiceUserContainer"
            }
        },
        // Voice channel list rows (guild sidebar)
        {
            find: "className:o()(this.getModeClass(),{[V.disabled]:this.isDisabled()}),\"data-dnd-name\":e.name",
            replacement: {
                match: "className:o()(this.getModeClass(),{[V.disabled]:this.isDisabled()}),\"data-dnd-name\":e.name",
                replace: "className:o()(this.getModeClass(),{[V.disabled]:this.isDisabled()}),draggable:!0,onDragStart:t=>Vencord.Plugins.plugins[\"Dragify\"].onChannelDragStart(t,{id:e.id,guild_id:e.guild_id}),\"data-dnd-name\":e.name"
            }
        },
        // Channel list items (text/voice/thread/forum)
        {
            find: "\"data-dnd-name\":U.name",
            replacement: {
                match: /className:(\i)\.draggable,"data-dnd-name":(\i)\.name/,
                replace: "className:$1.draggable,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e,{id:U.id,guild_id:U.guild_id}),\"data-dnd-name\":$2.name"
            }
        },
        // Thread rows in channel list
        {
            find: "T.link,onClick:z",
            replacement: {
                match: /className:T\.link,onClick:z,"aria-label":ee,focusProps:\{enabled:!1\}/,
                replace: "className:T.link,draggable:!0,onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onChannelDragStart(e,{id:t.id,guild_id:t.guild_id}),onClick:z,\"aria-label\":ee,focusProps:{enabled:!1}"
            }
        },
        // Member list rows
        {
            find: "onContextMenu:J,onMouseEnter:eD",
            replacement: {
                match: "onContextMenu:J,onMouseEnter:eD",
                replace: "onContextMenu:J,draggable:!0,onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onUserDragStart(e,b),onMouseEnter:eD"
            }
        },
        // Chat usernames
        {
            find: "N.username",
            replacement: {
                match: /className:o\(\)\(N\.username[^)]*\),style:eg\(\),onClick:Z,onContextMenu:B/,
                replace: "className:o()(N.username,eo,{[eh]:ep,[N.usernameColorOnName]:\"username\"===er&&null!=$}),style:eg(),onClick:Z,onContextMenu:B,draggable:!0,onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onUserDragStart(e,eO)"
            }
        },
        // DM list entries
        {
            find: "className:I.link",
            replacement: {
                match: /className:I\.link,onClick:\(\)=>null==g\?void 0:g\(u\)/,
                replace: "className:I.link,draggable:!0,onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onChannelDragStart(e,{id:u.id,guild_id:u.guild_id}),onClick:()=>null==g?void 0:g(u)"
            }
        },
        // DM list links
        {
            find: "link__972a0",
            replacement: {
                match: "link__972a0",
                replace: "link__972a0 dragify_dm_link"
            }
        },
        // Thread/channel links
        {
            find: "link__2ea32",
            replacement: {
                match: "link__2ea32",
                replace: "link__2ea32 dragify_thread_link"
            }
        },
        // Guild list buttons (guild sidebar)
        {
            find: "wrapper__6e9f8",
            replacement: {
                match: "wrapper__6e9f8",
                replace: "wrapper__6e9f8 dragify_guild_icon"
            }
        },
        {
            find: "\"data-dnd-name\":V.name",
            replacement: {
                match: /className:o\(\)\(T\.blobContainer,\{[^}]+\}\),/,
                replace: "className:o()(T.blobContainer,{[T.sorting]:$,[T.wobble]:e_,[T.selected]:e_||W}),draggable:!0,onMouseDown:e=>Vencord.Plugins.plugins[\"Dragify\"].rememberGuildId(V.id),onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onGuildDragStart(e,V.id),"
            }
        },
        // Chat avatars (popout)
        {
            find: "avatarImgRef:C",
            replacement: {
                match: /className:_,avatarImgRef:C/,
                replace: "className:_,avatarImgRef:C,draggable:!0,onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onUserDragStart(e,{id:m.author.id})"
            }
        },
        // Chat avatars (no popout)
        {
            find: "children:ee(X(q({},W)",
            replacement: {
                match: /children:ee\(X\(q\(\{\},W\),\{[^}]*className:_\}\)\)\}\)/,
                replace: "children:ee(X(q({},W),{avatarSrc:z,avatarDecorationSrc:Y,compact:g,onClick:v,onContextMenu:O,onMouseDown:void 0,onKeyDown:void 0,showCommunicationDisabledStyles:d,className:_,draggable:!0,onDragStart:e=>Vencord.Plugins.plugins[\"Dragify\"].onUserDragStart(e,{id:m.author.id})}))})"
            }
        },
    ],

    onDragOver(event: React.DragEvent, channel: Channel) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },

    async onDrop(event: React.DragEvent, channel: Channel) {
        event.preventDefault();
        event.stopPropagation();

        const { dataTransfer } = event;
        if (!dataTransfer || !channel) return;

        const dragifyData = dataTransfer.getData("application/dragify");
        if (dragifyData) {
            const parsed = this.tryParseJson(dragifyData);
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
                    await this.handleDropEntity(fromDragify, channel, dragifyData);
                    return;
                }
            }
        }

        const payloads = await this.collectPayloadStrings(dataTransfer);
        let entity = this.parseFromStrings(payloads);
        if (!entity && activeGuildDragId) {
            const jsonOnly = dataTransfer.types?.includes("application/json") && payloads.length === 1 && payloads[0] === "[object Object]";
            if (jsonOnly || payloads.includes("[object Object]")) {
                entity = { kind: "guild", id: activeGuildDragId };
            }
        }
        if (!entity) {
            return;
        }

        await this.handleDropEntity(entity, channel, payloads);
    },

    async handleDropEntity(entity: DropEntity, channel: Channel, payloads: string[] | string) {
        try {
            const text = await this.buildText(entity, channel);
            if (!text) return;
            this.insertText(channel.id, text);
            if (entity.kind === "guild") activeGuildDragId = null;
        } catch (error) {
            console.error("Dragify failed handling drop", error);
            showToast("Dragify failed to handle drop.", Toasts.Type.FAILURE);
        }
    },

    parseFromStrings(payloads: string[]): DropEntity | null {
        if (payloads.length === 0) return null;

        for (const value of payloads) {
            const parsed = this.tryParseJson(value);
            if (parsed) {
                const id = parsed.id ?? parsed.userId ?? parsed.channelId ?? parsed.guildId;
                const type = (parsed.type ?? parsed.kind ?? parsed.itemType ?? "").toLowerCase();
                if (id) {
                    if (type.includes("user")) return { kind: "user", id };
                    if (type.includes("channel")) return { kind: "channel", id, guildId: parsed.guildId };
                    if (type.includes("guild") || type.includes("server")) return { kind: "guild", id };
                }
            }
        }

        for (const value of payloads) {
            const trimmed = value.trim();
            if (!trimmed) continue;
            const userFromMention = userMentionRegex.exec(trimmed);
            if (userFromMention) return { kind: "user", id: userFromMention[1] };
            const userFromProfile = userProfileUrlRegex.exec(trimmed);
            if (userFromProfile) return { kind: "user", id: userFromProfile[1] };
            const guildUserAvatar = guildUserAvatarRegex.exec(trimmed);
            if (guildUserAvatar) return { kind: "user", id: guildUserAvatar[1] };
            const userFromAvatar = userAvatarRegex.exec(trimmed);
            if (userFromAvatar) return { kind: "user", id: userFromAvatar[1] };
        }

        for (const value of payloads) {
            const trimmed = value.trim();
            if (!trimmed) continue;
            const channelFromMention = channelMentionRegex.exec(trimmed);
            if (channelFromMention) return { kind: "channel", id: channelFromMention[1] };
            const channelFromUrl = channelUrlRegex.exec(trimmed);
            if (channelFromUrl) {
                const guildId = channelFromUrl[1] === "@me" ? "@me" : channelFromUrl[2];
                return { kind: "channel", id: channelFromUrl[3], guildId: guildId ?? undefined };
            }
        }

        for (const value of payloads) {
            const trimmed = value.trim();
            if (!trimmed) continue;
            const guildFromIcon = guildIconRegex.exec(trimmed);
            if (guildFromIcon) return { kind: "guild", id: guildFromIcon[1] };
        }

        const candidates = this.extractSnowflakes(payloads);
        for (const candidate of candidates) {
            if (ChannelStore.getChannel(candidate)) return { kind: "channel", id: candidate };
            if (GuildStore.getGuild(candidate)) return { kind: "guild", id: candidate };
            if (UserStore.getUser(candidate)) return { kind: "user", id: candidate };
        }
        return null;
    },

    tryParseJson(value: string): Record<string, any> | null {
        if (!value || value.length < 2 || (value[0] !== "{" && value[0] !== "[")) return null;
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === "object" && parsed ? parsed : null;
        } catch {
            return null;
        }
    },

    extractStrings(dataTransfer: DataTransfer): string[] {
        const collected = new Set<string>();
        const add = (v?: string) => v && collected.add(v);
        add(dataTransfer.getData("text/plain"));
        add(dataTransfer.getData("text/uri-list"));
        add(dataTransfer.getData("text/html"));
        add(dataTransfer.getData("text/x-moz-url"));
        add(dataTransfer.getData("application/json"));
        for (const type of dataTransfer.types ?? []) add(dataTransfer.getData(type));

        const split: string[] = [];
        for (const v of collected) {
            split.push(v);
            if (v.includes("\n")) split.push(...v.split(/\s+/).filter(Boolean));
        }
        return Array.from(new Set(split));
    },

    async collectPayloadStrings(dataTransfer: DataTransfer): Promise<string[]> {
        const sync = this.extractStrings(dataTransfer);
        const asyncValues: string[] = [];
        const itemPromises = Array.from(dataTransfer.items ?? [])
            .filter(item => item.kind === "string")
            .map(item => new Promise<void>(resolve => item.getAsString(val => {
                if (val) asyncValues.push(val);
                resolve();
            })));
        await Promise.all(itemPromises);
        return Array.from(new Set([...sync, ...asyncValues]));
    },

    extractSnowflakes(values: string[]): string[] {
        const ids = new Set<string>();
        const regex = /\d{17,20}/g;
        for (const value of values) {
            const matches = value.match(regex);
            if (matches) matches.forEach(id => ids.add(id));
        }
        return Array.from(ids);
    },

    shouldHandle(dataTransfer?: DataTransfer | null): boolean {
        if (!dataTransfer || dataTransfer.files?.length) return false;
        return this.parseFromStrings(this.extractStrings(dataTransfer)) !== null;
    },

    async buildText(entity: DropEntity, currentChannel: Channel): Promise<string | null> {
        switch (entity.kind) {
            case "user":
                return settings.store.userOutput === "id" ? entity.id : `<@${entity.id}>`;
            case "channel":
                return this.formatChannel(entity.id, entity.guildId);
            case "guild":
                return this.createInvite(entity.id, currentChannel);
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
        if (!inviteChannel) {
            showToast("No channel available for invites.", Toasts.Type.FAILURE);
            return null;
        }
        if (inviteChannel.guild_id !== guildId) {
            showToast("No channel available for invites.", Toasts.Type.FAILURE);
            return null;
        }

        try {
            const { body } = await RestAPI.post({
                url: `/channels/${inviteChannel.id}/invites`,
                body: {
                    max_age: settings.store.inviteExpireAfter,
                    max_uses: settings.store.inviteMaxUses,
                    temporary: settings.store.inviteTemporaryMembership,
                    unique: true,
                },
            });
            const code = typeof body === "object" && body ? (body as { code?: string; }).code : null;
            if (!code) throw new Error("Invite response missing code");
            showToast("Invite created.", Toasts.Type.SUCCESS);
            return `https://discord.gg/${code}`;
        } catch (error) {
            console.error("Dragify failed to create invite", error);
            showToast("Unable to create invite.", Toasts.Type.FAILURE); // uh oh!
            return null;
        }
    },

    findInviteChannel(guildId: string, currentChannel: Channel): Channel | null {
        if (currentChannel.guild_id === guildId && this.canCreateInvite(currentChannel)) return currentChannel;

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
        if (typeof channel.isThread === "function" && channel.isThread()) return false;
        return PermissionStore.can(PermissionsBits.CREATE_INSTANT_INVITE, channel);
    },

    insertText(channelId: string, text: string) {
        const existing = DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "";
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

    onChannelDragStart(event: DragEvent, channel: Pick<Channel, "id" | "guild_id">) {
        const payload = JSON.stringify({ kind: "channel", id: channel.id, guildId: channel.guild_id });
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer?.setData("text/plain", `https://discord.com/channels/${channel.guild_id ?? "@me"}/${channel.id}`);
        event.dataTransfer?.setData("application/dragify", payload);
    },

    onUserDragStart(event: DragEvent, user: { id: string; }) {
        const payload = JSON.stringify({ kind: "user", id: user.id });
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer?.setData("text/plain", `<@${user.id}>`);
        event.dataTransfer?.setData("application/dragify", payload);
    },

    onGuildDragStart(event: DragEvent, guildId: string) {
        const payload = JSON.stringify({ kind: "guild", id: guildId });
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
        activeGuildDragId = guildId;
        event.dataTransfer?.setData("application/dragify", payload);
        event.dataTransfer?.setData("text/plain", guildId);
    },

    rememberGuildId(guildId: string) {
        activeGuildDragId = guildId;
    },

    start() {
        pluginInstance = this;
        window.addEventListener("dragover", this.globalDragOver, true);
        window.addEventListener("drop", this.globalDrop, true);
        window.addEventListener("dragstart", this.globalDragStart, true);
    },

    stop() {
        window.removeEventListener("dragover", this.globalDragOver, true);
        window.removeEventListener("drop", this.globalDrop, true);
        window.removeEventListener("dragstart", this.globalDragStart, true);
        activeGuildDragId = null;
        pluginInstance = null;
    },

    globalDragOver: (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst) return;
        const types = event.dataTransfer?.types ?? [];
        const hasDragify = types.includes("application/dragify");
        const parsed = inst.parseFromStrings(inst.extractStrings(event.dataTransfer as DataTransfer));
        if (!hasDragify && !parsed) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },

    globalDrop: async (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst) return;
        const channelId = SelectedChannelStore?.getChannelId?.();
        const channel = channelId ? ChannelStore.getChannel(channelId) : null;
        if (!channel) return;

        const types = event.dataTransfer?.types ?? [];
        const hasDragify = types.includes("application/dragify");
        const likelyJson = types.includes("application/json");

        const payloads = await inst.collectPayloadStrings(event.dataTransfer as DataTransfer);
        const entity = inst.parseFromStrings(payloads);
        if (!hasDragify && !entity && !likelyJson) return;

        event.preventDefault();
        event.stopPropagation();
        inst.onDrop(event as unknown as React.DragEvent, channel);
    },

    globalDragStart: (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst || !event.dataTransfer) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        const hasGuildClass = (() => {
            let el: HTMLElement | null = target;
            while (el) {
                if (el.classList?.contains("dragify_guild_icon") || el.classList?.contains("wrapper__6e9f8")) return true;
                el = el.parentElement;
            }
            return false;
        })();

        const guildId = inst.extractGuildIdFromTarget(target);
        if (!guildId) return;

        if (hasGuildClass || !event.dataTransfer.types?.includes("application/dragify")) {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "copy";
            activeGuildDragId = guildId;
            event.dataTransfer.setData("application/dragify", JSON.stringify({ kind: "guild", id: guildId }));
            event.dataTransfer.setData("text/plain", guildId);
        }
    },

    extractGuildIdFromTarget(target: HTMLElement): string | null {
        let el: HTMLElement | null = target;
        while (el) {
            const classList = el.classList ?? [];
            const listId = el.getAttribute("data-list-id");
            const rawId = el.getAttribute("data-list-item-id") ?? "";
            const isGuildContext =
                classList.contains("dragify_guild_icon") ||
                classList.contains("wrapper__6e9f8") ||
                (listId && /guild/i.test(listId)) ||
                (/guild/i.test(rawId));

            if (!isGuildContext) {
                el = el.parentElement;
                continue;
            }

            const parts = rawId.split("___");
            const candidate = parts[parts.length - 1] ?? rawId;
            if (/^\d{17,20}$/.test(candidate)) return candidate;

            const direct =
                this.extractSnowflakeFromString(rawId) ??
                this.extractSnowflakeFromString(listId ?? "") ??
                this.extractSnowflakeFromString(el.getAttribute("data-guild-id") ?? "");
            if (direct) return direct;

            el = el.parentElement;
        }
        return null;
    },

    extractSnowflakeFromString(value: string): string | null {
        const match = value.match(/\d{17,20}/);
        return match?.[0] ?? null;
    },
});
