/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { XSmallIcon } from "@components/Icons";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import {
    ChannelRouter, ChannelStore, Menu, MessageStore, React, ReactDOM,
    SelectedChannelStore, showToast, UserStore, useStateFromStores
} from "@webpack/common";

import "./style.css";

type Channel = NonNullable<ReturnType<typeof ChannelStore.getChannel>>;
const ChannelChat = findComponentByCodeLazy("filterAfterTimestamp:", "chatInputType");
const HeaderBar = findComponentByCodeLazy("toolbarClassName:", "}),onDoubleClick:");
const ToolbarIcon = findComponentByCodeLazy("tooltipPosition:", '"aria-haspopup":', '"data-jump-section":');
const ChatInputTypes = findByPropsLazy("FORM", "NORMAL");
const MessageActions = findByPropsLazy("fetchMessages", "sendMessage");
const panels = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot: { entries: [string, number][]; frontId?: string; } = { entries: [] };
let frontId: string | undefined;

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

function publish() {
    snapshot = { entries: [...panels], frontId };
    for (const listener of listeners) listener();
}

function FloatingPanels() {
    const { entries, frontId } = React.useSyncExternalStore(subscribe, () => snapshot);
    if (!entries.length) return null;

    return ReactDOM.createPortal(
        entries.map(([channelId, slot]) => (
            <div key={channelId} className={frontId === channelId ? "vc-floating-dms-host vc-floating-dms-front" : "vc-floating-dms-host"}>
                <FloatingPanel channelId={channelId} slot={slot} />
            </div>
        )),
        document.getElementById("app-mount") ?? document.body
    );
}

const settings = definePluginSettings({
    maxBubbles: {
        type: OptionType.SLIDER,
        description: "Maximum number of floating DM bubbles",
        default: 3,
        markers: [1, 2, 3, 4, 5, 6, 7, 8],
        stickToMarkers: true,
        onChange: limit => {
            for (const id of [...panels.keys()].slice(limit)) closePanel(id);
        }
    }
});

function closePanel(channelId: string) {
    if (!panels.delete(channelId)) return;
    if (frontId === channelId) frontId = undefined;
    publish();
}

function FloatingIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        <path d="M19 9V5H4v12h5" />
        <rect x="9" y="9" width="11" height="11" rx="2" />
    </svg>;
}

function ExpandIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
        <path d="M6 18 18 6M8 6h10v10" />
    </svg>;
}

function MinimizeIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
        <path d="M5 12h14" />
    </svg>;
}

function Conversation({ channel }: { channel: Channel; }) {
    const [error, setError] = React.useState(false);
    const [attempt, retry] = React.useReducer((value: number) => value + 1, 0);

    React.useEffect(() => {
        if (MessageStore.hasPresent(channel.id)) return;
        let active = true;
        (async () => {
            try {
                await MessageActions.fetchMessages({ channelId: channel.id, limit: 50 });
            } catch {
                if (active) setError(true);
            }
        })();
        return () => { active = false; };
    }, [channel.id, attempt]);

    return <>
        {error && <p role="status">Couldn’t load messages. <button type="button" onClick={() => {
            setError(false);
            retry();
        }}>Retry</button></p>}
        <ChannelChat channel={channel} guild={null} chatInputType={ChatInputTypes.NORMAL} />
    </>;
}

