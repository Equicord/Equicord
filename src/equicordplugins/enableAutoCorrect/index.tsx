/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findCssClassesLazy } from "@webpack";
import { Menu } from "@webpack/common";

const TextAreaClasses = findCssClassesLazy("slateTextArea");
const SETTING_KEYS: Array<"isEnabled"> = ["isEnabled"];

const settings = definePluginSettings({
    isEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable native autocorrection and text replacements in message editors",
        default: false
    }
});

const addAutoCorrectMenuItem: NavContextMenuPatchCallback = children => {
    const { isEnabled } = settings.use(SETTING_KEYS);
    if (!findGroupChildrenByChildId("submit-button", children)) return;

    const options = findGroupChildrenByChildId("spellcheck-enabled", children, true);
    if (!options) return;
    if (options.some(item => item?.props.id === "vc-enable-autocorrect")) return;

    const spellcheckIndex = options.findIndex(item => item?.props.id?.endsWith("spellcheck-enabled"));
    options.splice(spellcheckIndex + 1, 0,
        <Menu.MenuCheckboxItem
            id="vc-enable-autocorrect"
            label="Enable Autocorrect"
            checked={isEnabled}
            action={() => settings.store.isEnabled = !settings.store.isEnabled}
        />
    );
};

export default definePlugin({
    name: "EnableAutoCorrect",
    description: "Enables native autocorrection and text replacements in the message composer.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.tie],
    settings,
    contextMenus: {
        "textarea-context": addAutoCorrectMenuItem
    },
    patches: [{
        find: "onPasteCapture:this.handlePasteCapture",
        replacement: {
            match: /autoCorrect:"off"/,
            replace: "autoCorrect:$self.autoCorrectForEditor(this.props)"
        }
    }],

    autoCorrectForEditor(props: { channelId?: string; className?: string; }) {
        const composerClass = TextAreaClasses.slateTextArea;
        return settings.store.isEnabled && props.channelId && composerClass && props.className?.split(/\s+/).includes(composerClass)
            ? "on"
            : "off";
    }
});
