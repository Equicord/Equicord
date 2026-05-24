/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EyeIcon } from "@components/Icons";
import pinDms from "@plugins/pinDms";
import { isPinned } from "@plugins/pinDms/data";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { ChannelStore, Clickable, FluxDispatcher, Menu, Tooltip } from "@webpack/common";

interface UserContextProps {
    channel?: Channel;
}

interface PrivateChannelsListInstance {
    forceUpdate(callback?: () => void): void;
}

const cl = classNameFactory("vc-hide-messages-");
const hiddenDmIds = new Set<string>();
let privateChannelsListInstance: PrivateChannelsListInstance | null = null;
let showHiddenDms = false;

function notifyHiddenDmsUpdate() {
    privateChannelsListInstance?.forceUpdate();
}

const hideMessage = (messageId: string, channelId: string) => {
    FluxDispatcher.dispatch({
        type: "MESSAGE_DELETE",
        id: messageId,
        channelId,
        mlDeleted: true,
    });
};

function toggleDm(channelId: string) {
    if (hiddenDmIds.has(channelId)) {
        hiddenDmIds.delete(channelId);
        if (!hiddenDmIds.size) showHiddenDms = false;
    } else {
        hiddenDmIds.add(channelId);
    }

    notifyHiddenDmsUpdate();
}

const messageCtxPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    const group = findGroupChildrenByChildId("copy-text", children);
    if (!group) return;

    group.splice(group.findIndex(c => c?.props?.id === "copy-text") + 1, 0, (
        <Menu.MenuItem
            id="vc-hidemessages"
            label="Hide"
            icon={EyeIcon}
            action={() => hideMessage(message.id, message.channel_id)}
        />
    ));
};

const userCtxPatch: NavContextMenuPatchCallback = (children, { channel }: UserContextProps) => {
    if (!channel?.isDM()) return;
    if (isPluginEnabled(pinDms.name) && isPinned(channel.id)) return;

    const group = findGroupChildrenByChildId("close-dm", children);
    if (!group) return;

    const hidden = hiddenDmIds.has(channel.id);

    group.splice(group.findIndex(c => c?.props?.id === "close-dm"), 0, (
        <Menu.MenuItem
            id="vc-hidemessages-dm"
            label={hidden ? "Unhide DM" : "Hide DM"}
            icon={EyeIcon}
            action={() => toggleDm(channel.id)}
        />
    ));
};

const settings = definePluginSettings({
    hidePopoverButton: {
        type: OptionType.BOOLEAN,
        description: "Hide the hide button in the message popover.",
        default: false
    }
});

export default definePlugin({
    name: "HideMessages",
    description: "Temporarily hide messages and DMs until you restart.",
    dependencies: ["MessagePopoverAPI"],
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.yash],
    patches: [
        {
            find: '"dm-quick-launcher"===',
            replacement: [
                {
                    match: /render\(\)\{/,
                    replace: "$&this.props.privateChannelIds=$self.filterPrivateChannelIds(this.props.privateChannelIds,this);"
                },
                {
                    match: /renderRow=\i=>\{/,
                    replace: "$&this.props.privateChannelIds=$self.filterPrivateChannelIds(this.props.privateChannelIds,this);"
                },
                {
                    match: /renderDM=\(\i,\i\)=>\{/,
                    replace: "$&this.props.privateChannelIds=$self.filterPrivateChannelIds(this.props.privateChannelIds,this);"
                },
                {
                    match: /#{intl::DIRECT_MESSAGES}\)\}\),/,
                    replace: "$&$self.renderHiddenMessagesToggle(),"
                }
            ]
        }
    ],
    contextMenus: {
        "message": messageCtxPatch,
        "user-context": userCtxPatch
    },
    settings,
    stop() {
        hiddenDmIds.clear();
        showHiddenDms = false;
        notifyHiddenDmsUpdate();
        privateChannelsListInstance = null;
    },
    filterPrivateChannelIds(privateChannelIds: string[], instance?: PrivateChannelsListInstance) {
        privateChannelsListInstance = instance ?? privateChannelsListInstance;
        return showHiddenDms ? privateChannelIds : privateChannelIds.filter(id => !hiddenDmIds.has(id));
    },
    renderHiddenMessagesToggle: ErrorBoundary.wrap(() => {
        const hasHiddenDms = hiddenDmIds.size > 0;
        const label = !hasHiddenDms ? "No Hidden DMs" : showHiddenDms ? "Hide Hidden DMs" : "Show Hidden DMs";

        return (
            <Tooltip text={label}>
                {tooltipProps => (
                    <Clickable
                        {...tooltipProps}
                        className={cl("eye")}
                        role="button"
                        tabIndex={0}
                        aria-label={label}
                        aria-disabled={!hasHiddenDms}
                        onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!hasHiddenDms) return;
                            showHiddenDms = !showHiddenDms;
                            notifyHiddenDmsUpdate();
                        }}
                    >
                        <EyeIcon width={14} height={14} />
                    </Clickable>
                )}
            </Tooltip>
        );
    }, { noop: true }),
    messagePopoverButton: {
        icon: EyeIcon,
        render(message: Message) {
            if (settings.store.hidePopoverButton) return null;
            return {
                label: "Hide",
                icon: EyeIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => hideMessage(message.id, message.channel_id)
            };
        }
    }
});
