/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelToolbarButton } from "@api/HeaderBar";
import { addSurfacePropsProvider, notifySurfaceClassesChanged, type SurfaceId, type SurfaceProvidedProps } from "@api/SurfaceClasses";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";
import { Clickable, ContextMenuApi, Menu } from "@webpack/common";
import type { FocusEvent as ReactFocusEvent, MouseEvent as ReactMouseEvent, ReactNode, SVGProps } from "react";

import { collapseSettingKeys, PanelId, panelRegistry, setCollapseSettingChangeHandler, settings, setUserAreaDetachSettingChangeHandler, toolbarPanelOrder } from "./settings";
import managedStyle from "./style.css?managed";

const cl = classNameFactory("vc-collapsible-ui-");

const panelDependentSurfaces: Record<PanelId, SurfaceId[]> = {
    guildBar: ["guildBar", "sidebar", "userArea"],
    channelList: ["channelList", "base", "sidebar"],
    membersList: ["membersList"],
    chatButtons: [],
    titleBar: ["titleBar"],
    headerBar: ["headerBar", "base"],
    userArea: ["userArea", "sidebar"],
};

const DETACHED_USER_AREA_WIDTH = 312;
const DETACHED_USER_AREA_HEIGHT = 88;
const DETACHED_USER_AREA_MARGIN = 16;
const DETACHED_USER_AREA_DEFAULT_OFFSET_X = 24;
const DETACHED_USER_AREA_DEFAULT_OFFSET_Y = 88;

let providerUnsubs: Array<() => void> = [];
let channelListExpandedByInteraction = false;
let guildBarExpandedByInteraction = false;
let headerBarExpandedByInteraction = false;
let headerBarPointerTrackerEnabled = false;
let userAreaDragState: { offsetX: number; offsetY: number; width: number; height: number; } | undefined;
let detachedUserAreaDragPosition: { x: number; y: number; } | undefined;
let detachedUserAreaPositionChanged = false;
let detachedUserAreaAnimationFrame: number | undefined;
let channelListElement: HTMLElement | null = null;
let userAreaElement: HTMLElement | null = null;
const surfaceCssPxCache = new Map<string, number>();

function PanelsIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
            <path fill="currentColor" d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3V5Zm0 5h6v11H5a2 2 0 0 1-2-2V10Zm8 0h10v9a2 2 0 0 1-2 2H11V10Zm2-5h8v3h-8V5Z" />
        </svg>
    );
}

function isPanelCollapsed(panelId: PanelId) {
    return settings.plain[panelRegistry[panelId].collapsedKey];
}

function usePanelCollapsed(panelId: PanelId) {
    const key = panelRegistry[panelId].collapsedKey;
    return settings.use([key])[key];
}

function notifyPanelSurfacesChanged(panelId: PanelId) {
    for (const surfaceId of panelDependentSurfaces[panelId]) {
        notifySurfaceClassesChanged(surfaceId);
    }
}

function setHeaderBarExpandedByInteraction(expanded: boolean) {
    if (headerBarExpandedByInteraction === expanded) return;
    headerBarExpandedByInteraction = expanded;
    notifySurfaceClassesChanged("base");
    notifySurfaceClassesChanged("headerBar");
}

function setChannelListExpandedByInteraction(expanded: boolean) {
    if (channelListExpandedByInteraction === expanded) return;
    channelListExpandedByInteraction = expanded;
    notifySurfaceClassesChanged("base");
    notifySurfaceClassesChanged("sidebar");
}

function setGuildBarExpandedByInteraction(expanded: boolean) {
    if (guildBarExpandedByInteraction === expanded) return;
    guildBarExpandedByInteraction = expanded;
    notifySurfaceClassesChanged("guildBar");
}

