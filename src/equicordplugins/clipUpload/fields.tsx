/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { getTheme, Theme } from "@utils/discord";
import { ApplicationStore, Button, Checkbox, Forms, IconUtils, lodash, RunningGameStore, SearchableSelect, TextArea, TextInput, UserStore, useState, useStateFromStores } from "@webpack/common";
import type { PointerEvent as ReactPointerEvent } from "react";

import { getString } from "./upload";

interface TextFieldProps {
    title: string;
    value: string;
    onChange(value: string): void;
    placeholder?: string;
    disabled?: boolean;
    multiline?: boolean;
}

interface BooleanFieldProps {
    label: string;
    value: boolean;
    onChange(value: boolean): void;
    disabled?: boolean;
}

interface ParticipantFieldProps {
    value: string[];
    onChange(value: string[]): void;
    disabled?: boolean;
}

interface ApplicationFieldProps {
    value: string;
    onChange(value: string): void;
    disabled?: boolean;
}

export function TextField({ title, value, onChange, placeholder, disabled, multiline }: TextFieldProps) {
    return (
        <section>
            <Forms.FormTitle tag="h5">{title}</Forms.FormTitle>
            {multiline
                ? <TextArea value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} autosize />
                : <TextInput value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />}
        </section>
    );
}

export function DateTimeField({ value, onChange, disabled }: { value: string; onChange(value: string): void; disabled?: boolean; }) {
    return (
        <section>
            <Forms.FormTitle tag="h5">Created at</Forms.FormTitle>
            <input
                type="datetime-local"
                value={value}
                onChange={event => onChange(event.currentTarget.value)}
                disabled={disabled}
                style={{
                    boxSizing: "border-box",
                    width: "100%",
                    colorScheme: getTheme() === Theme.Light ? "light" : "dark"
                }}
            />
        </section>
    );
}

export function BooleanField({ label, value, onChange, disabled }: BooleanFieldProps) {
    return (
        <Checkbox
            value={value}
            onChange={(_event: ReactPointerEvent<Element>, checked: boolean) => onChange(checked)}
            disabled={disabled}
            type="row"
        >
            {label}
        </Checkbox>
    );
}

export function getDateTimeLocalValue(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function getSelectedParticipantIds(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value.filter((id): id is string => typeof id === "string");
}

function isSnowflake(value: string) {
    return /^\d{17,20}$/.test(value);
}

function getUserLabel(user: ReturnType<typeof UserStore.getCurrentUser>) {
    return user.globalName ? `${user.globalName} (@${user.username})` : user.tag;
}

export function ParticipantField({ value, onChange, disabled }: ParticipantFieldProps) {
    const [customId, setCustomId] = useState("");
    const options = useStateFromStores([UserStore], () => {
        const selectedIds = new Set(value);
        const userOptions = Object.values(UserStore.getUsers())
            .filter(user => !user.bot && !user.system)
            .sort((a, b) => getUserLabel(a).localeCompare(getUserLabel(b)))
            .map(user => {
                selectedIds.delete(user.id);

                return {
                    label: getUserLabel(user),
                    value: user.id
                };
            });

        return [
            ...userOptions,
            ...Array.from(selectedIds, id => ({
                label: id,
                value: id
            }))
        ];
    }, [value], lodash.isEqual);
    const trimmedCustomId = customId.trim();
    const canAddCustomId = isSnowflake(trimmedCustomId) && !value.includes(trimmedCustomId) && !disabled;

    function addCustomId() {
        if (!canAddCustomId) return;

        onChange([...value, trimmedCustomId]);
        setCustomId("");
    }

    return (
        <section>
            <Forms.FormTitle tag="h5">Participants</Forms.FormTitle>
            <Flex flexDirection="column" gap={8}>
                <SearchableSelect
                    options={options}
                    value={value}
                    onChange={(selected: unknown) => onChange(getSelectedParticipantIds(selected))}
                    closeOnSelect={false}
                    placeholder="Select users"
                    isDisabled={disabled}
                    multi
                    renderOptionPrefix={option => {
                        const id = getString(option.value);
                        const user = id ? UserStore.getUser(id) : null;
                        if (!user) return null;

                        return (
                            <img
                                src={IconUtils.getUserAvatarURL(user, false, 24)}
                                width={24}
                                height={24}
                                style={{ borderRadius: "50%" }}
                            />
                        );
                    }}
                />
                <Flex alignItems="center" gap={8}>
                    <TextInput
                        value={customId}
                        onChange={setCustomId}
                        placeholder="Custom user ID"
                        disabled={disabled}
                    />
                    <Button onClick={addCustomId} disabled={!canAddCustomId}>
                        Add
                    </Button>
                </Flex>
            </Flex>
        </section>
    );
}

function getApplicationOptions(selectedId: string) {
    const options = new Map<string, string>();
    const games = [
        ...RunningGameStore.getVisibleRunningGames(),
        ...RunningGameStore.getRunningGames(),
        ...RunningGameStore.getGamesSeen(true),
        ...RunningGameStore.getCandidateGames()
    ];

    for (const game of games) {
        if (game.id) options.set(game.id, `${game.name} (${game.id})`);
    }

    for (const app of ApplicationStore._getAllApplications()) {
        options.set(app.id, `${app.name} (${app.id})`);
    }

    if (selectedId && !options.has(selectedId)) {
        options.set(selectedId, selectedId);
    }

    return Array.from(options, ([value, label]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function ApplicationField({ value, onChange, disabled }: ApplicationFieldProps) {
    const options = useStateFromStores([RunningGameStore, ApplicationStore], () => getApplicationOptions(value), [value], lodash.isEqual);

    return (
        <section>
            <Forms.FormTitle tag="h5">Game/Application</Forms.FormTitle>
            <Flex flexDirection="column" gap={8}>
                <SearchableSelect
                    options={options}
                    value={value || undefined}
                    onChange={(selected: unknown) => onChange(getString(selected) ?? "")}
                    placeholder="Select a game"
                    isDisabled={disabled}
                    clearable
                    renderOptionPrefix={option => {
                        const id = getString(option.value);
                        const app = id ? ApplicationStore.getApplication(id) : null;
                        if (!app?.icon) return null;

                        return (
                            <img
                                src={IconUtils.getApplicationIconURL({ id: app.id, icon: app.icon })}
                                width={24}
                                height={24}
                                style={{ borderRadius: 4 }}
                            />
                        );
                    }}
                />
                <TextInput
                    value={value}
                    onChange={onChange}
                    placeholder="Custom application ID"
                    disabled={disabled}
                />
            </Flex>
        </section>
    );
}
