/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Margins } from "@utils/margins";
import { ContextMenuApi, Forms, Menu, Modal, openModal, React, TextInput } from "@webpack/common";

import { cl } from "../classNames";
import { changeFolderColor, deleteFolderAction, moveFolder, renameFolderAction } from "../utils/actions";
import { countPresetsInFolder, FOLDER_COLOR_SWATCHES, FOLDER_NAME_MAX_LENGTH, isValidFolderHexColor, normalizeFolderHexColor } from "../utils/folders";
import { folders, PresetFolder, presets, PresetSection } from "../utils/storage";
import { DeleteFolderModal } from "./confirmModal";

type ColorPickerModalProps = {
    currentColor: string | null;
    onSelect: (color: string | null) => void;
    onClose: () => void;
};

function ColorPickerModal({ currentColor, onSelect, onClose, ...modalProps }: ColorPickerModalProps & { transitionState: number; }) {
    const [hexInput, setHexInput] = React.useState(currentColor ?? "");
    const [selectedColor, setSelectedColor] = React.useState<string | null>(currentColor);
    const [hexError, setHexError] = React.useState<string | undefined>();

    const handleHexChange = (value: string) => {
        setHexInput(value);
        const trimmed = value.trim();
        if (!trimmed) {
            setHexError(undefined);
            setSelectedColor(null);
            return;
        }
        const normalized = normalizeFolderHexColor(trimmed);
        if (normalized) {
            setSelectedColor(normalized);
            setHexError(undefined);
        } else {
            setSelectedColor(null);
            setHexError("Use a valid hex color like #5865f2.");
        }
    };

    return (
        <Modal {...modalProps} size="sm" title="Folder color"
            actions={[{
                text: "Save",
                variant: "primary",
                disabled: Boolean(hexError),
                onClick: () => {
                    onSelect(selectedColor);
                    onClose();
                },
            }, {
                text: "Cancel",
                variant: "secondary",
                onClick: onClose,
            }]}
        >
            <div className={cl("folder-modal")}>
                <Forms.FormTitle tag="h5">Color</Forms.FormTitle>
                <div className={cl("folder-color-swatches")}>
                    {FOLDER_COLOR_SWATCHES.map(color => (
                        <button
                            key={color}
                            type="button"
                            className={cl("folder-color-swatch", selectedColor === color ? "folder-color-swatch-selected" : "")}
                            style={{ backgroundColor: color }}
                            aria-label={`Color ${color}`}
                            onClick={() => {
                                setSelectedColor(color);
                                setHexInput(color);
                                setHexError(undefined);
                            }}
                        />
                    ))}
                </div>
                <Forms.FormTitle tag="h5" className={Margins.top8}>Custom color (hex)</Forms.FormTitle>
                <TextInput
                    type="text"
                    placeholder="#5865f2"
                    value={hexInput}
                    onChange={handleHexChange}
                    error={hexError}
                    maxLength={7}
                />
            </div>
        </Modal>
    );
}

type FolderListProps = {
    section: PresetSection;
    guildId?: string;
    onOpenFolder: (folderId: string) => void;
    onUpdate: () => void;
};