function syncPanelCollapsedState(panelId: PanelId, collapsed: boolean) {
    if (panelId === "guildBar") {
        guildBarExpandedByInteraction = false;
    }

    if (panelId === "channelList") {
        channelListExpandedByInteraction = false;
    }

    if (panelId === "headerBar") {
        setHeaderBarPointerTrackerEnabled(collapsed);
        if (!collapsed) {
            headerBarExpandedByInteraction = false;
        }
    }

    notifyPanelSurfacesChanged(panelId);
}

function syncAllPanelCollapsedStates() {
    for (const panelId of toolbarPanelOrder) {
        syncPanelCollapsedState(panelId, isPanelCollapsed(panelId));
    }
}

// Reads a plugin CSS length variable from a mounted surface so the managed
// stylesheet stays the single source of truth. Cached while the pointer
// tracker runs; cleared each time tracking starts so theme overrides of the
// variables are picked up without querying computed style per mouse move.
function readSurfacePx(property: string, fallback: number) {
    const cached = surfaceCssPxCache.get(property);
    if (cached != null) return cached;

    const host = userAreaElement ?? channelListElement;
    if (!host) return fallback;

    const value = parseFloat(getComputedStyle(host).getPropertyValue(property));
    if (!Number.isFinite(value)) return fallback;

    surfaceCssPxCache.set(property, value);
    return value;
}

// Electron drag regions do not provide stable hover events, so keep this as a
// coordinate-only tracker while headerbar collapse is enabled.
function handleHeaderBarPointerMove(event: MouseEvent) {
    if (!isPanelCollapsed("headerBar")) {
        setHeaderBarPointerTrackerEnabled(false);
        setHeaderBarExpandedByInteraction(false);
        return;
    }

    const interactionHeight = headerBarExpandedByInteraction
        ? readSurfacePx("--vc-cui-header-bar-height", 32)
        : readSurfacePx("--vc-cui-collapsed-block-size", 8);
    setHeaderBarExpandedByInteraction(event.clientY >= 0 && event.clientY <= interactionHeight);
}

function setHeaderBarPointerTrackerEnabled(enabled: boolean) {
    if (headerBarPointerTrackerEnabled === enabled) return;
    headerBarPointerTrackerEnabled = enabled;

    if (enabled) {
        surfaceCssPxCache.clear();
        document.addEventListener("mousemove", handleHeaderBarPointerMove, true);
    } else {
        document.removeEventListener("mousemove", handleHeaderBarPointerMove, true);
    }
}

function setPanelCollapsed(panelId: PanelId, collapsed: boolean) {
    const key = panelRegistry[panelId].collapsedKey;
    if (settings.plain[key] === collapsed) return;
    settings.store[key] = collapsed;
}

function togglePanel(panelId: PanelId) {
    setPanelCollapsed(panelId, !isPanelCollapsed(panelId));
}

function openToolbarMenu(event: ReactMouseEvent) {
    ContextMenuApi.openContextMenu(event, () => <ToolbarMenu onClose={ContextMenuApi.closeContextMenu} />);
}

function containsRelatedTarget(event: ReactFocusEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) {
    const { currentTarget, relatedTarget } = event;
    return relatedTarget instanceof Node && currentTarget.contains(relatedTarget);
}

function nodeWithin(element: HTMLElement | null, node: unknown) {
    return node instanceof Node && !!element?.contains(node);
}

