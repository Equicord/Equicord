/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { SettingsSection } from "@components/settings/tabs/plugins/components/Common";
import { Switch } from "@components/Switch";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { findByCodeLazy } from "@webpack";
import { Menu, Select, showToast, TextInput, Toasts, useState } from "@webpack/common";

type Status = "online" | "idle" | "dnd" | "invisible";
type TimedStatus = Exclude<Status, "online">;
type TimedPresetUnit = "seconds" | "minutes" | "hours" | "days";
type DefaultPresetSetting = "defaultIdlePresetId" | "defaultDndPresetId" | "defaultInvisiblePresetId";

type TimedPresetEntry = {
    id: string;
    type: "timed";
    amount: string;
    unit: TimedPresetUnit;
};

type ForeverPresetEntry = {
    id: string;
    type: "forever";
};

type PresetEntry = TimedPresetEntry | ForeverPresetEntry;

type StoredPresetEntry = {
    id?: string;
    type?: string;
    amount?: string;
    unit?: string;
};

type TimeoutPreset = {
    durationMs: number | null;
    id: string;
    label: string;
    raw: string;
};

type UnitConfig = {
    durationMs: number;
    label: string;
    singular: string;
    value: TimedPresetUnit;
};

type StatusMenuRow = {
    props?: {
        id?: string;
        action?: () => void;
        children?: StatusMenuRow[] | unknown;
    };
};

const cl = classNameFactory("vc-custom-presence-timeouts-");

const statusConfigs = [
    { id: "idle", label: "Idle", setting: "defaultIdlePresetId" },
    { id: "dnd", label: "Do Not Disturb", setting: "defaultDndPresetId" },
    { id: "invisible", label: "Invisible", setting: "defaultInvisiblePresetId" }
] as const satisfies readonly { id: TimedStatus; label: string; setting: DefaultPresetSetting; }[];

const statusLabels = Object.fromEntries(statusConfigs.map(({ id, label }) => [id, label])) as Record<TimedStatus, string>;
const statusIds = statusConfigs.map(({ id }) => id) as TimedStatus[];

const unitConfigs = [
    { durationMs: 1_000, label: "Seconds", singular: "second", value: "seconds" },
    { durationMs: 60_000, label: "Minutes", singular: "minute", value: "minutes" },
    { durationMs: 60 * 60_000, label: "Hours", singular: "hour", value: "hours" },
    { durationMs: 24 * 60 * 60_000, label: "Days", singular: "day", value: "days" }
] as const satisfies readonly UnitConfig[];

const unitOptions = unitConfigs.map(({ label, value }) => ({ label, value }));
const unitConfigMap = Object.fromEntries(unitConfigs.map(config => [config.value, config])) as Record<TimedPresetUnit, UnitConfig>;
const validTimedUnits = new Set<TimedPresetUnit>(unitConfigs.map(({ value }) => value));

const applyNativeTemporaryStatus = findByCodeLazy("nextStatus", "prevStatus", "durationMillis") as (args: {
    nextStatus: Status;
    prevStatus: Status;
    durationMillis?: number;
}) => void;

const foreverPreset: TimeoutPreset = {
    durationMs: null,
    id: "forever",
    label: "Forever",
    raw: "forever"
};

let nextPresetId = 0;

const createPresetId = () => `preset-${nextPresetId++}`;

const syncNextPresetId = (id: string) => {
    const match = /^preset-(\d+)$/.exec(id);
    if (match == null) return;

    nextPresetId = Math.max(nextPresetId, Number(match[1]) + 1);
};

const createTimedPresetEntry = (amount = "", unit: TimedPresetUnit = "minutes"): TimedPresetEntry => ({
    id: createPresetId(),
    type: "timed",
    amount,
    unit
});

const createForeverPresetEntry = (): ForeverPresetEntry => ({
    id: createPresetId(),
    type: "forever"
});

const defaultPresetEntries: PresetEntry[] = [
    createTimedPresetEntry("15", "minutes"),
    createTimedPresetEntry("1", "hours"),
    createTimedPresetEntry("8", "hours"),
    createTimedPresetEntry("24", "hours"),
    createTimedPresetEntry("3", "days"),
    createForeverPresetEntry()
];

function isForeverPresetEntry(entry: PresetEntry | StoredPresetEntry): entry is ForeverPresetEntry {
    return entry.type === "forever" || ("unit" in entry && entry.unit === "forever");
}

function clonePresetEntries(entries: PresetEntry[]) {
    return entries.map(entry => isForeverPresetEntry(entry)
        ? { ...entry }
        : { ...entry, amount: entry.amount }
    );
}

