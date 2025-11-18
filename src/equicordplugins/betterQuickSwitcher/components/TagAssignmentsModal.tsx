/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { useForceUpdater } from "@utils/react";
import { Button, ColorPicker, Forms, showToast, TextInput, Toasts, useState } from "@webpack/common";

import { cl } from "..";
import { getEntityTypeName, type ResolvedEntity, resolveEntityName } from "../utils/entityResolver";
import { deleteTag, getEntitiesWithTag, getUserTagData, removeTagFromEntity, type Tag, updateTag } from "../utils/tagData";
import { openTagDeleteConfirmationModal } from "./TagDeleteConfirmationModal";

const { FormTitle, FormText } = Forms;

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

interface AssignmentRowProps {
    entity: ResolvedEntity;
    tagId: string;
    onRemove: () => void;
}

function AssignmentRow({ entity, tagId, onRemove }: AssignmentRowProps) {
    return (
        <div className={cl("assignment-row")}>
            {entity.icon && (
                <div className={cl("assignment-icon")}>
                    <img src={entity.icon} alt="" className={cl("assignment-avatar")} />
                </div>
            )}
            <div className={cl("assignment-info")}>
                <BaseText className={cl("text-bold")}>
                    {entity.name}
                </BaseText>
                <FormText className={cl("text-small-muted")}>
                    {getEntityTypeName(entity.type)}
                </FormText>
            </div>
            <Button
                size={Button.Sizes.SMALL}
                color={Button.Colors.RED}
                onClick={onRemove}
            >
                Remove
            </Button>
        </div>
    );
}

interface TagAssignmentsModalProps {
    tag: Tag;
}