export function FolderList({ section, guildId, onOpenFolder, onUpdate }: FolderListProps) {
    const [renamingFolderId, setRenamingFolderId] = React.useState<string | null>(null);
    const [renameText, setRenameText] = React.useState("");

    const showDeletePrompt = (folder: PresetFolder, presetCount: number) => {
        openModal(props => (
            <DeleteFolderModal
                {...props}
                folderName={folder.name}
                presetCount={presetCount}
                onMoveToRoot={async () => {
                    await deleteFolderAction(folder.id, "moveToRoot", section, guildId);
                    onUpdate();
                }}
                onDeleteAll={async () => {
                    await deleteFolderAction(folder.id, "deleteAll", section, guildId);
                    onUpdate();
                }}
                onCancel={() => { }}
            />
        ));
    };

    if (!folders.length) return null;

    return (
        <div className={cl("folder-list")}>
            {folders.map(folder => {
                const presetCount = countPresetsInFolder(presets, folder.id);
                const isRenaming = renamingFolderId === folder.id;
                const folderColor = isValidFolderHexColor(folder.color) ? folder.color : null;
                const folderBgStyle: React.CSSProperties | undefined = folderColor
                    ? { backgroundColor: folderColor + "18" }
                    : undefined;

                const folderIndex = folders.indexOf(folder);
                const isFirst = folderIndex === 0;
                const isLast = folderIndex === folders.length - 1;

                const commitRename = async () => {
                    const ok = await renameFolderAction(folder.id, renameText, section);
                    if (ok) onUpdate();
                };

                const openColorPicker = () => {
                    const currentColor = isValidFolderHexColor(folder.color) ? folder.color : null;
                    openModal(props => (
                        <ColorPickerModal
                            {...props}
                            currentColor={currentColor}
                            onSelect={async color => {
                                await changeFolderColor(folderIndex, color, section);
                                onUpdate();
                            }}
                        />
                    ));
                };

                return (
                    <div
                        key={folder.id}
                        tabIndex={isRenaming ? -1 : 0}
                        role="button"
                        className={cl("folder-row")}
                        style={folderBgStyle}
                        onClick={() => {
                            if (!isRenaming) onOpenFolder(folder.id);
                        }}
                        onKeyDown={e => {
                            if (!isRenaming && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                onOpenFolder(folder.id);
                            }
                        }}
                    >
                        <div className={cl("folder-row-content")}>
                            <svg
                                width="24"
                                height="24"
                                className={cl("folder-icon")}
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                                style={{ color: folderColor ?? "currentColor" }}
                            >
                                <path
                                    fill="currentColor"
                                    d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
                                />
                            </svg>
                            <div className={cl("folder-meta")}>
                                {isRenaming ? (
                                    <TextInput
                                        value={renameText}
                                        onChange={setRenameText}
                                        maxLength={FOLDER_NAME_MAX_LENGTH}
                                        onBlur={() => {
                                            void commitRename();
                                            setRenamingFolderId(null);
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                void commitRename();
                                                setRenamingFolderId(null);
                                            } else if (e.key === "Escape") {
                                                setRenamingFolderId(null);
                                            }
                                            e.stopPropagation();
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        autoFocus
                                    />
                                ) : (
                                    <>
                                        <div className={cl("folder-name")}>{folder.name}</div>
                                        <div className={cl("folder-count")}>
                                            {presetCount} profile{presetCount === 1 ? "" : "s"}
                                        </div>
                                    </>
                                )}
                            </div>
                            <button
                                type="button"
                                className={cl("menu-button")}
                                aria-label={`Options for folder ${folder.name}`}
                                onClick={e => {
                                    e.stopPropagation();
                                    ContextMenuApi.openContextMenu(e, () => (
                                        <Menu.Menu navId="folder-options" onClose={ContextMenuApi.closeContextMenu}>
                                            {!isFirst && (
                                                <Menu.MenuItem
                                                    id="move-folder-up"
                                                    label="Move Up"
                                                    action={async () => {
                                                        await moveFolder(folderIndex, folderIndex - 1, section);
                                                        onUpdate();
                                                    }}
                                                />
                                            )}
                                            {!isLast && (
                                                <Menu.MenuItem
                                                    id="move-folder-down"
                                                    label="Move Down"
                                                    action={async () => {
                                                        await moveFolder(folderIndex, folderIndex + 1, section);
                                                        onUpdate();
                                                    }}
                                                />
                                            )}
                                            <Menu.MenuSeparator />
                                            <Menu.MenuItem
                                                id="rename-folder"
                                                label="Rename"
                                                action={() => {
                                                    setRenamingFolderId(folder.id);
                                                    setRenameText(folder.name);
                                                }}
                                            />
                                            <Menu.MenuItem
                                                id="change-folder-color"
                                                label="Change Color"
                                                action={openColorPicker}
                                            />
                                            <Menu.MenuSeparator />
                                            <Menu.MenuItem
                                                id="delete-folder"
                                                label="Delete folder"
                                                color="danger"
                                                action={() => showDeletePrompt(folder, presetCount)}
                                            />
                                        </Menu.Menu>
                                    ));
                                }}
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 20 20"
                                    className={cl("menu-icon")}
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