function FloatingPanel({ channelId, slot }: { channelId: string; slot: number; }) {
    const channel = useStateFromStores([ChannelStore], () => ChannelStore.getChannel(channelId), [channelId]);
    const selected = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getChannelId());

    React.useEffect(() => {
        if (selected !== channelId) return;
        let active = true;
        queueMicrotask(() => {
            if (active && SelectedChannelStore.getChannelId() === channelId) closePanel(channelId);
        });
        return () => { active = false; };
    }, [selected, channelId]);
    const title = useStateFromStores([UserStore, ChannelStore], () => {
        const dm = ChannelStore.getChannel(channelId);
        if (!dm) return "Floating DM";
        if (dm.name) return dm.name;
        const names = dm.recipients.map(id => {
            const user = UserStore.getUser(id);
            return user?.globalName || user?.username;
        }).filter(Boolean);
        return names.join(", ") || "Direct message";
    }, [channelId]);
    const avatar = useStateFromStores([UserStore, ChannelStore], () => {
        const dm = ChannelStore.getChannel(channelId);
        const user = dm?.isDM() ? UserStore.getUser(dm.recipients[0]) : undefined;
        return user?.getAvatarURL(undefined, 64, false);
    }, [channelId]);
    const [minimized, setMinimized] = React.useState(true);
    const panel = React.useRef<HTMLElement>(null);
    const drag = React.useRef<{ pointer: number; dx: number; dy: number; } | null>(null);
    const bubbleDrag = React.useRef<{ pointer: number; x: number; y: number; left: number; top: number; moved: boolean; } | null>(null);
    const [position, setPosition] = React.useState<{ left: number; top: number; }>();
    const [viewportWidth, setViewportWidth] = React.useState(() => window.innerWidth);
    const previousBounds = React.useRef<DOMRect | null>(null);
    const animation = React.useRef<Animation | null>(null);

    function toggleBubble(next: boolean) {
        animation.current?.cancel();
        previousBounds.current = panel.current?.getBoundingClientRect() ?? null;
        setMinimized(next);
    }

    React.useLayoutEffect(() => {
        const before = previousBounds.current;
        previousBounds.current = null;
        const element = panel.current;
        if (!before || !element) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const after = element.getBoundingClientRect();
        if (!after.width || !after.height) return;
        animation.current = element.animate([
            { transform: "translate(" + (before.x - after.x) + "px, " + (before.y - after.y) + "px) scale(" +
                before.width / after.width + ", " + before.height / after.height + ")", opacity: 0.75 },
            { transform: "none", opacity: 1 }
        ], { duration: minimized ? 135 : 170, easing: "cubic-bezier(.2,.75,.25,1)" });
        return () => animation.current?.cancel();
    }, [minimized]);

    function move(left: number, top: number) {
        const element = panel.current;
        if (!element) return;
        const nextLeft = Math.max(8, Math.min(left, window.innerWidth - element.offsetWidth - 8));
        const nextTop = Math.max(8, Math.min(top, window.innerHeight - element.offsetHeight - 8));
        setPosition({ left: nextLeft, top: nextTop });
    }

    React.useLayoutEffect(() => {
        const element = panel.current;
        if (!element) return;
        function fit() {
            if (!element) return;
            setViewportWidth(window.innerWidth);
            setPosition(current => {
                if (!current) return current;
                const left = Math.max(8, Math.min(current.left, window.innerWidth - element.offsetWidth - 8));
                const top = Math.max(8, Math.min(current.top, window.innerHeight - element.offsetHeight - 8));
                return left === current.left && top === current.top ? current : { left, top };
            });
        }
        const observer = new ResizeObserver(fit);
        observer.observe(element);
        window.addEventListener("resize", fit);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", fit);
        };
    }, []);

    function raisePanel() {
        if (frontId === channelId) return;
        frontId = channelId;
        publish();
    }

    const columns = Math.max(1, Math.floor((viewportWidth - 36) / 60));
    const bubblePosition = { right: 18 + slot % columns * 60, bottom: 18 + Math.floor(slot / columns) * 60 };
    const style = position ? { ...position, right: "auto", bottom: "auto" } : minimized ? bubblePosition : undefined;

    return <section className="vc-floating-dms-panel" data-minimized={minimized} ref={panel} style={style}
        aria-label={`Floating conversation with ${title}`} onPointerDownCapture={raisePanel} onFocusCapture={raisePanel}>
        {minimized && <button className="vc-floating-dms-bubble" type="button"
            aria-label={"Expand conversation with " + title} title={title}
            onPointerDown={event => {
                if (event.button !== 0 || !event.isPrimary || !panel.current) return;
                const rect = panel.current.getBoundingClientRect();
                bubbleDrag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
                const start = bubbleDrag.current;
                if (start?.pointer !== event.pointerId || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                if (!start.moved && Math.hypot(dx, dy) < 5) return;
                start.moved = true;
                move(start.left + dx, start.top + dy);
            }}
            onClick={event => {
                if (!bubbleDrag.current?.moved || event.detail === 0) toggleBubble(false);
                bubbleDrag.current = null;
            }}>
            {avatar ? <img src={avatar} alt="" draggable={false} /> : <FloatingIcon />}
        </button>}
        <header hidden={minimized}>
            <HeaderBar disableDoubleClick toolbar={<>
                {channel?.isPrivate() && <ToolbarIcon tooltip="Open DM in main view" icon={ExpandIcon}
                    onClick={() => ChannelRouter.transitionToChannel(channelId)} />}
                <ToolbarIcon tooltip="Minimize to chat bubble" icon={MinimizeIcon} onClick={() => toggleBubble(true)} />
                <ToolbarIcon tooltip="Close floating DM" icon={XSmallIcon} onClick={() => closePanel(channelId)} />
            </>}>
            <div className="vc-floating-dms-handle" onPointerDown={event => {
                if (event.button !== 0 || !event.isPrimary || !panel.current) return;
                const rect = panel.current.getBoundingClientRect();
                drag.current = { pointer: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
                event.currentTarget.setPointerCapture(event.pointerId);
                event.preventDefault();
            }} onPointerMove={event => {
                const start = drag.current;
                if (start?.pointer === event.pointerId) move(event.clientX - start.dx, event.clientY - start.dy);
            }} onLostPointerCapture={() => { drag.current = null; }}>
                <FloatingIcon />
                <strong title={title}>{title}</strong>
            </div>
            </HeaderBar>
        </header>
        <div className="vc-floating-dms-body" hidden={minimized}>
            {!channel?.isPrivate() ? <p>This conversation is no longer available.</p>
                : selected !== channelId && <ErrorBoundary><Conversation channel={channel} /></ErrorBoundary>}
        </div>
    </section>;
}

function openPanel(channel: Channel) {
    if (!channel.isPrivate() || panels.has(channel.id) || SelectedChannelStore.getChannelId() === channel.id) return;
    const limit = settings.store.maxBubbles;
    if (panels.size >= limit) {
        showToast({ text: "Floating DM bubble limit reached. Close a bubble or raise the limit in settings.", variant: "critical" });
        return;
    }
    const usedSlots = new Set(panels.values());
    let slot = 0;
    while (usedSlots.has(slot)) slot++;
    panels.set(channel.id, slot);
    publish();
}

function menuItem(channel: Channel) {
    const active = panels.has(channel.id);
    return <Menu.MenuItem id="vc-floating-dms-toggle" key="vc-floating-dms-toggle"
        label={active ? "Close Floating DM" : "Open Floating DM"}
        disabled={!active && SelectedChannelStore.getChannelId() === channel.id}
        leadingAccessory={{ type: "icon", icon: FloatingIcon }}
        action={() => panels.has(channel.id) ? closePanel(channel.id) : openPanel(channel)} />;
}

const patchChannel: NavContextMenuPatchCallback = (children, { channel } = {}) => {
    if (channel?.isPrivate()) children.push(menuItem(channel));
};

const patchUser: NavContextMenuPatchCallback = (children, { user, channel } = {}) => {
    const dm = channel?.isDM() ? channel : user && ChannelStore.getDMChannelFromUserId(user.id);
    if (dm?.isDM()) children.push(menuItem(dm));
};

export default definePlugin({
    name: "FloatingDMs",
    description: "Keep a direct message open in a floating panel while browsing Discord.",
    authors: [{ name: "tubeo5866", id: 0n }],
    settings,
    patches: [{
        find: 'case"pendingFriends":',
        group: true,
        replacement: [
            {
                match: /ChannelRenderer"\),/,
                replace: "$&vc_FloatingDMs=$self.renderFloatingPanels(),"
            },
            {
                match: /(?<=return)\(0,\i\.jsx\)\(\i,\{\}\)(?=\},)/,
                replace: "[$&,vc_FloatingDMs]"
            }
        ]
    }],
    renderFloatingPanels() {
        return <FloatingPanels key="vc-floating-dms" />;
    },
    contextMenus: { "user-context": patchUser, "gdm-context": patchChannel, "channel-context": patchChannel },
    stop() {
        panels.clear();
        frontId = undefined;
        publish();
    }
});
