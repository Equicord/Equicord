/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type AudioPlayerInterface, createAudioPlayer, defaultAudioNames } from "@api/AudioPlayer";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Switch } from "@components/Switch";
import { React, Slider, useEffect, useMemo, useRef, useState } from "@webpack/common";
import type { JSX, MouseEvent } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { settingTooltips } from "../settings/tooltips";
import { q } from "../utils/ui";
import { ManaSelectFormattedOption, ManaSelectOption, SettingsSelect, SettingsTooltip } from "./shared";

const questFetchIntervalOptions = [
    { id: "off", label: "Off", value: "0" },
    { id: "30-minutes", label: "30 Minutes", value: String(30 * 60) },
    { id: "45-minutes", label: "45 Minutes", value: String(45 * 60) },
    { id: "1-hour", label: "1 Hour", value: String(60 * 60) },
    { id: "3-hours", label: "3 Hours", value: String(3 * 60 * 60) },
    { id: "6-hours", label: "6 Hours", value: String(6 * 60 * 60) },
    { id: "12-hours", label: "12 Hours", value: String(12 * 60 * 60) },
] satisfies ManaSelectOption[];

function SoundIcon({ className }: { className?: string; }): JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            height={18}
            width={18}
            fill="none"
            className={className}
            aria-hidden={true}
        >
            <path fill="currentColor" d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z" />
            <path fill="currentColor" d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z" />
        </svg>
    );
}

