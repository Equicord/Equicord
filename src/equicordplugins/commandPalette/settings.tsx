/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { IS_MAC } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { OptionType } from "@utils/types";
import { useEffect, useState } from "@webpack/common";

import { comboFromEvent, formatCombo, setHotkeysSuspended } from "./ui/keyboard";

const cl = classNameFactory("vc-cmdpal-");

export const DEFAULT_HOTKEY = IS_MAC ? ["meta", "shift", "p"] : ["ctrl", "shift", "p"];

const HOTKEY_SETTING_KEYS = ["hotkey"] as ("hotkey" | "closeAfterExecute")[];

function HotkeyRecorder() {
    const [recording, setRecording] = useState(false);
    const { hotkey } = settings.use(HOTKEY_SETTING_KEYS);

    useEffect(() => {
        if (!recording) return;

        setHotkeysSuspended(true);

        function onKeyDown(e: KeyboardEvent) {
            e.preventDefault();
            e.stopPropagation();

            if (e.key === "Escape") {
                setRecording(false);
                return;
            }

            const combo = comboFromEvent(e);
            if (!combo) return;

            settings.store.hotkey = combo;
            setRecording(false);
        }

        function onBlur() {
            setRecording(false);
        }

        document.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("blur", onBlur);

        return () => {
            setHotkeysSuspended(false);
            document.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("blur", onBlur);
        };
    }, [recording]);

    return (
        <div className={cl("hotkey-setting")}>
            <BaseText size="md" weight="semibold">Open palette hotkey</BaseText>
            <Button variant="secondary" onClick={() => setRecording(true)}>
                {recording ? "Press keys..." : formatCombo(hotkey)}
            </Button>
        </div>
    );
}

export const settings = definePluginSettings({
    hotkey: {
        type: OptionType.COMPONENT,
        default: DEFAULT_HOTKEY,
        component: HotkeyRecorder
    },
    closeAfterExecute: {
        description: "Close the palette after running a command.",
        type: OptionType.BOOLEAN,
        default: true
    }
});
