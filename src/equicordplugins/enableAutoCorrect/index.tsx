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

const TextAreaClasses = findCssClassesLazy("slateTextArea", "slateContainer");

const settings = definePluginSettings({
    isEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable native autocorrection and text replacements in message editors",
        default: false
    }
});

const addAutoCorrectMenuItem: NavContextMenuPatchCallback = children => {
    const { isEnabled } = settings.use(["isEnabled"]);
    if (!findGroupChildrenByChildId("submit-button", children)) return;

    const options = findGroupChildrenByChildId("spellcheck-enabled", children, true);
    if (!options) return;

    const spellcheckIndex = options.findIndex(item => item?.props?.id?.includes("spellcheck-enabled"));
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
    description: "Adds a chat box toggle for your system's autocorrect",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.tie],
    settings,
    contextMenus: {
        "textarea-context": addAutoCorrectMenuItem
    },
    patches: [
        {
            find: "onPasteCapture:this.handlePasteCapture",
            replacement: {
                match: /autoCorrect:"off"(?=,"data-can-focus":)/,
                replace: "autoCorrect:$self.autoCorrectForEditor(this.props)"
            }
        }
    ],

    autoCorrectForEditor({ channelId, className }: { channelId?: string; className?: string; }) {
        if (!settings.store.isEnabled || !channelId) return "off";
        return className?.split(" ").includes(TextAreaClasses.slateTextArea) ? "on" : "off";
    }
});
