/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { Menu, React, Tooltip } from "@webpack/common";

const ignoredChannelIds = new Set<string>();
const cl = classNameFactory("vc-ignore-calls-");
const Deafen = findComponentByCodeLazy("0-1.02-.1H3.05a9");
const CallActions = findByPropsLazy("stopRinging");

const ContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }: { channel: Channel; }) => {
    if (!channel || (!channel.isDM() && !channel.isGroupDM())) return;

    const permanentlyIgnored = settings.store.permanentlyIgnoredUsers.split(",").map(s => s.trim()).filter(Boolean);
    const [tempChecked, setTempChecked] = React.useState(ignoredChannelIds.has(channel.id));
    const [permChecked, setPermChecked] = React.useState(permanentlyIgnored.includes(channel.id));

    children.push(
        <>
            <Menu.MenuSeparator />
            <Menu.MenuCheckboxItem
                id="vc-ignore-calls-temp"
                label="Temporarily Ignore Calls"
                checked={tempChecked}
                action={() => {
                    tempChecked ? ignoredChannelIds.delete(channel.id) : ignoredChannelIds.add(channel.id);
                    setTempChecked(!tempChecked);
                }}
            />
            <Menu.MenuCheckboxItem
                id="vc-ignore-calls-perm"
                label="Permanently Ignore Calls"
                checked={permChecked}
                action={() => {
                    const updated = permChecked 
                        ? permanentlyIgnored.filter(id => id !== channel.id)
                        : [...permanentlyIgnored, channel.id];
                    settings.store.permanentlyIgnoredUsers = updated.join(", ");
                    setPermChecked(!permChecked);
                }}
            />
        </>
    );
};

const settings = definePluginSettings({
    permanentlyIgnoredUsers: {
        type: OptionType.STRING,
        description: "User IDs (comma + space) who should be permanently ignored",
        restartNeeded: true,
        default: "",
    },
});

function IgnoreButton({ channel }: { channel: Channel; }) {
    const permanentlyIgnored = settings.store.permanentlyIgnoredUsers.split(",").map(s => s.trim()).filter(Boolean);
    const [ignored, setIgnored] = React.useState(permanentlyIgnored.includes(channel.id));

    React.useEffect(() => {
        if (ignored) {
            CallActions.stopRinging(channel.id);
        }
    }, [ignored, channel.id]);

    return (
        <ErrorBoundary>
            <Tooltip text={ignored ? "Ignored" : "Ignore"}>
                {({ onMouseEnter, onMouseLeave }) => (
                    <Button
                        className={cl("button")}
                        size="small"
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onClick={() => {
                            const currentIgnored = settings.store.permanentlyIgnoredUsers
                                .split(",")
                                .map(s => s.trim())
                                .filter(Boolean);
                            
                            const updated = ignored
                                ? currentIgnored.filter(id => id !== channel.id)
                                : [...currentIgnored, channel.id];
                            
                            settings.store.permanentlyIgnoredUsers = updated.join(", ");
                            setIgnored(!ignored);
                        }}
                        style={ignored ? { backgroundColor: "var(--status-danger)", color: "white" } : {}}
                    >
                        <Deafen color={ignored ? "white" : "var(--interactive-icon-active)"} />
                    </Button>
                )}
            </Tooltip>
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "IgnoreCalls",
    description: "Allows you to ignore calls from specific users or dm groups.",
    authors: [EquicordDevs.TheArmagan, Devs.thororen, EquicordDevs.omaw],
    settings,

    patches: [{
        find: "#{intl::INCOMING_CALL_ELLIPSIS}",
        replacement: {
            match: /(?<=onCallJoined:\(\).{0,150})\(\i\)\}\),className:\i\.\i\}\)/,
            replace: "$&,$self.renderIgnore(arguments[0].channel)"
        }
    }],

    contextMenus: {
        "user-context": ContextMenuPatch,
        "gdm-context": ContextMenuPatch,
    },

    flux: {
        CALL_UPDATE({ channelId }) {
            const permanentlyIgnored = settings.store.permanentlyIgnoredUsers.split(",").map(s => s.trim()).filter(Boolean);
            if (ignoredChannelIds.has(channelId) || permanentlyIgnored.includes(channelId)) {
                CallActions.stopRinging(channelId);
            }
        }
    },

    renderIgnore(channel: Channel) {
        return <IgnoreButton channel={channel} />;
    }
});