function getSoundOptions(): ManaSelectOption[] {
    return [
        { id: "off", label: "Off", value: "" },
        ...defaultAudioNames()
            .map(sound => ({
                id: sound,
                label: formatSoundName(sound),
                value: sound,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
    ];
}

function formatSoundName(sound: string): string {
    return sound
        .toUpperCase()
        .replace(/_/g, " ")
        .replace(/(\d+)/g, " $1");
}

interface QuestNotificationSoundSelectProps {
    disabled?: boolean;
    label: string;
    tooltip?: string;
    onChange: (value: string | null) => void;
    onPreview: (sound: string) => void;
    options: ManaSelectOption[];
    playingSound: string | null;
    value: string | null;
}

function QuestNotificationSoundSelect({
    disabled,
    label,
    tooltip,
    onChange,
    onPreview,
    options,
    playingSound,
    value,
}: QuestNotificationSoundSelectProps): JSX.Element {
    function formatOption(option: ManaSelectOption): ManaSelectFormattedOption {
        const sound = option.value || null;
        const isPlaying = sound != null && playingSound === sound;

        function handlePreviewMouseDown(event: MouseEvent<HTMLButtonElement>) {
            event.preventDefault();
            event.stopPropagation();
        }

        function handlePreviewClick(event: MouseEvent<HTMLButtonElement>) {
            event.preventDefault();
            event.stopPropagation();

            if (sound && !disabled) {
                onPreview(sound);
            }
        }

        return {
            ...option,
            leading: sound
                ? (
                    <Button
                        type="button"
                        variant="none"
                        size="iconOnly"
                        className={q("sound-preview-button", isPlaying ? "playing-audio" : undefined)}
                        aria-label={`Preview ${option.label}`}
                        aria-pressed={isPlaying}
                        disabled={disabled}
                        onMouseDown={handlePreviewMouseDown}
                        onClick={handlePreviewClick}
                        onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                        }}
                    >
                        <SoundIcon />
                    </Button>
                )
                : undefined,
        };
    }

    return (
        <SettingsSelect
            tooltip={tooltip}
            label={label}
            hideLabel={true}
            options={options}
            value={value ?? ""}
            disabled={disabled}
            maxOptionsVisible={7}
            formatOption={formatOption}
            onSelectionChange={nextValue => {
                if (nextValue != null && typeof nextValue !== "string") return;

                onChange(nextValue || null);
            }}
        />
    );
}

const notificationTypes = [
    { title: "Completed Quests", soundLabel: "Play a sound when a Quest is completed", notify: "notifyOnQuestComplete", sound: "questCompletedAlertSound", volume: "questCompletedAlertVolume" },
    { title: "New Quests", soundLabel: "Play a sound when new Quests are detected", notify: "notifyOnNewQuests", sound: "newQuestAlertSound", volume: "newQuestAlertVolume" },
    { title: "New excluded Quests", soundLabel: "Play a sound when new excluded Quests are detected", notify: "notifyOnNewExcludedQuests", sound: "newExcludedQuestAlertSound", volume: "newExcludedQuestAlertVolume" },
] as const;

const notificationSettingKeys = [
    "newExcludedQuestAlertSound",
    "newExcludedQuestAlertVolume",
    "newQuestAlertSound",
    "newQuestAlertVolume",
    "questFetchInterval",
    "disableQuestsEverything",
    "notifyOnNewExcludedQuests",
    "notifyOnNewQuests",
    "notifyOnQuestComplete",
    "questCompletedAlertSound",
    "questCompletedAlertVolume",
] as const;

export function QuestNotificationsSetting(): JSX.Element {
    const questNotifications = useQuestifySettings(notificationSettingKeys);
    const tableId = React.useId();

    const soundOptions = useMemo(getSoundOptions, []);
    const activePlayer = useRef<AudioPlayerInterface | null>(null);
    const [playingPreview, setPlayingPreview] = useState<{ notification: typeof notificationTypes[number]["notify"]; sound: string; } | null>(null);
    const disabled = questNotifications.disableQuestsEverything;

    function clearActivePlayer(): void {
        const player = activePlayer.current;
        activePlayer.current = null;
        player?.stop();
        setPlayingPreview(null);
    }

    function previewSound(notification: typeof notificationTypes[number]["notify"], sound: string, volume: number): void {
        if (playingPreview?.notification === notification && playingPreview.sound === sound) {
            clearActivePlayer();

            return;
        }

        clearActivePlayer();
        function finishPreview(): void {
            if (activePlayer.current === player) clearActivePlayer();
        }

        const player = createAudioPlayer(sound, { volume, onEnded: finishPreview, onError: finishPreview });
        activePlayer.current = player;
        setPlayingPreview({ notification, sound });
        player.play();
    }

    useEffect(() => clearActivePlayer, []);
    useEffect(() => {
        if (disabled) {
            clearActivePlayer();
        }
    }, [disabled]);

    function updateFetchInterval(value: string | string[] | null): void {
        if (value != null && typeof value !== "string") return;

        const interval = value == null ? 0 : Number(value);
        getQuestifySettings().questFetchInterval = interval;
    }

    return (
        <>
            <Card className={q("settings-section", "notifications-section")}>
                <table className={q("notification-table")} aria-label="Quest notifications">
                    <thead>
                        <tr>
                            <th scope="col">Quest event</th>
                            <th scope="col" id={`${tableId}-notification`}>Notification</th>
                            <th scope="col">Sound</th>
                            <th scope="col">Volume</th>
                        </tr>
                    </thead>
                    <tbody>
                        {notificationTypes.map(notification => (
                            <tr key={notification.notify}>
                                <th scope="row" id={`${tableId}-${notification.notify}`}>{notification.title}</th>
                                <td className={q("notification-toggle")}>
                                    <SettingsTooltip text={notification.notify === "notifyOnNewExcludedQuests" ? settingTooltips.notifyOnNewExcludedQuests : `Show a notification for ${notification.title.toLowerCase()}.`}>
                                        <Switch
                                            checked={questNotifications[notification.notify]}
                                            disabled={disabled}
                                            aria-labelledby={`${tableId}-${notification.notify} ${tableId}-notification`}
                                            onChange={checked => { getQuestifySettings()[notification.notify] = checked; }}
                                        />
                                    </SettingsTooltip>
                                </td>
                                <td>
                                    <QuestNotificationSoundSelect
                                        tooltip={notification.soundLabel}
                                        label={notification.soundLabel}
                                        disabled={disabled}
                                        options={soundOptions}
                                        value={questNotifications[notification.sound]}
                                        playingSound={playingPreview?.notification === notification.notify ? playingPreview.sound : null}
                                        onPreview={sound => previewSound(notification.notify, sound, questNotifications[notification.volume])}
                                        onChange={value => { getQuestifySettings()[notification.sound] = value; }}
                                    />
                                </td>
                                <td>
                                    <div className={q("notification-volume")}>
                                        <Slider
                                            minValue={0}
                                            maxValue={100}
                                            initialValue={questNotifications[notification.volume]}
                                            className={q("notification-volume-slider")}
                                            aria-label={`${notification.title} volume`}
                                            getAriaValueText={value => `${Math.round(value)}%`}
                                            disabled={disabled || !questNotifications[notification.sound]}
                                            onValueChange={value => { getQuestifySettings()[notification.volume] = value; }}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
            <div className={q("quest-fetch-interval")}>
                <SettingsSelect
                    tooltip={settingTooltips.questFetchInterval}
                    label="Quest Fetch Interval"
                    options={questFetchIntervalOptions}
                    value={String(questNotifications.questFetchInterval)}
                    disabled={disabled}
                    maxOptionsVisible={questFetchIntervalOptions.length}
                    onSelectionChange={updateFetchInterval}
                />
            </div>
        </>
    );
}
