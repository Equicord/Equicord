/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs, IS_MAC } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

export default definePlugin({
    name: "CtrlEnterSend",
    authors: [Devs.UlyssesZhan],
    description: t("ctrlEnterSend.description"),
    settings: definePluginSettings({
        submitRule: {
            description: t("ctrlEnterSend.settings.submitRule"),
            type: OptionType.SELECT,
            options: [
                {
                    label: t("ctrlEnterSend.submitRuleOptions.ctrlEnter"),
                    value: "ctrl+enter"
                },
                {
                    label: t("ctrlEnterSend.submitRuleOptions.shiftEnter"),
                    value: "shift+enter"
                },
                {
                    label: t("ctrlEnterSend.submitRuleOptions.enter"),
                    value: "enter"
                }
            ],
            default: "ctrl+enter"
        },
        sendMessageInTheMiddleOfACodeBlock: {
            description: t("ctrlEnterSend.settings.sendMessageInTheMiddleOfACodeBlock"),
            type: OptionType.BOOLEAN,
            default: true,
        }
    }),
    patches: [
        // Only one of the two patches will be at effect; Discord often updates to switch between them.
        // See: https://discord.com/channels/1015060230222131221/1032770730703716362/1261398512017477673
        {
            find: ".selectPreviousCommandOption(",
            replacement: {
                match: /(?<=(\i)\.which!==\i\.\i.ENTER\|\|).{0,100}(\(0,\i\.\i\)\(\i\)).{0,100}(?=\|\|\(\i\.preventDefault)/,
                replace: "!$self.shouldSubmit($1,$2)"
            }
        },
        {
            find: "!this.hasOpenCodeBlock()",
            replacement: {
                match: /!(\i).shiftKey&&!(this.hasOpenCodeBlock\(\))&&\(.{0,100}?\)/,
                replace: "$self.shouldSubmit($1, $2)"
            }
        }
    ],
    shouldSubmit(event: KeyboardEvent, codeblock: boolean): boolean {
        let result = false;
        switch (this.settings.store.submitRule) {
            case "shift+enter":
                result = event.shiftKey;
                break;
            case "ctrl+enter":
                result = IS_MAC ? event.metaKey : event.ctrlKey;
                break;
            case "enter":
                result = !event.shiftKey && !event.ctrlKey;
                break;
        }
        if (!this.settings.store.sendMessageInTheMiddleOfACodeBlock) {
            result &&= !codeblock;
        }
        return result;
    }
});
