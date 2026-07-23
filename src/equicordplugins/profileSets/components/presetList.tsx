/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isNonNullish } from "@utils/guards";
import { classes } from "@utils/misc";
import { ProfilePreset } from "@vencord/discord-types";
import { ContextMenuApi, Menu, React, TextInput } from "@webpack/common";

import { cl } from "..";
import { deletePreset, movePreset, renamePreset, updatePresetField } from "../utils/actions";
import { getCurrentProfile } from "../utils/profile";
import { type ProfilePresetEx } from "../utils/storage";

interface PresetListProps {
    presets: ProfilePresetEx[];
    allPresets: ProfilePresetEx[];
    avatarSize: number;
    selectedPreset: number;
    onLoad: (index: number) => void;
    onUpdate: () => void;
    currentPage: number;
    onPageChange: (page: number) => void;
}

export function PresetList({
    presets,
    allPresets,
    avatarSize,
    selectedPreset,
    onLoad,
    onUpdate,
    currentPage,
    onPageChange
}: PresetListProps) {
    type EditableProfile = Omit<ProfilePreset, "name" | "timestamp">;
    const [renaming, setRenaming] = React.useState<number>(-1);
    const [renameText, setRenameText] = React.useState("");

    return (
        <div className={cl("list-container")}>
            {presets.map(preset => {
                const findIndex = () => allPresets.findIndex(p => p.timestamp === preset.timestamp && p.name === preset.name);
                const actualIndex = findIndex();
                const isRenaming = renaming === actualIndex;
                const isSelected = !isRenaming && selectedPreset === actualIndex;
                const showMoveOptions = actualIndex > 0 || actualIndex < allPresets.length - 1 || currentPage > 1;
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

                const commitRename = () => {
                    const nextName = renameText.trim();
                    if (!nextName) return;
                    const idx = findIndex();
                    if (idx === -1) return;
                    renamePreset(idx, nextName);
                    onUpdate();
                };

                return (
                    <div
                        key={`${preset.timestamp}-${preset.name}`}
                        tabIndex={isRenaming ? -1 : 0}
                        role="button"
                        onClick={() => {
                            if (!isRenaming) {
                                const idx = findIndex();
                                if (idx !== -1) onLoad(idx);
                            }
                        }}
                        onKeyDown={e => {
                            if (!isRenaming && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                const idx = findIndex();
                                if (idx !== -1) onLoad(idx);
                            }
                        }}
                        className={classes(cl("row"), isSelected && cl("row-selected"))}
                        style={preset.bannerDataUrl ? { backgroundImage: `url(${preset.bannerDataUrl})` } : undefined}
                    >
                        <div className={cl("avatar-url")}>
                            {preset.avatarDataUrl && (
                                <img
                                    src={preset.avatarDataUrl}
                                    alt={`${preset.name} avatar`}
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
                                            commitRename();
                                            setRenaming(-1);
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                commitRename();
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
                                    ContextMenuApi.openContextMenu(e, () => (
                                        <Menu.Menu navId="preset-options" onClose={ContextMenuApi.closeContextMenu}>
                                            <Menu.MenuItem
                                                id="rename"
                                                label="Rename"
                                                action={() => {
                                                    const idx = findIndex();
                                                    if (idx === -1) return;
                                                    setRenaming(idx);
                                                    setRenameText(preset.name);
                                                }}
                                            />
                                            <Menu.MenuItem
                                                id="update"
                                                label="Update"
                                                action={async () => {
                                                    const idx = findIndex();
                                                    if (idx === -1) return;
                                                    const profile = await getCurrentProfile();
                                                    await Promise.all(
                                                        (Object.entries(profile) as [keyof EditableProfile, EditableProfile[keyof EditableProfile]][])
                                                            .filter(([, value]) => isNonNullish(value))
                                                            .map(([key, value]) => updatePresetField(idx, key, value))
                                                    );
                                                    onUpdate();
                                                }}
                                            />
                                            <Menu.MenuSeparator />
                                            {actualIndex > 0 && (
                                                <Menu.MenuItem
                                                    id="move-up"
                                                    label="Move Up"
                                                    action={() => {
                                                        const idx = findIndex();
                                                        if (idx <= 0) return;
                                                        movePreset(idx, idx - 1);
                                                        onUpdate();
                                                    }}
                                                />
                                            )}
                                            {actualIndex < allPresets.length - 1 && (
                                                <Menu.MenuItem
                                                    id="move-down"
                                                    label="Move Down"
                                                    action={() => {
                                                        const idx = findIndex();
                                                        if (idx === -1 || idx >= allPresets.length - 1) return;
                                                        movePreset(idx, idx + 1);
                                                        onUpdate();
                                                    }}
                                                />
                                            )}
                                            {currentPage > 1 && (
                                                <Menu.MenuItem
                                                    id="move-to-page-1"
                                                    label="Move to Page 1"
                                                    action={() => {
                                                        const idx = findIndex();
                                                        if (idx === -1) return;
                                                        movePreset(idx, 0);
                                                        onPageChange(1);
                                                        onUpdate();
                                                    }}
                                                />
                                            )}
                                            {showMoveOptions && <Menu.MenuSeparator />}
                                            <Menu.MenuItem
                                                id="delete"
                                                label="Delete"
                                                color="danger"
                                                action={async () => {
                                                    const idx = findIndex();
                                                    if (idx === -1) return;
                                                    await deletePreset(idx);
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