function eventWithin(element: HTMLElement | null, event: ReactFocusEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) {
    if (!element) return false;

    if (nodeWithin(element, event.target)) return true;
    if (event.nativeEvent.composedPath().some(node => nodeWithin(element, node))) return true;

    if ("clientX" in event && "clientY" in event) {
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    return false;
}

// The BetterFolders sidebar mounts and unmounts with folder state, so match
// it by class instead of holding an element reference.
function eventWithinBetterFolders(event: ReactFocusEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) {
    return event.target instanceof Element && !!event.target.closest(".vc-betterFolders-sidebar");
}

function handleSidebarEnter(event: ReactFocusEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) {
    if (isPanelCollapsed("guildBar")) {
        setGuildBarExpandedByInteraction(eventWithinBetterFolders(event));
    }

    if (eventWithin(userAreaElement, event)) {
        setChannelListExpandedByInteraction(false);
        return;
    }

    if (isPanelCollapsed("channelList") && eventWithin(channelListElement, event)) {
        setChannelListExpandedByInteraction(true);
    }
}

function handleSidebarLeave(event: ReactFocusEvent<HTMLElement> | ReactMouseEvent<HTMLElement>) {
    if (!(event.relatedTarget instanceof Element && event.relatedTarget.closest(".vc-betterFolders-sidebar"))) {
        setGuildBarExpandedByInteraction(false);
    }

    if (nodeWithin(userAreaElement, event.relatedTarget)) {
        setChannelListExpandedByInteraction(false);
        return;
    }

    if (eventWithin(channelListElement, event) && !nodeWithin(channelListElement, event.relatedTarget)) {
        setChannelListExpandedByInteraction(false);
        return;
    }

    if (containsRelatedTarget(event)) return;
    if (isPanelCollapsed("channelList")) setChannelListExpandedByInteraction(false);
}

function isInteractiveDragTarget(node: unknown) {
    if (!(node instanceof HTMLElement)) return false;

    if (node.isContentEditable) return true;

    switch (node.tagName) {
        case "A":
        case "BUTTON":
        case "INPUT":
        case "SELECT":
        case "TEXTAREA":
            return true;
    }

    return node.getAttribute("role") === "button" || node.getAttribute("aria-haspopup") === "menu";
}

function shouldDetachUserArea() {
    return settings.plain.detachUserArea && !isPanelCollapsed("userArea");
}

function setChannelListElement(element: HTMLElement | null) {
    channelListElement = element;
}

function setUserAreaElement(element: HTMLElement | null) {
    userAreaElement = element;
}

function syncUserAreaDetachState() {
    notifySurfaceClassesChanged("sidebar");
    notifySurfaceClassesChanged("userArea");
}

function clampUserAreaPosition(x: number, y: number, width = DETACHED_USER_AREA_WIDTH, height = DETACHED_USER_AREA_HEIGHT) {
    const maxX = Math.max(DETACHED_USER_AREA_MARGIN, window.innerWidth - width - DETACHED_USER_AREA_MARGIN);
    const maxY = Math.max(DETACHED_USER_AREA_MARGIN, window.innerHeight - height - DETACHED_USER_AREA_MARGIN);

    return {
        x: Math.min(Math.max(DETACHED_USER_AREA_MARGIN, x), maxX),
        y: Math.min(Math.max(DETACHED_USER_AREA_MARGIN, y), maxY),
    };
}

function getDetachedUserAreaPosition() {
    if (detachedUserAreaDragPosition) return detachedUserAreaDragPosition;

    const storedX = settings.plain.detachedUserAreaX;
    const storedY = settings.plain.detachedUserAreaY;
    const defaultPosition = clampUserAreaPosition(
        window.innerWidth - DETACHED_USER_AREA_WIDTH - DETACHED_USER_AREA_DEFAULT_OFFSET_X,
        window.innerHeight - DETACHED_USER_AREA_HEIGHT - DETACHED_USER_AREA_DEFAULT_OFFSET_Y
    );

    if (!Number.isFinite(storedX) || !Number.isFinite(storedY) || storedX < 0 || storedY < 0) return defaultPosition;
    return clampUserAreaPosition(storedX, storedY);
}

function persistDetachedUserAreaPosition(x: number, y: number, width?: number, height?: number) {
    const position = clampUserAreaPosition(x, y, width, height);
    const roundedX = Math.round(position.x);
    const roundedY = Math.round(position.y);
    if (settings.plain.detachedUserAreaX === roundedX && settings.plain.detachedUserAreaY === roundedY) return;

    settings.store.detachedUserAreaX = roundedX;
    settings.store.detachedUserAreaY = roundedY;
}

function scheduleDetachedUserAreaUpdate() {
    if (detachedUserAreaAnimationFrame != null) return;

    detachedUserAreaAnimationFrame = requestAnimationFrame(() => {
        detachedUserAreaAnimationFrame = undefined;
        notifySurfaceClassesChanged("userArea");
    });
}

function cancelDetachedUserAreaUpdate() {
    if (detachedUserAreaAnimationFrame == null) return;

    cancelAnimationFrame(detachedUserAreaAnimationFrame);
    detachedUserAreaAnimationFrame = undefined;
}

function handleDetachedUserAreaMouseMove(event: MouseEvent) {
    if (!userAreaDragState) return;
    const position = clampUserAreaPosition(
        event.clientX - userAreaDragState.offsetX,
        event.clientY - userAreaDragState.offsetY,
        userAreaDragState.width,
        userAreaDragState.height
    );
    if (detachedUserAreaDragPosition?.x === position.x && detachedUserAreaDragPosition.y === position.y) return;

    detachedUserAreaDragPosition = position;
    detachedUserAreaPositionChanged = true;
    scheduleDetachedUserAreaUpdate();
}

function stopDetachedUserAreaDrag() {
    const dragState = userAreaDragState;
    cancelDetachedUserAreaUpdate();
    if (dragState && detachedUserAreaDragPosition && detachedUserAreaPositionChanged) {
        persistDetachedUserAreaPosition(detachedUserAreaDragPosition.x, detachedUserAreaDragPosition.y, dragState.width, dragState.height);
    }

    userAreaDragState = undefined;
    detachedUserAreaDragPosition = undefined;
    detachedUserAreaPositionChanged = false;
    document.removeEventListener("mousemove", handleDetachedUserAreaMouseMove, true);
    document.removeEventListener("mouseup", stopDetachedUserAreaDrag, true);
}

function startDetachedUserAreaDrag(event: ReactMouseEvent<HTMLElement>) {
    if (!shouldDetachUserArea() || event.button !== 0) return;

    const path = event.nativeEvent.composedPath();
    if (path.some(node => node !== event.currentTarget && isInteractiveDragTarget(node))) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const height = Math.min(rect.height, DETACHED_USER_AREA_HEIGHT);
    detachedUserAreaDragPosition = getDetachedUserAreaPosition();
    detachedUserAreaPositionChanged = false;
    userAreaDragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height,
    };

    document.addEventListener("mousemove", handleDetachedUserAreaMouseMove, true);
    document.addEventListener("mouseup", stopDetachedUserAreaDrag, true);
}

