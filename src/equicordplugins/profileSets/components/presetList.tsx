/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isNonNullish } from "@utils/guards";
import { classes } from "@utils/misc";
import { ProfilePreset } from "@vencord/discord-types";
import { ContextMenuApi, Menu, React, TextInput } from "@webpack/common";

import { cl } from "../classNames";
import { deletePreset, movePreset, renamePreset, updatePresetField } from "../utils/actions";
import { getCurrentProfile } from "../utils/profile";
import { PresetSection, type ProfilePresetEx } from "../utils/storage";
import { getThemeMenuLabel, openThemeAssignModal } from "./themeAssignModal";

interface PresetListProps {
    presets: ProfilePresetEx[];
    allPresets: ProfilePresetEx[];
    avatarSize: number;
    selectedPreset: number;
    onLoad: (index: number) => void;
    onUpdate: () => void;
    guildId?: string;
    section: PresetSection;
    currentPage: number;
    onPageChange: (page: number) => void;
}

function toHexColor(value: number | null | undefined): string | null {
    if (value == null || typeof value !== "number") return null;
    return `#${value.toString(16).padStart(6, "0")}`;
}

function getRowBackgroundStyle(preset: ProfilePresetEx): React.CSSProperties {
    if (preset.bannerDataUrl) {
        return {
            backgroundImage: `url(${preset.bannerDataUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
        };
    }

    const [primary, accent] = preset.themeColors ?? [];
    const primaryHex = toHexColor(primary);
    const accentHex = toHexColor(accent);
    if (primaryHex && accentHex) {
        return {
            backgroundImage: `linear-gradient(135deg, ${primaryHex} 0%, ${accentHex} 100%)`
        };
    }

    const accentSolid = toHexColor(preset.accentColor ?? undefined);
    if (accentSolid) {
        return { backgroundColor: accentSolid };
    }

    return {};
}

export function PresetList({
    presets,
    allPresets,
    avatarSize,
    selectedPreset,
    onLoad,
    onUpdate,
    guildId,
    section,
    currentPage,
    onPageChange
}: PresetListProps) {
    type EditableProfile = Omit<ProfilePreset, "name" | "timestamp">;
    const [renamingTimestamp, setRenamingTimestamp] = React.useState<number | null>(null);
    const [renameText, setRenameText] = React.useState("");
    const isGuildProfile = section === "server";

    return (
        <div className={cl("list-container")}>
            {presets.map(preset => {
                const actualIndex = allPresets.indexOf(preset);
                const isRenaming = renamingTimestamp === preset.timestamp;
                const isSelected = !isRenaming && selectedPreset === actualIndex;
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
                const rowBackground = getRowBackgroundStyle(preset);
                const hasBannerBg = Boolean(preset.bannerDataUrl || preset.themeColors || preset.accentColor);

                const commitRename = () => {
                    const nextName = renameText.trim();
                    if (!nextName) return;
                    renamePreset(actualIndex, nextName, section, guildId);
                    onUpdate();
                };

                return (
                    <div
                        key={preset.timestamp}
                        tabIndex={isRenaming ? -1 : 0}
                        role="button"
                        onClick={() => {
                            if (!isRenaming) {
                                onLoad(actualIndex);
                            }
                        }}
                        onKeyDown={e => {
                            if (!isRenaming && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                onLoad(actualIndex);
                            }
                        }}
                        className={classes(
                            cl("row"),
                            hasBannerBg ? cl("row-has-banner") : "",
                            isSelected ? "selected" : ""
                        )}
                    >
                        <div
                            className={cl("row-bg")}
                            style={rowBackground}
                            aria-hidden="true"
                        />
                        <div className={cl("row-scrim")} aria-hidden="true" />
                        <div className={cl("row-content")}>
                            <div className={cl("avatar-url")}>
                                {preset.avatarDataUrl && (
                                    <img
                                        src={preset.avatarDataUrl}
                                        alt=""
                                        className={classes(cl("avatar"), cl("avatar-ring"), isSelected ? cl("avatar-ring-selected") : "")}
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
                                                setRenamingTimestamp(null);
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                    commitRename();
                                                    setRenamingTimestamp(null);
                                                } else if (e.key === "Escape") {
                                                    setRenamingTimestamp(null);
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
                                        const themeTarget = {
                                            presetName: preset.name,
                                            section,
                                            guildId,
                                        };
                                        ContextMenuApi.openContextMenu(e, () => (
                                            <Menu.Menu navId="preset-options" onClose={ContextMenuApi.closeContextMenu}>
                                                <Menu.MenuItem
                                                    id="profile-sets-assign-theme"
                                                    label={getThemeMenuLabel(themeTarget)}
                                                    action={() => openThemeAssignModal(themeTarget)}
                                                />
                                                <Menu.MenuSeparator />
                                                <Menu.MenuItem
                                                    id="rename"
                                                    label="Rename"
                                                    action={() => {
                                                setRenamingTimestamp(preset.timestamp);
                                                        setRenameText(preset.name);
                                                    }}
                                                />
                                                <Menu.MenuItem
                                                    id="update"
                                                    label="Update"
                                                    action={async () => {
                                                        const profile = await getCurrentProfile(guildId, { isGuildProfile });
                                                        await Promise.all(
                                                            (Object.entries(profile) as [keyof EditableProfile, EditableProfile[keyof EditableProfile]][])
                                                                .filter(([, value]) => isNonNullish(value))
                                                                .map(([key, value]) => updatePresetField(actualIndex, key, value, section, guildId))
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
                                                            movePreset(actualIndex, actualIndex - 1, section, guildId);
                                                            onUpdate();
                                                        }}
                                                    />
                                                )}
                                                {actualIndex < allPresets.length - 1 && (
                                                    <Menu.MenuItem
                                                        id="move-down"
                                                        label="Move Down"
                                                        action={() => {
                                                            movePreset(actualIndex, actualIndex + 1, section, guildId);
                                                            onUpdate();
                                                        }}
                                                    />
                                                )}
                                                {currentPage > 1 && (
                                                    <Menu.MenuItem
                                                        id="move-to-page-1"
                                                        label="Move to Page 1"
                                                        action={() => {
                                                            movePreset(actualIndex, 0, section, guildId);
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
                                                        await deletePreset(actualIndex, section, guildId);
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
                    </div>
                );
            })}
        </div>
    );
}
