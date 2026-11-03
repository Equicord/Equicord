/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType, PluginSettingComponentProps } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { FluxDispatcher, OverridePremiumTypeStore, SettingsRouter, UserStore } from "@webpack/common";

interface ClipsSettings {
    clipsEnabled: boolean;
    storageLocation?: string;
    clipsLength?: number;
    remindersEnabled?: boolean;
    decoupledClipsEnabled?: boolean;
    enableAutoclipping?: boolean;
    [key: string]: unknown;
}

interface ClipsStoreType {
    getSettings(): ClipsSettings;
    hasClips(): boolean;
    [key: string]: unknown;
}

const ClipsStore = findStoreLazy("ClipsStore") as ClipsStoreType;

function hasNitro(): boolean {
    const actual = OverridePremiumTypeStore?.getState?.()?.premiumTypeActual;
    if (actual != null) return actual >= 2;
    return (UserStore?.getCurrentUser?.()?.premiumType ?? 0) >= 2;
}

function ensureClipsEnabled() {
    if (hasNitro()) return;

    const currentSettings = ClipsStore?.getSettings?.();
    if (currentSettings && !currentSettings.clipsEnabled) {
        FluxDispatcher.dispatch({
            type: "CLIPS_SETTINGS_UPDATE",
            settings: { clipsEnabled: true }
        });
    }
}

function ClipsSettingsButton({ closePluginSettings }: PluginSettingComponentProps) {
    return (
        <Button
            onClick={() => {
                closePluginSettings();
                SettingsRouter.openUserSettings("clips_panel");
            }}
        >
            Open Discord Clips Settings
        </Button>
    );
}

const settings = definePluginSettings({
    openClipsSettings: {
        type: OptionType.COMPONENT,
        description: "",
        component: ClipsSettingsButton
    }
});

export default definePlugin({
    name: "ClipThat",
    description: "Unlocks Discord's built-in game clipping feature without Nitro",
    authors: [EquicordDevs.amp],
    tags: ["Utility", "Media"],
    settings,

    patches: [
        {
            find: ".hasClipsV3Support()",
            replacement: {
                match: /\i\.\i\.isPremiumAtLeast\(\i\?\.premiumType,\i\.PremiumTypes\.TIER_2\)/,
                replace: "$self.isNitro($&)"
            }
        }
    ],

    isNitro(actual: boolean) {
        if (actual) return actual;
        return true;
    },

    start() {
        ensureClipsEnabled();
    },

    flux: {
        POST_CONNECTION_OPEN() {
            ensureClipsEnabled();
        },
        CONNECTION_OPEN() {
            ensureClipsEnabled();
        }
    }
});
