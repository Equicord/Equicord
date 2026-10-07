/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { QuestStore, useMemo, useState, useStateFromStores } from "@webpack/common";
import type { JSX } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { type QuestTileColorSetting, type QuestTileGradient } from "../settings/def";
import { rerenderQuests } from "../settings/rerender";
import { settingTooltips } from "../settings/tooltips";
import { enabledOnStartup } from "../state";
import { getQuestTileClasses, getQuestTileStyle } from "../utils/questTiles";
import { q } from "../utils/ui";
import { ManaButton, type ManaSelectOption, SettingsColorPicker, SettingsRow, SettingsRowItem, SettingsSection, SettingsSelect, toManaOptions } from "./shared";

const QuestTile = findComponentByCodeLazy(".rowIndex,trackGuildAndChannelMetadata") as React.ComponentType<{
    className?: string;
    quest: Quest;
}>;

const gradientOptions = [
    { label: "Intense", value: "intense" },
    { label: "Default", value: "default" },
    { label: "Subtle black", value: "black" },
    { label: "None", value: "hide" },
] as const satisfies readonly { label: string, value: QuestTileGradient; }[];

const gradientManaOptions = toManaOptions(gradientOptions);

const preloadManaOptions: ManaSelectOption[] = [
    { id: "true", label: "When the page opens", value: "true" },
    { id: "false", label: "While scrolling", value: "false" },
];

type QuestTileColorKey =
    | "questTileUnclaimedColor"
    | "questTileClaimedColor"
    | "questTileIgnoredColor"
    | "questTileExpiredColor";

interface QuestTileColorOption {
    key: QuestTileColorKey;
    label: string;
}

const colorOptions = [
    {
        key: "questTileUnclaimedColor",
        label: "Unclaimed",
    },
    {
        key: "questTileClaimedColor",
        label: "Claimed",
    },
    {
        key: "questTileIgnoredColor",
        label: "Ignored",
    },
    {
        key: "questTileExpiredColor",
        label: "Expired",
    },
] as const satisfies readonly QuestTileColorOption[];

const defaultPreviewColorKey: QuestTileColorKey = "questTileUnclaimedColor";

function getPreviewQuest(): Quest | null {
    return QuestStore.quests.values().next().value ?? null;
}

function DummyQuestTile({
    disabled,
    dummyQuest,
    dummyGradient,
}: {
    disabled?: boolean;
    dummyQuest: Quest & { dummyColor: QuestTileColorSetting; };
    dummyGradient: QuestTileGradient;
}): JSX.Element {
    const classes = getQuestTileClasses(q("dummy-quest"), dummyQuest, dummyGradient);
    const style = getQuestTileStyle(dummyQuest);

    return (
        <div
            inert={true}
            className={q("dummy-quest-preview", disabled ? "dimmed-settings-item" : undefined)}
            style={style}
        >
            <QuestTile
                className={classes}
                quest={dummyQuest}
            />
        </div>
    );
}

function DummyQuestPreview({
    disabled,
    dummyColor,
    dummyGradient,
}: {
    disabled?: boolean;
    dummyColor: QuestTileColorSetting;
    dummyGradient: QuestTileGradient;
}): JSX.Element | null {
    const sourceQuest = useStateFromStores([QuestStore], getPreviewQuest);

    const dummyQuest = useMemo(
        () => sourceQuest ? { ...sourceQuest, dummyColor } : null,
        [dummyColor, sourceQuest]
    );

    if (!dummyQuest) return null;

    return (
        <DummyQuestTile
            disabled={disabled}
            dummyQuest={dummyQuest}
            dummyGradient={dummyGradient}
        />
    );
}

const appearanceSettingKeys = [
    "disableQuestsEverything",
    "questTileUnclaimedColor",
    "questTileClaimedColor",
    "questTileIgnoredColor",
    "questTileExpiredColor",
    "questTileGradient",
    "questTilePreload",
] as const;

export function QuestAppearanceSetting(): JSX.Element {
    const questTiles = useQuestifySettings(appearanceSettingKeys);

    const [previewColorKey, setPreviewColorKey] = useState<QuestTileColorKey>(defaultPreviewColorKey);

    const disabled = questTiles.disableQuestsEverything;
    const previewColor = questTiles[previewColorKey];

    function updateColor(key: QuestTileColorKey, nextColor: QuestTileColorSetting): void {
        setPreviewColorKey(key);
        getQuestifySettings()[key] = nextColor;
    }

    function updateColorValue(key: QuestTileColorKey, setting: QuestTileColorSetting, value: number | null): void {
        if (typeof value !== "number") return;

        updateColor(key, {
            enabled: setting.enabled,
            color: value,
        });
    }

    function updateColorEnabled(key: QuestTileColorKey, setting: QuestTileColorSetting, enabled: boolean): void {
        updateColor(key, {
            ...setting,
            enabled,
        });
    }

    function updateGradient(value: string | string[] | null): void {
        if (typeof value !== "string") return;

        getQuestifySettings().questTileGradient = value as QuestTileGradient;
    }

    function updatePreload(value: string | string[] | null): void {
        if (typeof value !== "string") return;

        const preload = value === "true";
        getQuestifySettings().questTilePreload = preload;
        rerenderQuests();
    }

    return (
        <SettingsSection title="Quest tiles" description="Highlight Quests with optional theme colors for visibility.">
            <SettingsRow>
                <SettingsRowItem>
                    <SettingsSelect
                        tooltip={settingTooltips.questTileGradient}
                        label="Gradient Style"
                        options={gradientManaOptions}
                        value={questTiles.questTileGradient}
                        disabled={disabled}
                        maxOptionsVisible={gradientManaOptions.length}
                        onSelectionChange={updateGradient}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsSelect
                        tooltip={settingTooltips.questTilePreload}
                        label="Asset Preload"
                        options={preloadManaOptions}
                        value={String(questTiles.questTilePreload)}
                        disabled={disabled}
                        maxOptionsVisible={preloadManaOptions.length}
                        onSelectionChange={updatePreload}
                    />
                </SettingsRowItem>
            </SettingsRow>
            <SettingsRow className="quest-tile-color-row">
                {colorOptions.map(({ key, label }) => {
                    const setting = questTiles[key];

                    return (
                        <SettingsRowItem key={key} className="quest-tile-color-row-item">
                            <div
                                role="group"
                                aria-label={`${label} tile color`}
                                onFocusCapture={() => setPreviewColorKey(key)}
                                onPointerDownCapture={() => setPreviewColorKey(key)}
                            >
                                <SettingsColorPicker
                                    label={label}
                                    className={["quest-tile-color-picker", setting.enabled ? "" : "disabled-color-picker"].filter(Boolean)}
                                    color={setting.color}
                                    disabled={disabled || !setting.enabled}
                                    onChange={value => updateColorValue(key, setting, value)}
                                    showEyeDropper={true}
                                />
                            </div>
                            <div className={q("settings-button", "quest-tile-color-button")}>
                                <ManaButton
                                    text={setting.enabled ? "Disable" : "Enable"}
                                    variant={setting.enabled ? "secondary" : "primary"}
                                    disabled={disabled}
                                    fullWidth={true}
                                    size="sm"
                                    onClick={() => updateColorEnabled(key, setting, !setting.enabled)}
                                />
                            </div>
                        </SettingsRowItem>
                    );
                })}
            </SettingsRow>
            {enabledOnStartup && <DummyQuestPreview
                disabled={disabled}
                dummyColor={previewColor}
                dummyGradient={questTiles.questTileGradient as QuestTileGradient}
            />}
        </SettingsSection>
    );
}
