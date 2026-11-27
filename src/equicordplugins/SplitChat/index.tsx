/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, type NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { XSmallIcon } from "@components/Icons";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { findByPropsLazy, findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import {
    ChannelStore, Clickable, GuildChannelStore, GuildStore, Menu, MessageStore, PermissionStore,
    openUserProfileModal, PermissionsBits, React, SelectedChannelStore, useStateFromStores
} from "@webpack/common";

import "./style.css";

type Channel = NonNullable<ReturnType<typeof ChannelStore.getChannel>>;
type Guild = NonNullable<ReturnType<typeof GuildStore.getGuild>>;

const ChannelChat = findComponentByCodeLazy("filterAfterTimestamp:", "chatInputType");
const ChatInputTypes = findByPropsLazy("FORM", "NORMAL");
const ChannelToolbarIcon = findComponentByCodeLazy("tooltipPosition:", '"aria-haspopup":', '"data-jump-section":');
const ChannelTypeIcon = findComponentByCodeLazy('"ChannelItemIcon")');
const ChannelRowClasses = findCssClassesLazy("iconItem", "iconNoChannelInfo", "actionIcon");
const MessageActions = findByPropsLazy("fetchMessages", "sendMessage");
const minWidth = 20;
const maxWidth = 68;
let splitWidth = 40;

let targetId: string | undefined;
const targetListeners = new Set<() => void>();

function subscribeToTarget(listener: () => void) {
    targetListeners.add(listener);
    return () => { targetListeners.delete(listener); };
}

function setTarget(channelId?: string) {
    targetId = channelId;
    for (const listener of targetListeners) listener();
}

function canRead(channel: Channel | undefined): channel is Channel {
    if (!channel || (channel.type !== 0 && channel.type !== 5) || channel.nsfw || !channel.guild_id) return false;
    const guild = GuildStore.getGuild(channel.guild_id) as (Guild & { nsfwLevel?: number; nsfw_level?: number }) | undefined;
    const ageRating = guild?.nsfwLevel ?? guild?.nsfw_level;
    return !!guild && ageRating !== 1 && ageRating !== 3
        && PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel)
        && PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel);
}

function closePane() {
    setTarget();
}

function SplitDock() {
    const channelId = React.useSyncExternalStore(subscribeToTarget, () => targetId);
    return channelId ? <SplitPane key={channelId} channelId={channelId} /> : null;
}

function SplitHeaderLabel() {
    const id = React.useSyncExternalStore(subscribeToTarget, () => targetId);
    const channel = useStateFromStores([ChannelStore, GuildStore, PermissionStore], () => {
        const current = id ? ChannelStore.getChannel(id) : undefined;
        return canRead(current) ? current : undefined;
    }, [id]);
    return channel ? <span className="vc-split-chat-title-label"><SplitLabel label={channel.name} channel={channel} /></span> : null;
}

function SplitHeaderClose() {
    const id = React.useSyncExternalStore(subscribeToTarget, () => targetId);
    return id ? <ErrorBoundary fallback={CloseSplitButton}>
        <ChannelToolbarIcon tooltip="Close split chat" icon={XSmallIcon} onClick={closePane} />
    </ErrorBoundary> : null;
}

function NativeChat({ channel }: { channel: Channel; }) {
    const guild = useStateFromStores([GuildStore], () => GuildStore.getGuild(channel.guild_id), [channel.guild_id]);
    const [loadFailed, setLoadFailed] = React.useState(false);

    React.useEffect(() => {
        if (MessageStore.hasPresent(channel.id)) return;
        let active = true;
        Promise.resolve(MessageActions.fetchMessages({ channelId: channel.id, limit: 50 })).catch(() => {
            if (active) setLoadFailed(true);
        });
        return () => { active = false; };
    }, [channel.id]);

    return <>
        {loadFailed && <p role="status">Discord couldn’t load recent messages for this channel.</p>}
        <ChannelChat channel={channel} guild={guild} chatInputType={ChatInputTypes.NORMAL} />
    </>;
}