function sanitizePresetEntries(entries: StoredPresetEntry[] | undefined): PresetEntry[] {
    const presets: PresetEntry[] = [];
    let hasForever = false;

    for (const entry of entries ?? defaultPresetEntries) {
        if (isForeverPresetEntry(entry)) {
            if (hasForever) continue;

            hasForever = true;
            const id = typeof entry.id === "string" && entry.id.length ? entry.id : createPresetId();
            syncNextPresetId(id);
            presets.push({
                id,
                type: "forever"
            });
            continue;
        }

        if (!validTimedUnits.has(entry.unit as TimedPresetUnit)) continue;

        const id = typeof entry.id === "string" && entry.id.length ? entry.id : createPresetId();
        syncNextPresetId(id);

        presets.push({
            id,
            type: "timed",
            amount: String(entry.amount ?? ""),
            unit: entry.unit as TimedPresetUnit
        });
    }

    return presets;
}

const getPresetEntries = () => sanitizePresetEntries(settings.store.presets as StoredPresetEntry[] | undefined);

function toTimeoutPreset(entry: PresetEntry): TimeoutPreset | null {
    if (isForeverPresetEntry(entry)) return foreverPreset;

    const value = Number(entry.amount.trim());
    if (!Number.isInteger(value) || value < 1) return null;

    const unit = unitConfigMap[entry.unit];
    const unitLabel = value === 1 ? unit.singular : unit.label.toLowerCase();

    return {
        durationMs: value * unit.durationMs,
        id: entry.id,
        label: `For ${value} ${unitLabel.replace(/\b\w/g, letter => letter.toUpperCase())}`,
        raw: `${value} ${unitLabel}`
    };
}

const getTimeoutPresets = (entries = getPresetEntries()) => entries
    .map(toTimeoutPreset)
    .filter((preset): preset is TimeoutPreset => preset != null);

const getStoredDefaultPresetIds = () => Object.fromEntries(
    statusConfigs.map(({ id, setting }) => [id, String(settings.store[setting] ?? "")])
) as Record<TimedStatus, string>;

const storeDefaultPresetIds = (defaultPresetIds: Record<TimedStatus, string>) => {
    for (const { id, setting } of statusConfigs) {
        settings.store[setting] = defaultPresetIds[id];
    }
};