function TagAssignmentsModalComponent({ tag, ...modalProps }: TagAssignmentsModalProps & ModalProps) {
    const [tagName, setTagName] = useState(tag.name);
    const [tagColor, setTagColor] = useState(tag.color);
    const [isEditing, setIsEditing] = useState(false);
    const update = useForceUpdater();

    const entityIds = getEntitiesWithTag(tag.id);

    const tagData = getUserTagData();
    const entityTypes: Record<string, any> = {};
    entityIds.forEach(id => {
        const entityInfo = tagData.entityTags[id];
        if (entityInfo) {
            entityTypes[id] = entityInfo.entityType;
        }
    });

    const resolvedEntities = entityIds.map(id =>
        resolveEntityName(id, entityTypes[id])
    );

    const grouped = {
        channel: resolvedEntities.filter(e => e.type === "channel"),
        voice: resolvedEntities.filter(e => e.type === "voice"),
        dm: resolvedEntities.filter(e => e.type === "dm"),
        groupDm: resolvedEntities.filter(e => e.type === "groupDm"),
        thread: resolvedEntities.filter(e => e.type === "thread"),
        forum: resolvedEntities.filter(e => e.type === "forum"),
        forumPost: resolvedEntities.filter(e => e.type === "forumPost"),
        member: resolvedEntities.filter(e => e.type === "member"),
        guild: resolvedEntities.filter(e => e.type === "guild")
    };

    function handleSaveEdit() {
        if (!tagName.trim()) {
            showToast("Tag name cannot be empty", Toasts.Type.FAILURE);
            return;
        }

        try {
            updateTag(tag.id, { name: tagName, color: tagColor });
            showToast("Tag updated", Toasts.Type.SUCCESS);
            setIsEditing(false);
            update();
        } catch (err: any) {
            showToast(err.message || "Failed to update tag", Toasts.Type.FAILURE);
        }
    }

    function handleRemoveAssignment(entityId: string) {
        const success = removeTagFromEntity(entityId, tag.id);
        if (success) {
            showToast("Assignment removed", Toasts.Type.SUCCESS);
            update();
        }
    }

    function handleDeleteTag() {
        openTagDeleteConfirmationModal(tag, () => {
            const success = deleteTag(tag.id);
            if (success) {
                showToast(`Deleted tag "${tag.name}"`, Toasts.Type.SUCCESS);
                modalProps.onClose();
            }
        });
    }

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <div className={cl("flex-row")} style={{ flexGrow: 1 }}>
                    <div
                        className={cl("tag-color-preview")}
                        style={{
                            backgroundColor: `rgb(${(tagColor >> 16) & 0xFF}, ${(tagColor >> 8) & 0xFF}, ${tagColor & 0xFF})`
                        }}
                    />
                    <BaseText tag="h2">Assignments for "{tag.name}"</BaseText>
                </div>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent className={cl("modal-content-large")}>
                {/* Tag Edit Section */}
                <div className={cl("section")}>
                    <FormTitle tag="h3">Tag Details</FormTitle>
                    {isEditing ? (
                        <div className={cl("flex-row")}>
                            <div style={{ flex: 1 }}>
                                <FormText className={cl("text-small-muted")} style={{ marginBottom: "4px" }}>Name</FormText>
                                <TextInput
                                    value={tagName}
                                    onChange={setTagName}
                                    maxLength={20}
                                />
                            </div>
                            <div style={{ width: "80px" }}>
                                <ColorPickerWrapper color={tagColor} onChange={setTagColor} />
                            </div>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.GREEN} onClick={handleSaveEdit}>
                                Save
                            </Button>
                            <Button size={Button.Sizes.SMALL} onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <div className={cl("flex-row")}>
                            <BaseText style={{ flex: 1 }}>
                                Name: <strong>{tag.name}</strong>
                            </BaseText>
                            <Button size={Button.Sizes.SMALL} onClick={() => setIsEditing(true)}>
                                Edit
                            </Button>
                        </div>
                    )}
                </div>

                {/* Assignments Section */}
                <div className={cl("section")}>
                    <FormTitle tag="h3">Assignments ({entityIds.length})</FormTitle>

                    {entityIds.length === 0 ? (
                        <FormText className={cl("empty-state")}>
                            This tag isn't assigned to any channels, members, or servers yet.
                        </FormText>
                    ) : (
                        <div className={cl("assignments-list")}>
                            {/* Text Channels */}
                            {grouped.channel.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Text Channels ({grouped.channel.length})
                                    </FormTitle>
                                    {grouped.channel.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Voice Channels */}
                            {grouped.voice.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Voice Channels ({grouped.voice.length})
                                    </FormTitle>
                                    {grouped.voice.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Threads */}
                            {grouped.thread.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Threads ({grouped.thread.length})
                                    </FormTitle>
                                    {grouped.thread.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Forums */}
                            {grouped.forum.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Forums ({grouped.forum.length})
                                    </FormTitle>
                                    {grouped.forum.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Forum Posts */}
                            {grouped.forumPost.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Forum Posts ({grouped.forumPost.length})
                                    </FormTitle>
                                    {grouped.forumPost.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* DMs */}
                            {grouped.dm.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Direct Messages ({grouped.dm.length})
                                    </FormTitle>
                                    {grouped.dm.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Group DMs */}
                            {grouped.groupDm.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Group DMs ({grouped.groupDm.length})
                                    </FormTitle>
                                    {grouped.groupDm.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Members */}
                            {grouped.member.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Members ({grouped.member.length})
                                    </FormTitle>
                                    {grouped.member.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Guilds */}
                            {grouped.guild.length > 0 && (
                                <div className={cl("assignment-group")}>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Servers ({grouped.guild.length})
                                    </FormTitle>
                                    {grouped.guild.map(entity => (
                                        <AssignmentRow
                                            key={entity.id}
                                            entity={entity}
                                            tagId={tag.id}
                                            onRemove={() => handleRemoveAssignment(entity.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Delete Tag Section */}
                <div className={cl("section")}>
                    <Button
                        color={Button.Colors.RED}
                        onClick={handleDeleteTag}
                    >
                        Delete Tag
                    </Button>
                    <FormText className={cl("text-small-muted", "remove-all")}>
                        This will remove the tag from all {entityIds.length} assignments.
                    </FormText>
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

/**
 * Opens the tag assignments modal lol
 */
export function openTagAssignmentsModal(tag: Tag) {
    openModal(props => (
        <TagAssignmentsModalComponent
            {...props}
            tag={tag}
        />
    ));
}