function SplitDivider({ width, setWidth }: { width: number; setWidth: (width: number) => void; }) {
    const drag = React.useRef<{ pointer: number; x: number; width: number; available: number; direction: number; } | null>(null);

    function resize(next: number) {
        splitWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(next)));
        setWidth(splitWidth);
    }

    return <div className="vc-split-chat-divider" role="separator" tabIndex={0}
        aria-label="Resize split chat" aria-orientation="vertical" aria-controls="vc-split-chat-pane"
        aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={width}
        onPointerDown={event => {
            const host = event.currentTarget.closest<HTMLElement>(".vc-split-chat-host");
            const available = host?.parentElement?.clientWidth;
            if (event.button !== 0 || !event.isPrimary || !available || !host) return;
            const direction = getComputedStyle(host).direction === "rtl" ? 1 : -1;
            drag.current = { pointer: event.pointerId, x: event.clientX, width: 100 * host.offsetWidth / available, available, direction };
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
        }}
        onPointerMove={event => {
            const start = drag.current;
            if (start?.pointer !== event.pointerId) return;
            resize(start.width + start.direction * (event.clientX - start.x) * 100 / start.available);
        }}
        onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={event => {
            const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? 1 : -1;
            switch (event.key) {
                case "ArrowLeft": resize(splitWidth - 2 * direction); break;
                case "ArrowRight": resize(splitWidth + 2 * direction); break;
                case "Home": resize(minWidth); break;
                case "End": resize(maxWidth); break;
                default: return;
            }
            event.preventDefault();
        }}
    />;
}

function CloseSplitButton() {
    return <button className="vc-split-chat-close-fallback" type="button" onClick={closePane}
        aria-label="Close split chat" title="Close split chat">
        <XSmallIcon aria-hidden="true" />
    </button>;
}

function SplitLabel({ label, channel }: { label: string; channel?: Channel; }) {
    const guild = useStateFromStores([GuildStore], () => channel && GuildStore.getGuild(channel.guild_id), [channel?.guild_id]);
    return <>
        {channel && <ErrorBoundary noop><ChannelTypeIcon channel={channel} guild={guild} /></ErrorBoundary>}
        <strong title={label}>{label}</strong>
    </>;
}

function ChannelPicker({ guildId, selected }: { guildId: string; selected: string; }) {
    const [query, setQuery] = React.useState("");
    const channels = useStateFromStores([GuildChannelStore, ChannelStore, PermissionStore], () =>
        GuildChannelStore.getSelectableChannels(guildId) ?? [], [guildId]);
    const search = query.trim().toLocaleLowerCase();
    const matches = channels.map(entry => entry.channel).filter(channel =>
        channel.id !== selected && canRead(channel) && channel.name.toLocaleLowerCase().includes(search));

    return <div className="vc-split-chat-picker">
        <div className="vc-split-chat-picker-content">
            <h2>Choose a channel for split view</h2>
            <input type="search" aria-label="Find a channel" placeholder="Find a channel"
                value={query} onChange={event => setQuery(event.currentTarget.value)} />
            <ul>
                {matches.map(channel => <li key={channel.id}>
                    <button type="button" onClick={() => openPane(channel)}>
                        <SplitLabel label={channel.name} channel={channel} />
                    </button>
                </li>)}
            </ul>
            {!matches.length && <p>No matching channels in this server.</p>}
        </div>
    </div>;
}

function SplitPane({ channelId }: { channelId: string; }) {
    const channel = useStateFromStores([ChannelStore], () => ChannelStore.getChannel(channelId), [channelId]);
    const readable = useStateFromStores([ChannelStore, GuildStore, PermissionStore], () => canRead(ChannelStore.getChannel(channelId)));
    const selected = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getChannelId());
    const [width, setWidth] = React.useState(splitWidth);

    let content;
    if (!readable || !channel) {
        content = <p>This channel is no longer available.</p>;
    } else if (selected === channelId) {
        content = <ChannelPicker guildId={channel.guild_id} selected={channelId} />;
    } else {
        content = <div className="vc-split-chat-body">
            <ErrorBoundary><NativeChat channel={channel} /></ErrorBoundary>
        </div>;
    }

    return <div className="vc-split-chat-host" style={{ flexBasis: width + "%" }}>
        <section id="vc-split-chat-pane" className="vc-split-chat-pane" aria-label="Split chat">
            <SplitDivider width={width} setWidth={setWidth} />
            {content}
        </section>
    </div>;
}