const settings = definePluginSettings({
    presets: {
        type: OptionType.COMPONENT,
        default: defaultPresetEntries,
        component: ErrorBoundary.wrap(() => {
            const [presets, setPresets] = useState(getPresetEntries);
            const [defaultPresetIds, setDefaultPresetIds] = useState(getStoredDefaultPresetIds);

            const updatePresets = (update: (current: PresetEntry[]) => PresetEntry[]) => {
                const next = sanitizePresetEntries(update(clonePresetEntries(presets)));
                setPresets(next);
                settings.store.presets = next;
            };

            const setDefaultPresetId = (status: TimedStatus, value: string) => {
                const next = { ...defaultPresetIds, [status]: value };
                setDefaultPresetIds(next);
                storeDefaultPresetIds(next);
            };

            const movePreset = (from: number, to: number) => {
                if (from === to || from < 0 || to < 0 || from >= presets.length || to >= presets.length) return;

                updatePresets(next => {
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved);
                    return next;
                });
            };

            const renderPresetFields = (preset: PresetEntry, index: number) => {
                if (isForeverPresetEntry(preset)) {
                    return <div className={cl("forever")}>Forever</div>;
                }

                return (
                    <>
                        <TextInput
                            className={cl("input")}
                            placeholder="15"
                            type="number"
                            value={preset.amount}
                            onChange={value => updatePresets(next => {
                                const current = next[index];
                                if (current.type !== "timed") return next;

                                next[index] = { ...current, amount: value.replace(/\D/g, "") };
                                return next;
                            })}
                        />
                        <div className={cl("select")}>
                            <Select
                                closeOnSelect
                                options={unitOptions}
                                isSelected={value => value === preset.unit}
                                select={value => updatePresets(next => {
                                    const current = next[index];
                                    if (current.type !== "timed") return next;

                                    next[index] = { ...current, unit: value as TimedPresetUnit };
                                    return next;
                                })}
                                serialize={String}
                            />
                        </div>
                    </>
                );
            };

            const toggleForever = (checked: boolean) => {
                updatePresets(next => checked
                    ? next.some(isForeverPresetEntry) ? next : [...next, createForeverPresetEntry()]
                    : next.filter(entry => !isForeverPresetEntry(entry))
                );
            };

            const defaultPresetOptions = getTimeoutPresets(presets).map(({ id, label }) => ({ label, value: id }));

            return (
                <section className={cl("editor")}>
                    <SettingsSection
                        tag="label"
                        name="Include Forever"
                        description="Show Forever as a movable timeout preset."
                        inlineSetting
                    >
                        <Switch
                            checked={presets.some(isForeverPresetEntry)}
                            onChange={toggleForever}
                        />
                    </SettingsSection>
                    <div className={cl("toolbar")}>
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={() => updatePresets(next => [...next, createTimedPresetEntry()])}
                        >
                            Add Preset
                        </Button>
                    </div>
                    <div className={cl("rows")}>
                        {presets.map((preset, index) => (
                            <div key={preset.id} className={cl("row")}>
                                {renderPresetFields(preset, index)}
                                <div className={cl("actions")}>
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        disabled={index === 0}
                                        onClick={() => movePreset(index, index - 1)}
                                    >
                                        Up
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        disabled={index === presets.length - 1}
                                        onClick={() => movePreset(index, index + 1)}
                                    >
                                        Down
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="dangerPrimary"
                                        onClick={() => updatePresets(next => {
                                            next.splice(index, 1);
                                            return next;
                                        })}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className={cl("defaults")}>
                        {statusConfigs.map(({ id, label }) => (
                            <SettingsSection
                                key={id}
                                name={`${label} Default`}
                                description={`What happens when you click ${label} directly.`}
                            >
                                <Select
                                    closeOnSelect
                                    options={defaultPresetOptions}
                                    isSelected={value => value === defaultPresetIds[id]}
                                    placeholder="Choose a default"
                                    select={value => setDefaultPresetId(id, value)}
                                    serialize={String}
                                />
                            </SettingsSection>
                        ))}
                    </div>
                </section>
            );
        }, { noop: true })
    },
    defaultIdlePresetId: {
        type: OptionType.STRING,
        description: "Default timeout preset for Idle.",
        default: foreverPreset.id,
        hidden: true
    },
    defaultDndPresetId: {
        type: OptionType.STRING,
        description: "Default timeout preset for Do Not Disturb.",
        default: foreverPreset.id,
        hidden: true
    },
    defaultInvisiblePresetId: {
        type: OptionType.STRING,
        description: "Default timeout preset for Invisible.",
        default: foreverPreset.id,
        hidden: true
    }
});

const StatusSettings = getUserSettingLazy<Status>("status", "status")!;

function getDefaultPreset(status: TimedStatus) {
    const presetId = getStoredDefaultPresetIds()[status];
    return getTimeoutPresets().find(({ id }) => id === presetId) ?? null;
}

function applyTemporaryStatus(status: TimedStatus, preset: TimeoutPreset) {
    applyNativeTemporaryStatus({
        nextStatus: status,
        prevStatus: StatusSettings.getSetting(),
        durationMillis: preset.durationMs ?? undefined
    });

    showToast(`${statusLabels[status]} set for ${preset.raw}.`, Toasts.Type.SUCCESS);
}

export default definePlugin({
    name: "CustomStatusTimeouts",
    description: "Adds configurable timeout presets to the status (presence) menu.",
    authors: [EquicordDevs.Kiri],
    settings,
    dependencies: ["UserSettingsAPI"],
    patches: [
        {
            find: "#{intl::STATUS_MENU_LABEL}",
            replacement: {
                match: /(navId:"set-status-submenu".{0,200}children:)(\i)/,
                replace: "$1$self.wrapStatusSubmenu($2)"
            }
        }
    ],
    wrapStatusSubmenu(children: unknown) {
        const menuChildren = children as StatusMenuRow | StatusMenuRow[];
        const rows = Array.isArray(menuChildren)
            ? menuChildren
            : Array.isArray(menuChildren?.props?.children)
                ? menuChildren.props.children as StatusMenuRow[]
                : [menuChildren];

        for (const row of rows) {
            if (!statusIds.includes(row?.props?.id as TimedStatus)) continue;

            const status = row.props!.id as TimedStatus;
            const defaultPreset = getDefaultPreset(status);
            if (defaultPreset != null) {
                row.props!.action = () => applyTemporaryStatus(status, defaultPreset);
            }

            row.props!.children = this.renderTimeoutItems(status);
        }

        return menuChildren;
    },
    renderTimeoutItems(status: TimedStatus) {
        return getTimeoutPresets().map(preset => (
            <Menu.MenuItem
                key={preset.id}
                id={`vc-custom-presence-timeout-${status}-${preset.id}`}
                label={preset.label}
                action={() => applyTemporaryStatus(status, preset)}
            />
        ));
    }
});
