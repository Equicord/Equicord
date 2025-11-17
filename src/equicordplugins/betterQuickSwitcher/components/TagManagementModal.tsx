/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { BaseText } from "@components/BaseText";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { Button, ColorPicker, Forms, showToast, TextInput, Toasts, useCallback, useState } from "@webpack/common";

import { addTagToEntity, createTag, deleteTag, type EntityType, getAllTags, getEntityTags, removeTagFromEntity, type Tag, updateTag } from "../utils/tagData";
import { openTagDeleteConfirmationModal } from "./TagDeleteConfirmationModal";

const { FormTitle, FormText } = Forms;
const cl = classNameFactory("vc-bqs-");

interface TagManagementModalProps {
    entityId: string;
    entityType: EntityType;
    entityName: string;
}

function ColorPickerWrapper({ color, onChange }: { color: number; onChange: (color: number) => void; }) {
    try {
        return (
            <ColorPicker
                color={color}
                onChange={onChange}
                showEyeDropper={true}
            />
        );
    } catch {
        return (
            <input
                type="color"
                value={`#${color.toString(16).padStart(6, "0")}`}
                onChange={e => {
                    const hex = e.target.value.slice(1);
                    const decimal = parseInt(hex, 16);
                    onChange(decimal);
                }}
                style={{
                    width: "100%",
                    height: "40px",
                    border: "1px solid var(--background-modifier-accent)",
                    borderRadius: "4px",
                    cursor: "pointer"
                }}
            />
        );
    }
}