const ToolbarMenu = ErrorBoundary.wrap(({ onClose }: { onClose(): void; }) => {
    const store = settings.use(collapseSettingKeys);

    return (
        <Menu.Menu navId="vc-collapsible-ui-toolbar-menu" onClose={onClose} aria-label="Collapsible UI">
            {toolbarPanelOrder.map(panelId => {
                const panel = panelRegistry[panelId];
                const collapsed = store[panel.collapsedKey];

                return (
                    <Menu.MenuCheckboxItem
                        key={panelId}
                        id={`vc-collapsible-ui-${panel.classId}`}
                        label={panel.label}
                        checked={!collapsed}
                        action={() => togglePanel(panelId)}
                    />
                );
            })}
        </Menu.Menu>
    );
}, { noop: true });

const ToolbarButtons = ErrorBoundary.wrap(() => {
    const store = settings.use(collapseSettingKeys);
    const anyCollapsed = toolbarPanelOrder.some(panelId => store[panelRegistry[panelId].collapsedKey]);

    return (
        <ChannelToolbarButton
            icon={PanelsIcon}
            tooltip="Collapsible UI"
            aria-label="Collapsible UI"
            selected={anyCollapsed}
            onClick={openToolbarMenu}
            onContextMenu={openToolbarMenu}
        />
    );
}, { noop: true });

