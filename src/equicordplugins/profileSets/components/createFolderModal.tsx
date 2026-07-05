/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { RenderModalProps } from "@vencord/discord-types";
import { Forms, Modal, openModal, React, TextInput } from "@webpack/common";

import { cl } from "../classNames";
import { createFolder } from "../utils/actions";
import {
    FOLDER_COLOR_SWATCHES,
    FOLDER_NAME_MAX_LENGTH,
    folderNameValidationMessage,
    isValidFolderHexColor,
    normalizeFolderHexColor,
    validateFolderName,
} from "../utils/folders";
import { folders, PresetSection } from "../utils/storage";

type CreateFolderModalProps = RenderModalProps & {
    section: PresetSection;
    onCreated: () => void;
};

function FolderIconPreview({ color }: { color: string | null; }) {
    const safeColor = isValidFolderHexColor(color) ? color : undefined;
    return (
        <svg
            className={cl("folder-modal-preview-icon")}
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{ color: safeColor }}
        >
            <path
                fill="currentColor"
                d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"
            />
        </svg>
    );
}

function CreateFolderModal({ section, onCreated, ...props }: CreateFolderModalProps) {
    const [name, setName] = React.useState("");
    const [nameError, setNameError] = React.useState<string | undefined>();
    const [hexInput, setHexInput] = React.useState(FOLDER_COLOR_SWATCHES[0]);
    const [selectedColor, setSelectedColor] = React.useState<string | null>(FOLDER_COLOR_SWATCHES[0]);
    const [hexError, setHexError] = React.useState<string | undefined>();
    const [isSaving, setIsSaving] = React.useState(false);

    const handleNameChange = (value: string) => {
        setName(value);
        const validation = validateFolderName(value, folders);
        if (!value.trim()) {
            setNameError(undefined);
            return;
        }
        setNameError(validation.ok ? undefined : folderNameValidationMessage(validation.reason));
    };

    const pickColor = (color: string) => {
        setSelectedColor(color);
        setHexInput(color);
        setHexError(undefined);
    };

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

    const handleCreate = async () => {
        const validation = validateFolderName(name, folders);
        if (!validation.ok) {
            setNameError(folderNameValidationMessage(validation.reason));
            return;
        }
        const trimmedHex = hexInput.trim();
        if (trimmedHex && !normalizeFolderHexColor(trimmedHex)) {
            setHexError("Use a valid hex color like #5865f2.");
            return;
        }
        const color = selectedColor && isValidFolderHexColor(selectedColor) ? selectedColor : null;
        setIsSaving(true);
        const created = await createFolder(validation.name, section, color);
        setIsSaving(false);
        if (!created) return;
        onCreated();
        props.onClose();
    };

    return (
        <Modal
            {...props}
            size="sm"
            title="New folder"
            actions={[
                {
                    text: isSaving ? "Creating..." : "Create",
                    variant: "primary",
                    disabled: isSaving || !name.trim() || Boolean(hexError) || Boolean(nameError),
                    onClick: handleCreate,
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: props.onClose,
                },
            ]}
        >
            <div className={cl("folder-modal")}>
                <Paragraph>Create a folder to organize your profile presets.</Paragraph>

                <Forms.FormTitle tag="h5" className={classes(Margins.top16, Margins.bottom8)}>
                    Folder name
                </Forms.FormTitle>
                <TextInput
                    type="text"
                    placeholder="Enter folder name"
                    value={name}
                    onChange={handleNameChange}
                    error={nameError}
                    maxLength={FOLDER_NAME_MAX_LENGTH}
                    autoFocus
                />

                <Forms.FormTitle tag="h5" className={classes(Margins.top16, Margins.bottom8)}>
                    Color
                </Forms.FormTitle>
                <div className={cl("folder-modal-preview")}>
                    <FolderIconPreview color={selectedColor} />
                    <span className={cl("folder-modal-preview-label")}>Preview</span>
                </div>
                <div className={cl("folder-color-swatches")}>
                    {FOLDER_COLOR_SWATCHES.map(color => (
                        <button
                            key={color}
                            type="button"
                            className={classes(
                                cl("folder-color-swatch"),
                                selectedColor === color ? cl("folder-color-swatch-selected") : ""
                            )}
                            style={{ backgroundColor: color }}
                            aria-label={`Color ${color}`}
                            onClick={() => pickColor(color)}
                        />
                    ))}
                </div>

                <Forms.FormTitle tag="h5" className={classes(Margins.top8, Margins.bottom8)}>
                    Custom color (hex)
                </Forms.FormTitle>
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

export function openCreateFolderModal(section: PresetSection, onCreated: () => void) {
    openModal(props => (
        <CreateFolderModal
            {...props}
            section={section}
            onCreated={onCreated}
        />
    ));
}
