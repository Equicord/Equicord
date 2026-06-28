/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { Button, UserStore, useEffect, useState } from "@webpack/common";
import { lodash } from "@webpack/common";
import { STORE_KEY_PREFIX } from "./constants";
import {
    frequencyCache,
    lastBackup,
    setFrequencyCache,
    setLastBackup,
    subscribeToBackupChanges,
    syncWithAffinities
} from "./scoring";
import type { FrequencyData } from "./types";

const logger = new Logger("FrequentFriends");

function getCurrentStoreKey(): string {
    const user = UserStore.getCurrentUser();
    return STORE_KEY_PREFIX + (user ? user.id : "default");
}

function ResetButton() {
    return (
        <Button
            color={Button.Colors.RED}
            size={Button.Sizes.SMALL}
            onClick={async () => {
                setLastBackup(lodash.cloneDeep(frequencyCache) as Record<string, FrequencyData>);
                setFrequencyCache({});
                await DataStore.set(getCurrentStoreKey(), {}).catch(e => logger.warn("Failed to reset", e));
                await syncWithAffinities();
            }}
        >
            Reset All Data
        </Button>
    );
}

function UndoButton() {
    const [hasBackup, setHasBackup] = useState(() => !!lastBackup);

    useEffect(() => {
        return subscribeToBackupChanges(() => setHasBackup(!!lastBackup));
    }, []);

    return (
        <Button
            color={Button.Colors.BRAND}
            size={Button.Sizes.SMALL}
            disabled={!hasBackup}
            onClick={async () => {
                const backup = lastBackup;
                if (!backup) return;
                setFrequencyCache(lodash.cloneDeep(backup) as Record<string, FrequencyData>);
                setLastBackup(null);
                await DataStore.set(getCurrentStoreKey(), frequencyCache).catch(e => logger.warn("Failed to undo", e));
            }}
        >
            Undo Reset
        </Button>
    );
}

const settings = definePluginSettings({
    customLabel: {
        type: OptionType.STRING,
        description: "Custom title for the list",
        default: "Frequent Friends",
        maxLength: 30
    },
    maxFriends: {
        type: OptionType.SLIDER,
        description: "Maximum number of frequent friends to show",
        default: 5,
        markers: [3, 4, 5, 6, 7, 8, 9, 10],
        stickToMarkers: true
    },
    showOffline: {
        type: OptionType.BOOLEAN,
        description: "Show offline friends",
        default: false
    },
    ignoreAffinities: {
        type: OptionType.BOOLEAN,
        description: "Pure manual mode",
        default: false
    },
    resetData: {
        type: OptionType.COMPONENT,
        description: "Wipe all frequency and affinity data from the plugin",
        component: ResetButton
    },
    undoReset: {
        type: OptionType.COMPONENT,
        description: "Restore data if you reset by mistake",
        component: UndoButton
    }
});

export default settings;