function openPane(channel: Channel) {
    if (!canRead(channel) || targetId === channel.id || channel.id === SelectedChannelStore.getChannelId()) return;
    setTarget(channel.id);
}

function SplitChatIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M14 5v14" />
    </svg>;
}

function ChannelRowToggle({ channel }: { channel: Channel; }) {
    const active = React.useSyncExternalStore(subscribeToTarget, () => targetId === channel.id);
    const eligible = useStateFromStores([ChannelStore, GuildStore, PermissionStore, SelectedChannelStore],
        () => canRead(ChannelStore.getChannel(channel.id)) && SelectedChannelStore.getChannelId() !== channel.id,
        [channel.id]);
    if (!eligible) return null;

    const label = active ? "Close Split Chat" : "Open in Split Chat";
    return <Clickable className={ChannelRowClasses.iconItem + " " + ChannelRowClasses.iconNoChannelInfo}
        title={label} aria-label={label} aria-pressed={active}
        onMouseDown={event => event.stopPropagation()}
        onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            if (active) closePane();
            else openPane(channel);
        }}>
        <SplitChatIcon className={ChannelRowClasses.actionIcon} />
    </Clickable>;
}

const SafeChannelRowToggle = ErrorBoundary.wrap(ChannelRowToggle, { noop: true });

const patchChannelMenu: NavContextMenuPatchCallback = (children, { channel } = {}) => {
    if (!canRead(channel) || channel.id === SelectedChannelStore.getChannelId()) return;
    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;
    group.push(<Menu.MenuItem id="vc-split-chat-open" key="vc-split-chat-open"
        label="Open in Split Chat" leadingAccessory={{ type: "icon", icon: SplitChatIcon }}
        action={() => openPane(channel)} />);
};

export default definePlugin({
    name: "SplitChat",
    description: "Open a second server text channel beside the current Discord conversation.",
    authors: [{ name: "tubeo5866", id: 0n }],
    patches: [{
        find: "Missing channel in Channel.renderHeaderToolbar",
        group: true,
        replacement: [
            {
                match: /(?<=children:\[)this\.renderChat\(\)(?=,)/,
                replace: "$&,$self.renderSplitDock()"
            },
            {
                match: /renderFollowButton:this\.renderFollowButton\}\)/,
                replace: "$&,$self.renderSplitLabel()"
            },
            {
                match: /toolbar:this\.renderHeaderToolbar\(\)/,
                replace: "toolbar:[$self.renderSplitClose(),...this.renderHeaderToolbar()]"
            }
        ]
    }, {
        find: 'tutorialId:"instant-invite"',
        replacement: {
            match: /(?<=isSuggestedSection:\i\}\):null,)(?=this\.renderInviteButton\(\),this\.renderEditButton\(\))/,
            replace: "$self.renderChannelRowToggle(this.props.channel),"
        }
    }, {
        find: /showTimestampOnHover:.{0,100}showAvatarPopout:\i,showUsernamePopout:\i,onClickAvatar:/,
        replacement: {
            match: /(?<=guildId:(\i)\.guild_id,message:(\i),channel:\i,.{0,300}showAvatarPopout:\i,showUsernamePopout:\i,)onClickAvatar:(\i)(?=,onClickUsername:)/,
            replace: "onClickAvatar:(...args)=>$self.openSplitProfile(args[0],$2,$1)?void 0:$3(...args)"
        }
    }],
    openSplitProfile(event: React.MouseEvent, message: Message, channel: Channel) {
        if (!event?.currentTarget || !event.currentTarget.closest(".vc-split-chat-host") ||
            channel.id !== targetId || !message.author?.id) return false;

        event.stopPropagation();
        void openUserProfileModal({
            userId: message.author.id,
            guildId: channel.guild_id,
            channelId: channel.id,
            messageId: message.id
        });
        return true;
    },
    renderSplitDock() {
        return <SplitDock key="vc-split-chat-dock" />;
    },
    renderSplitLabel() {
        return <SplitHeaderLabel key="vc-split-chat-label" />;
    },
    renderSplitClose() {
        return <SplitHeaderClose key="vc-split-chat-close" />;
    },
    renderChannelRowToggle(channel: Channel) {
        return <SafeChannelRowToggle channel={channel} />;
    },
    contextMenus: { "channel-context": patchChannelMenu },
    stop: closePane
});
