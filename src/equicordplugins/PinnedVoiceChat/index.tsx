/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { PinIcon, XSmallIcon } from "@components/Icons";
import definePlugin from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import {
    ChannelStore, GuildStore, Menu, MessageStore, PermissionStore,
    PermissionsBits, React, SelectedChannelStore, showToast, useStateFromStores
} from "@webpack/common";

import "./style.css";

type Channel = NonNullable<ReturnType<typeof ChannelStore.getChannel>>;
const ChannelChat = findComponentByCodeLazy("filterAfterTimestamp:", "chatInputType");
const ChatInputTypes = findByPropsLazy("FORM", "NORMAL");
const MessageActions = findByPropsLazy("fetchMessages", "sendMessage");
const HeaderBar = findComponentByCodeLazy("toolbarClassName:", "}),onDoubleClick:");
const ToolbarIcon = findComponentByCodeLazy("tooltipPosition:", '"aria-haspopup":', '"data-jump-section":');
let pinnedId: string | undefined;

function canPin(channel: Channel | undefined): channel is Channel {
    if (!channel?.isGuildVoice() || channel.nsfw || !channel.guild_id) return false;
    const guild = GuildStore.getGuild(channel.guild_id) as { nsfwLevel?: number; nsfw_level?: number; } | undefined;
    const ageRating = guild?.nsfwLevel ?? guild?.nsfw_level;
    return !!guild && ageRating !== 1 && ageRating !== 3
        && PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel)
        && PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel);
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

function setPinned(id?: string) {
    pinnedId = id;
    for (const listener of listeners) listener();
}

function unpin() {
    setPinned();
}

function PinnedDock() {
    const id = React.useSyncExternalStore(subscribe, () => pinnedId);
    return id ? <div className="vc-pinned-voice-chat-host"><PinnedPanel key={id} channelId={id} /></div> : null;
}

function VoiceConversation({ channel }: { channel: Channel; }) {
    const guild = useStateFromStores([GuildStore], () => GuildStore.getGuild(channel.guild_id), [channel.guild_id]);
    const [loadFailed, setLoadFailed] = React.useState(false);
    const [attempt, retry] = React.useReducer((attempt: number) => attempt + 1, 0);

    React.useEffect(() => {
        if (MessageStore.hasPresent(channel.id)) return;
        let active = true;
        void (async () => {
            try {
                await MessageActions.fetchMessages({ channelId: channel.id, limit: 50 });
            } catch {
                if (active) setLoadFailed(true);
            }
        })();
        return () => { active = false; };
    }, [channel.id, attempt]);

    return <>
        {loadFailed && <p role="status">Couldn’t load voice-channel chat. <button type="button" onClick={() => {
            setLoadFailed(false);
            retry();
        }}>Retry</button></p>}
        <ChannelChat channel={channel} guild={guild} chatInputType={ChatInputTypes.SIDEBAR} />
    </>;
}

function PinnedPanel({ channelId }: { channelId: string; }) {
    const channel = useStateFromStores([ChannelStore], () => ChannelStore.getChannel(channelId), [channelId]);
    const readable = useStateFromStores([ChannelStore, GuildStore, PermissionStore],
        () => canPin(ChannelStore.getChannel(channelId)), [channelId]);
    const name = readable && channel ? channel.name : "Pinned voice chat";

    return <section className="vc-pinned-voice-chat" aria-label={"Pinned voice chat, " + name}>
        <ErrorBoundary fallback={() => <header>
            <strong>{name}</strong>
            <button type="button" onClick={unpin}>Unpin</button>
        </header>}>
            <HeaderBar disableDoubleClick
                toolbar={<ToolbarIcon tooltip="Unpin voice chat" icon={XSmallIcon} onClick={unpin} />}>
                <span className="vc-pinned-voice-chat-title">
                    <PinIcon aria-hidden="true" />
                    <strong title={name}>{name}</strong>
                </span>
            </HeaderBar>
        </ErrorBoundary>
        <div className="vc-pinned-voice-chat-body">
            {readable && channel ? <ErrorBoundary><VoiceConversation channel={channel} /></ErrorBoundary>
                : <p>This voice channel is no longer available.</p>}
        </div>
    </section>;
}

function pin(channel: Channel) {
    if (!canPin(channel) || pinnedId === channel.id) return;
    setPinned(channel.id);
}

const patchChannelMenu: NavContextMenuPatchCallback = (children, { channel } = {}) => {
    if (!canPin(channel)) return;
    children.push(<Menu.MenuItem key="vc-pin-voice-chat" id="vc-pin-voice-chat"
        label={pinnedId === channel.id ? "Unpin Voice Chat" : "Pin Voice Chat"}
        leadingAccessory={{ type: "icon", icon: PinIcon }}
        action={() => pinnedId === channel.id ? unpin() : pin(channel)} />);
};

export default definePlugin({
    name: "PinnedVoiceChat",
    description: "Pin a voice channel’s text chat while browsing Discord.",
    authors: [{ name: "tubeo5866", id: 0n }],
    patches: [{
        find: "Missing channel in Channel.renderHeaderToolbar",
        replacement: {
            match: /this\.renderThreadSidebar\(\)(?=\]\}\))/,
            replace: "$&,$self.renderPinnedPanel()"
        }
    }, {
        find: /\.CALL_CHAT_BUTTON_TEXT_IN_VOICE_COACH_MARK,\{dismissAction:/,
        replacement: {
            match: /(?<=onClick:(\i)\}\);return.{0,260}channel:(\i),draftType:.{0,90})toolbar:(\i)(?=,"aria-label":)/,
            replace: "toolbar:[$self.renderPinAction($2,$1),$3]"
        }
    }],
    renderPinnedPanel() {
        return <PinnedDock key="vc-pinned-voice-chat" />;
    },
    renderPinAction(channel: Channel, closeNativeChat: () => void) {
        if (!canPin(channel)) return null;
        return <ErrorBoundary noop>
            <ToolbarIcon tooltip="Pin Voice Chat" icon={PinIcon} onClick={() => {
                pin(channel);
                if (pinnedId === channel.id) closeNativeChat();
            }} />
        </ErrorBoundary>;
    },
    contextMenus: { "channel-context": patchChannelMenu },
    toolboxActions: {
        "Pin Connected Voice Chat"() {
            const voiceId = SelectedChannelStore.getVoiceChannelId() ?? SelectedChannelStore.getChannelId();
            const channel = voiceId ? ChannelStore.getChannel(voiceId) : undefined;
            if (canPin(channel)) pin(channel);
            else showToast({ text: "Choose a voice channel with accessible text chat.", variant: "critical" });
        }
    },
    stop: unpin
});
