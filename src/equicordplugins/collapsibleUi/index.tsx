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

import { PanelId, panelRegistry, setCollapseSettingChangeHandler, settings, toolbarPanelOrder } from "./settings";
import managedStyle from "./style.css?managed";

const cl = classNameFactory("vc-collapsible-ui-");

const panelDependentSurfaces: Record<PanelId, SurfaceId[]> = {
    guildBar: ["guildBar", "userArea"],
    channelList: ["channelList", "base", "sidebar", "userArea"],
    membersList: ["membersList"],
    chatButtons: [],
    titleBar: ["titleBar"],
    headerBar: ["headerBar", "base"],
    userArea: ["userArea"],
};

// Keep these in sync with --vc-cui-collapsed-block-size and --vc-cui-header-bar-height in style.css.
const HEADER_BAR_COLLAPSED_INTERACTION_HEIGHT = 8;
const HEADER_BAR_EXPANDED_INTERACTION_HEIGHT = 32;

let providerUnsubs: Array<() => void> = [];
let channelListExpandedByInteraction = false;
let headerBarExpandedByInteraction = false;
let headerBarPointerTrackerEnabled = false;

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
}

function syncPanelCollapsedState(panelId: PanelId, collapsed: boolean) {
    if (panelId === "channelList" && !collapsed) {
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

// Electron drag regions do not provide stable hover events, so keep this as a
// coordinate-only tracker while headerbar collapse is enabled.
function handleHeaderBarPointerMove(event: MouseEvent) {
    if (!isPanelCollapsed("headerBar")) {
        setHeaderBarPointerTrackerEnabled(false);
        setHeaderBarExpandedByInteraction(false);
        return;
    }

    const interactionHeight = headerBarExpandedByInteraction ? HEADER_BAR_EXPANDED_INTERACTION_HEIGHT : HEADER_BAR_COLLAPSED_INTERACTION_HEIGHT;
    setHeaderBarExpandedByInteraction(event.clientY >= 0 && event.clientY <= interactionHeight);
}

function setHeaderBarPointerTrackerEnabled(enabled: boolean) {
    if (headerBarPointerTrackerEnabled === enabled) return;
    headerBarPointerTrackerEnabled = enabled;

    if (enabled) {
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

const ToolbarMenu = ErrorBoundary.wrap(({ onClose }: { onClose(): void; }) => {
    const store = settings.use(["guildBarCollapsed", "channelListCollapsed", "membersListCollapsed", "chatButtonsCollapsed", "titleBarCollapsed", "headerBarCollapsed", "userAreaCollapsed"]);

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
    const store = settings.use(["guildBarCollapsed", "channelListCollapsed", "membersListCollapsed", "chatButtonsCollapsed", "titleBarCollapsed", "headerBarCollapsed", "userAreaCollapsed"]);
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

    isPanelCollapsed,

    usePanelCollapsed,

    setPanelCollapsed,

    start() {
        const panelAttr = (classId: string, collapsed: boolean): SurfaceProvidedProps => ({
            [`data-vc-collapsible-ui-${classId}`]: "",
            [`data-vc-collapsible-ui-${classId}-${collapsed ? "collapsed" : "expanded"}`]: "",
        } as SurfaceProvidedProps);

        providerUnsubs = [
            addSurfacePropsProvider("guildBar", () => panelAttr(panelRegistry.guildBar.classId, isPanelCollapsed("guildBar"))),
            addSurfacePropsProvider("channelList", () => panelAttr(panelRegistry.channelList.classId, isPanelCollapsed("channelList"))),
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
                const clCollapsed = isPanelCollapsed("channelList");
                const gbCollapsed = isPanelCollapsed("guildBar");
                const attrs: SurfaceProvidedProps = panelAttr(panelRegistry.userArea.classId, uaCollapsed);
                if (clCollapsed) {
                    attrs["data-vc-collapsible-ui-user-area-channel-list-collapsed"] = "";
                }
                if (gbCollapsed) {
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
                return {
                    "data-vc-collapsible-ui-sidebar": "",
                    [`data-vc-collapsible-ui-sidebar-channel-list-${collapsed ? "collapsed" : "expanded"}`]: "",
                    onFocusCapture: () => {
                        if (isPanelCollapsed("channelList")) setChannelListExpandedByInteraction(true);
                    },
                    onBlurCapture: event => {
                        if (containsRelatedTarget(event)) return;
                        if (isPanelCollapsed("channelList")) setChannelListExpandedByInteraction(false);
                    },
                    onMouseOverCapture: () => {
                        if (isPanelCollapsed("channelList")) setChannelListExpandedByInteraction(true);
                    },
                    onMouseOutCapture: event => {
                        if (containsRelatedTarget(event)) return;
                        if (isPanelCollapsed("channelList")) setChannelListExpandedByInteraction(false);
                    },
                } as SurfaceProvidedProps;
            }),
        ];

        setCollapseSettingChangeHandler(syncPanelCollapsedState);
        syncAllPanelCollapsedStates();
    },

    stop() {
        setCollapseSettingChangeHandler(undefined);
        providerUnsubs.forEach(unsub => unsub());
        providerUnsubs = [];
        setHeaderBarPointerTrackerEnabled(false);
        channelListExpandedByInteraction = false;
        headerBarExpandedByInteraction = false;
    },
});