function TagManagementModalComponent({ entityId, entityType, entityName, ...modalProps }: TagManagementModalProps & ModalProps) {
    const [allTags, setAllTags] = useState<Tag[]>(getAllTags());
    const [assignedTagIds, setAssignedTagIds] = useState<Set<string>>(
        new Set(getEntityTags(entityId).map(t => t.id))
    );

    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState(0x5865F2); // Discord blurple default

    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editTagName, setEditTagName] = useState("");
    const [editTagColor, setEditTagColor] = useState(0x5865F2);

    const refreshTags = useCallback(() => {
        setAllTags(getAllTags());
        setAssignedTagIds(new Set(getEntityTags(entityId).map(t => t.id)));
    }, [entityId]);

    const handleCreateTag = useCallback(() => {
        const trimmedName = newTagName.trim();

        if (!trimmedName) {
            showToast("Tag name cannot be empty", Toasts.Type.FAILURE);
            return;
        }

        if (trimmedName.length > 20) {
            showToast("Tag name must be 20 characters or less", Toasts.Type.FAILURE);
            return;
        }

        try {
            const tag = createTag(trimmedName, newTagColor);
            showToast(`Created tag "${tag.name}"`, Toasts.Type.SUCCESS);
            setNewTagName("");
            setNewTagColor(0x5865F2);
            refreshTags();
        } catch (err: any) {
            showToast(err.message || "Failed to create tag", Toasts.Type.FAILURE);
        }
    }, [newTagName, newTagColor, refreshTags]);

    const handleToggleTag = useCallback((tagId: string) => {
        const currentTags = getEntityTags(entityId);
        const isAssigned = currentTags.some(tag => tag.id === tagId);

        if (isAssigned) {
            const success = removeTagFromEntity(entityId, tagId);
            if (success) {
                showToast("Tag removed", Toasts.Type.SUCCESS);
                refreshTags();
            }
        } else {
            const success = addTagToEntity(entityId, tagId, entityType);
            if (success) {
                showToast("Tag added", Toasts.Type.SUCCESS);
                refreshTags();
            }
        }
    }, [entityId, entityType, refreshTags]);

    const handleStartEdit = useCallback((tag: Tag) => {
        setEditingTagId(tag.id);
        setEditTagName(tag.name);
        setEditTagColor(tag.color);
    }, []);

    const handleSaveEdit = useCallback(() => {
        if (!editingTagId) return;

        const trimmedName = editTagName.trim();

        if (!trimmedName) {
            showToast("Tag name cannot be empty", Toasts.Type.FAILURE);
            return;
        }

        if (trimmedName.length > 20) {
            showToast("Tag name must be 20 characters or less", Toasts.Type.FAILURE);
            return;
        }

        try {
            const success = updateTag(editingTagId, { name: trimmedName, color: editTagColor });
            if (success) {
                showToast("Tag updated", Toasts.Type.SUCCESS);
                setEditingTagId(null);
                refreshTags();
            }
        } catch (err: any) {
            showToast(err.message || "Failed to update tag", Toasts.Type.FAILURE);
        }
    }, [editingTagId, editTagName, editTagColor, refreshTags]);

    const handleCancelEdit = useCallback(() => {
        setEditingTagId(null);
        setEditTagName("");
        setEditTagColor(0x5865F2);
    }, []);

    const handleDeleteTag = useCallback((tagId: string) => {
        const tag = allTags.find(t => t.id === tagId);
        if (!tag) return;

        openTagDeleteConfirmationModal(tag, () => {
            const success = deleteTag(tagId);
            if (success) {
                showToast(`Deleted tag "${tag.name}"`, Toasts.Type.SUCCESS);
                if (editingTagId === tagId) {
                    setEditingTagId(null);
                }
                refreshTags();
            }
        });
    }, [allTags, editingTagId, refreshTags]);

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <div className={cl("flex-col")} style={{ flexGrow: 1, gap: "4px" }}>
                    <BaseText tag="h2">Manage Tags</BaseText>
                    <FormText className={cl("text-small-muted")}>
                        Managing tags for: <strong>{entityName}</strong>
                    </FormText>
                </div>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent className="vc-better-quick-switcher-modal-content">
                {/* Create New Tag Section */}
                <div className={cl("flex-col")}>
                    <FormTitle tag="h3">Create New Tag</FormTitle>
                    <div className={cl("flex-row")}>
                        <div style={{ flex: 1 }}>
                            <FormText className={cl("text-small-muted")} style={{ marginBottom: "4px" }}>Tag Name (max 20 chars)</FormText>
                            <TextInput
                                placeholder="Enter tag name..."
                                value={newTagName}
                                onChange={setNewTagName}
                                maxLength={20}
                            />
                        </div>
                        <div style={{ width: "80px", marginTop: "16px" }}>
                            <ColorPickerWrapper color={newTagColor} onChange={setNewTagColor} />
                        </div>
                        <Button
                            onClick={handleCreateTag}
                            color={Button.Colors.BRAND}
                            disabled={!newTagName.trim()}
                            style={{ marginTop: "16px" }}
                        >
                            Create
                        </Button>
                    </div>
                </div>

                {/* Existing Tags Section */}
                <div className={cl("flex-col")}>
                    <FormTitle tag="h3">All Tags ({allTags.length})</FormTitle>
                    {allTags.length === 0 ? (
                        <FormText className="vc-better-quick-switcher-empty-state">
                            No tags created yet. Create one above!
                        </FormText>
                    ) : (
                        <div className="vc-better-quick-switcher-tag-list">
                            {allTags.map(tag => {
                                const isEditing = editingTagId === tag.id;
                                const isAssigned = assignedTagIds.has(tag.id);

                                return (
                                    <div
                                        key={tag.id}
                                        className={`vc-better-quick-switcher-tag-item ${isAssigned ? "vc-better-quick-switcher-tag-assigned" : ""}`}
                                    >
                                        {isEditing ? (
                                            <>
                                                <div style={{ flex: 1 }}>
                                                    <TextInput
                                                        value={editTagName}
                                                        onChange={setEditTagName}
                                                        maxLength={20}
                                                    />
                                                </div>
                                                <div style={{ width: "80px" }}>
                                                    <ColorPickerWrapper color={editTagColor} onChange={setEditTagColor} />
                                                </div>
                                                <Button size={Button.Sizes.SMALL} color={Button.Colors.GREEN} onClick={handleSaveEdit}>
                                                    Save
                                                </Button>
                                                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={handleCancelEdit}>
                                                    Cancel
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <div
                                                    className="vc-better-quick-switcher-tag-color-preview"
                                                    style={{
                                                        backgroundColor: `rgb(${(tag.color >> 16) & 0xFF}, ${(tag.color >> 8) & 0xFF}, ${tag.color & 0xFF})`
                                                    }}
                                                />
                                                <BaseText style={{ flex: 1 }} className={cl("text-bold")}>{tag.name}</BaseText>
                                                <Button
                                                    size={Button.Sizes.SMALL}
                                                    color={isAssigned ? Button.Colors.RED : Button.Colors.GREEN}
                                                    onClick={() => handleToggleTag(tag.id)}
                                                >
                                                    {isAssigned ? "Remove" : "Assign"}
                                                </Button>
                                                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => handleStartEdit(tag)}>
                                                    Edit
                                                </Button>
                                                <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => handleDeleteTag(tag.id)}>
                                                    Delete
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

/**
 * Opens the tag management modal for a specific entity
 */
export function openTagManagementModal(entityId: string, entityType: EntityType, entityName: string) {
    openModal(props => (
        <TagManagementModalComponent
            {...props}
            entityId={entityId}
            entityType={entityType}
            entityName={entityName}
        />
    ));
}
