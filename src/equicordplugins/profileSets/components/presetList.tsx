/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";
import { ProfilePreset } from "@vencord/discord-types";
import { ContextMenuApi, Menu, React, showToast, TextInput, Toasts } from "@webpack/common";

import { cl } from "..";
import { deletePreset, movePreset, renamePreset, updatePresetField } from "../utils/actions";
import { getCurrentProfile } from "../utils/profile";

interface PresetListProps {
    presets: ProfilePreset[];
    allPresets: ProfilePreset[];
    avatarSize: number;
    selectedPreset: number;
    onLoad: (index: number) => void;
    onUpdate: () => void;
    guildId?: string;
    currentPage: number;
    onPageChange: (page: number) => void;
}

export function PresetList({ presets, allPresets, avatarSize, selectedPreset, onLoad, onUpdate, guildId, currentPage, onPageChange }: PresetListProps) {
    const [renaming, setRenaming] = React.useState<number>(-1);
    const [renameText, setRenameText] = React.useState("");

    return (
        <div className={cl("list-container")}>
            {presets.map(preset => {
                const actualIndex = allPresets.indexOf(preset);
                const isRenaming = renaming === actualIndex;
                const date = new Date(preset.timestamp);
                const formattedDate = date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                });
                const formattedTime = date.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit"
                });

                return (
                    <div
                        key={actualIndex}
                        tabIndex={isRenaming ? -1 : 0}
                        role="button"
                        onClick={() => {
                            if (!isRenaming) {
                                onLoad(actualIndex);
                                showToast(`Profile "${preset.name}" loaded successfully`, Toasts.Type.SUCCESS);
                            }
                        }}
                        onKeyDown={e => {
                            if (!isRenaming && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                onLoad(actualIndex);
                                showToast(`Profile "${preset.name}" loaded successfully`, Toasts.Type.SUCCESS);
                            }
                        }}
                        className={classes(cl("row"), !isRenaming && selectedPreset === actualIndex ? "selected" : "")}
                    >
                        <div className={cl("avatar-url")}>
                            {preset.avatarDataUrl && (
                                <img
                                    src={preset.avatarDataUrl}
                                    alt=""
                                    className={cl("avatar")}
                                    style={{ width: `${avatarSize}px`, height: `${avatarSize}px` }}
                                />
                            )}
                            <div className={cl("rename")}>
                                {isRenaming ? (
                                    <TextInput
                                        value={renameText}
                                        onChange={setRenameText}
                                        onBlur={() => {
                                            if (renameText.trim()) {
                                                renamePreset(actualIndex, renameText);
                                                onUpdate();
                                            }
                                            setRenaming(-1);
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                if (renameText.trim()) {
                                                    renamePreset(actualIndex, renameText);
                                                    onUpdate();
                                                }
                                                setRenaming(-1);
                                            } else if (e.key === "Escape") {
                                                setRenaming(-1);
                                            }
                                            e.stopPropagation();
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        autoFocus
                                    />
                                ) : (
                                    <>
                                        <div className={cl("name")}>
                                            {preset.name}
                                        </div>
                                        <div className={cl("timestamp")}>
                                            {formattedDate} at {formattedTime}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className={cl("updated")}>
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                className={cl("menu-icon")}
                                onClick={e => {
                                    e.stopPropagation();
                                    const target = e.currentTarget;
                                    ContextMenuApi.openContextMenu(e, () => (
                                        <Menu.Menu navId="preset-options" onClose={ContextMenuApi.closeContextMenu}>
                                            <Menu.MenuItem
                                                id="rename"
                                                label="Rename"
                                                action={() => {
                                                    setRenaming(actualIndex);
                                                    setRenameText(preset.name);
                                                }}
                                            />
                                            <Menu.MenuItem
                                                id="update"
                                                label="Update"
                                                action={async () => {
                                                    const profile = await getCurrentProfile(guildId);
                                                    Object.entries(profile).forEach(([key, value]) => {
                                                        if (value !== null && value !== undefined) {
                                                            updatePresetField(actualIndex, key as any, value);
                                                        }
                                                    });
                                                    showToast("Profile updated successfully", Toasts.Type.SUCCESS);
                                                    onUpdate();
                                                }}
                                            />
                                            <Menu.MenuSeparator />
                                            {actualIndex > 0 && (
                                                <Menu.MenuItem
                                                    id="move-up"
                                                    label="Move Up"
                                                    action={() => {
                                                        movePreset(actualIndex, actualIndex - 1);
                                                        onUpdate();
                                                    }}
                                                />
                                            )}
                                            {actualIndex < allPresets.length - 1 && (
                                                <Menu.MenuItem
                                                    id="move-down"
                                                    label="Move Down"
                                                    action={() => {
                                                        movePreset(actualIndex, actualIndex + 1);
                                                        onUpdate();
                                                    }}
                                                />
                                            )}
                                            {currentPage > 1 && (
                                                <Menu.MenuItem
                                                    id="move-to-page-1"
                                                    label="Move to Page 1"
                                                    action={() => {
                                                        movePreset(actualIndex, 0);
                                                        onPageChange(1);
                                                        onUpdate();
                                                    }}
                                                />
                                            )}
                                            <Menu.MenuSeparator />
                                            <Menu.MenuItem
                                                id="delete"
                                                label="Delete"
                                                color="danger"
                                                action={async () => {
                                                    await deletePreset(actualIndex);
                                                    onUpdate();
                                                }}
                                            />
                                        </Menu.Menu>
                                    ));
                                }}
                            >
                                <path
                                    fill="currentColor"
                                    d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"
                                />
                            </svg>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
