/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { get, set } from "@api/DataStore";
import { addMessageAccessory, removeMessageAccessory } from "@api/MessageAccessories";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Menu } from "@webpack/common";

import { EyeIcon } from "./EyeIcon";
import { HideIcon } from "./HideIcon";
import { HideMessageAccessory } from "./HideMessageAccessory";

let style: HTMLStyleElement;

const KEY = "HideMessage_hiddenMessages";

let hiddenMessages = new Map<string, {
    id: string;
    channel_id: string;
}>();

const patchMessageContextMenu: NavContextMenuPatchCallback = (children, { message }) => {
    const { deleted, id, channel_id } = message;
    if (deleted || message.state !== "SENT") return;

    const isHidden = hiddenMessages?.has(id) || false;
    if (isHidden) {
        return children.push(
            <Menu.MenuItem
                id={cl("reveal")}
                label="Reveal Message"
                icon={EyeIcon}
                action={() => revealMessage(id)}
            />
        );
    }

    children.push(<Menu.MenuItem
        id={cl("hide")}
        label="Hide Message"
        color="danger"
        icon={HideIcon}
        action={() => {
            hiddenMessages.set(id, { id, channel_id });
            if (settings.store.saveHiddenMessages) set(KEY, hiddenMessages);

            buildCss();
        }}
    />);
};

const buildCss = () => {
    const elements = [...hiddenMessages.values()].map(m => `#chat-messages-${m.channel_id}-${m.id}`).join(",");

    style.textContent = settings.store.showNotice ? `
        :is(${elements}):not(.messagelogger-deleted) > div {
            position: relative;
            background: var(--brand-experiment-05a);
        }
        :is(${elements}):not(.messagelogger-deleted) > div:hover {
            background: var(--brand-experiment-10a);
        }
        :is(${elements}):not(.messagelogger-deleted) > div:before {
            background: var(--brand-500);
            content: "";
            position: absolute;
            display: block;
            top: 0;
            left: 0;
            bottom: 0;
            pointer-events: none;
            width: 2px;
        }
        :is(${elements}) [id^='message-accessories'] > *:not(.vc-hide-message-accessory),
        :is(${elements}) [id^='message-content']:not([class^='repliedTextContent']) > * {
            display: none !important;
        }
        :is(${elements}) [id^='message-content']:empty {
            display: block !important;
        }
        :is(${elements}) [class^='contents'] [id^='message-content']:after {
            content: "Hidden content";
        }
    ` : `
        :is(${elements}) {
            display: none !important;
        }
    `;
};

export const revealMessage = (id: string) => {
    const isHidden = hiddenMessages?.has(id) || false;
    if (isHidden) {
        hiddenMessages.delete(id);
        buildCss();

        if (settings.store.saveHiddenMessages) set(KEY, hiddenMessages);
    }
};

export const cl = classNameFactory("vc-hide-message-");

export const settings = definePluginSettings({
    showNotice: {
        type: OptionType.BOOLEAN,
        description: "Shows a notice when a message is hidden",
        default: true,
        onChange: buildCss
    },
    saveHiddenMessages: {
        type: OptionType.BOOLEAN,
        description: "Persist restarts",
        default: false,
        onChange: async (value: boolean) => {
            if (value) set(KEY, hiddenMessages);
            else (hiddenMessages = await get(KEY) || hiddenMessages);
        }
    },
});

export default definePlugin({
    name: "HideMessage",
    description: "Adds a context menu option to hide messages",
    authors: [EquicordDevs.Hanzy],
    dependencies: ["MessageAccessoriesAPI", "MessagePopoverAPI"],
    settings,

    contextMenus: {
        "message": patchMessageContextMenu
    },

    async start() {
        style = document.createElement("style");
        style.id = "VencordHideMessage";
        document.head.appendChild(style);

        if (settings.store.saveHiddenMessages) {
            hiddenMessages = await get(KEY) || hiddenMessages;
            buildCss();
        }

        addMessageAccessory("vc-hide-message", ({ message }) => {
            const isHidden = hiddenMessages?.has(message.id) || false;
            if (isHidden && settings.store.showNotice) return <HideMessageAccessory id={message.id} />;
            return null;
        });
    },

    async stop() {
        for (const id of hiddenMessages.keys()) revealMessage(id);

        removeMessageAccessory("vc-hide-message");

        style.remove();
        hiddenMessages.clear();
    },
});