const CollapsedMenuButton = ErrorBoundary.wrap(() => (
    <Clickable
        className={cl("restore-button")}
        role="button"
        tabIndex={0}
        aria-label="Collapsible UI"
        onClick={openToolbarMenu}
        onContextMenu={openToolbarMenu}
    >
        <PanelsIcon width={18} height={18} />
    </Clickable>
), { noop: true });

const ChatButtonsRow = ErrorBoundary.wrap(({ buttons }: { buttons: ReactNode[]; }) => {
    const chatButtonsCollapsed = usePanelCollapsed("chatButtons");

    if (buttons.length === 0) return <>{buttons}</>;

    return (
        <div className={classes(cl("chat-buttons"), chatButtonsCollapsed && cl("chat-buttons-collapsed"))}>
            <div className={cl("chat-buttons-items")}>
                {buttons}
            </div>
            <CollapsedMenuButton />
        </div>
    );
}, { noop: true });

export default definePlugin({
    name: "CollapsibleUI",
    description: "Native collapsible channel, member, chat button, and user area surfaces.",
    tags: ["Appearance", "Customisation", "Chat", "Servers"],
    dependencies: ["HeaderBarAPI", "ChatInputButtonAPI", "SurfaceClassesAPI"],
    authors: [EquicordDevs.benjii],
    searchTerms: ["ui", "sidebar", "collapsible"],
    managedStyle,
    settings,

    headerBarButton: {
        icon: PanelsIcon,
        location: "channeltoolbar",
        priority: 25,
        render: () => <ToolbarButtons />,
    },

    chatBarButtonWrapper: {
        wrapper: (buttons: ReactNode) => {
            if (!Array.isArray(buttons) || buttons.length === 0) return buttons;
            return <ChatButtonsRow buttons={buttons} />;
        },
        priority: 0,
    },

    start() {
        const panelAttr = (classId: string, collapsed: boolean): SurfaceProvidedProps => ({
            [`data-vc-collapsible-ui-${classId}`]: "",
            [`data-vc-collapsible-ui-${classId}-${collapsed ? "collapsed" : "expanded"}`]: "",
        } as SurfaceProvidedProps);

        providerUnsubs = [
            addSurfacePropsProvider("guildBar", () => {
                const collapsed = isPanelCollapsed("guildBar");
                const attrs: SurfaceProvidedProps = panelAttr(panelRegistry.guildBar.classId, collapsed);
                if (collapsed && guildBarExpandedByInteraction) {
                    attrs["data-vc-collapsible-ui-guild-bar-interaction-expanded"] = "";
                }
                return attrs;
            }),
            addSurfacePropsProvider("channelList", () => {
                const attrs: SurfaceProvidedProps = panelAttr(panelRegistry.channelList.classId, isPanelCollapsed("channelList"));
                attrs.ref = setChannelListElement;
                return attrs;
            }),
            addSurfacePropsProvider("membersList", () => panelAttr(panelRegistry.membersList.classId, isPanelCollapsed("membersList"))),
            addSurfacePropsProvider("titleBar", () => panelAttr(panelRegistry.titleBar.classId, isPanelCollapsed("titleBar"))),
            addSurfacePropsProvider("headerBar", () => {
                const collapsed = isPanelCollapsed("headerBar");
                const attrs: SurfaceProvidedProps = panelAttr(panelRegistry.headerBar.classId, collapsed);
                if (collapsed && headerBarExpandedByInteraction) {
                    attrs["data-vc-collapsible-ui-header-bar-interaction-expanded"] = "";
                }
                attrs.onFocusCapture = () => {
                    if (isPanelCollapsed("headerBar")) setHeaderBarExpandedByInteraction(true);
                };
                attrs.onBlurCapture = event => {
                    if (containsRelatedTarget(event)) return;
                    if (isPanelCollapsed("headerBar")) setHeaderBarExpandedByInteraction(false);
                };
                return attrs;
            }),
            addSurfacePropsProvider("userArea", () => {
                const uaCollapsed = isPanelCollapsed("userArea");
                const gbCollapsed = isPanelCollapsed("guildBar");
                const userAreaDetached = shouldDetachUserArea();
                const attrs: SurfaceProvidedProps = panelAttr(panelRegistry.userArea.classId, uaCollapsed);
                attrs.ref = setUserAreaElement;
                if (userAreaDetached) {
                    const position = getDetachedUserAreaPosition();
                    attrs["data-vc-collapsible-ui-user-area-detached"] = "";
                    attrs.style = {
                        left: 0,
                        top: 0,
                        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                    };
                    attrs.onMouseDownCapture = startDetachedUserAreaDrag;
                }
                if (!userAreaDetached && gbCollapsed) {
                    attrs["data-vc-collapsible-ui-user-area-guild-bar-collapsed"] = "";
                }
                return attrs;
            }),
            addSurfacePropsProvider("base", () => {
                const channelListCollapsed = isPanelCollapsed("channelList");
                const headerBarCollapsed = isPanelCollapsed("headerBar");
                return {
                    "data-vc-collapsible-ui-base": "",
                    [`data-vc-collapsible-ui-base-channel-list-${channelListCollapsed ? "collapsed" : "expanded"}`]: "",
                    ...(channelListCollapsed && channelListExpandedByInteraction ? { "data-vc-collapsible-ui-base-channel-list-interaction-expanded": "" } : {}),
                    ...(headerBarCollapsed && !headerBarExpandedByInteraction ? { "data-vc-collapsible-ui-base-header-bar-collapsed": "" } : {}),
                    ...(headerBarCollapsed && headerBarExpandedByInteraction ? { "data-vc-collapsible-ui-base-header-bar-expanded": "" } : {}),
                } as SurfaceProvidedProps;
            }),
            addSurfacePropsProvider("sidebar", () => {
                const collapsed = isPanelCollapsed("channelList");
                const userAreaDetached = shouldDetachUserArea();
                return {
                    "data-vc-collapsible-ui-sidebar": "",
                    [`data-vc-collapsible-ui-sidebar-channel-list-${collapsed ? "collapsed" : "expanded"}`]: "",
                    ...(collapsed && channelListExpandedByInteraction ? { "data-vc-collapsible-ui-sidebar-channel-list-expanded": "" } : {}),
                    ...(isPanelCollapsed("guildBar") ? { "data-vc-collapsible-ui-sidebar-guild-bar-collapsed": "" } : {}),
                    ...(userAreaDetached ? { "data-vc-collapsible-ui-sidebar-user-area-detached": "" } : {}),
                    onFocusCapture: handleSidebarEnter,
                    onBlurCapture: handleSidebarLeave,
                    onMouseOverCapture: handleSidebarEnter,
                    onMouseOutCapture: handleSidebarLeave,
                } as SurfaceProvidedProps;
            }),
        ];

        setCollapseSettingChangeHandler(syncPanelCollapsedState);
        setUserAreaDetachSettingChangeHandler(syncUserAreaDetachState);
        syncAllPanelCollapsedStates();
    },

    stop() {
        setCollapseSettingChangeHandler(undefined);
        setUserAreaDetachSettingChangeHandler(undefined);
        stopDetachedUserAreaDrag();
        providerUnsubs.forEach(unsub => unsub());
        providerUnsubs = [];
        setHeaderBarPointerTrackerEnabled(false);
        channelListElement = null;
        userAreaElement = null;
        channelListExpandedByInteraction = false;
        guildBarExpandedByInteraction = false;
        headerBarExpandedByInteraction = false;
        surfaceCssPxCache.clear();
    },
});
