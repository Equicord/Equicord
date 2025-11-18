/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { Button, Forms } from "@webpack/common";

import { cl } from "..";
import { resolveEntityName } from "../utils/entityResolver";
import { getEntitiesWithTag, getUserTagData, type Tag } from "../utils/tagData";

const { FormTitle, FormText } = Forms;

interface TagDeleteConfirmationModalProps {
    tag: Tag;
    onConfirm: () => void;
}

function TagDeleteConfirmationModalComponent({ tag, onConfirm, ...modalProps }: TagDeleteConfirmationModalProps & ModalProps) {
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
        member: resolvedEntities.filter(e => e.type === "member"),
        guild: resolvedEntities.filter(e => e.type === "guild")
    };

    function handleConfirmDelete() {
        onConfirm();
        modalProps.onClose();
    }

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <div style={{ flexGrow: 1 }}>
                    <FormTitle tag="h2">Delete Tag?</FormTitle>
                </div>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent className={cl("modal-content")}>
                <div className={cl("flex-row")}>
                    <div
                        className={cl("tag-color-preview")}
                        style={{
                            backgroundColor: `rgb(${(tag.color >> 16) & 0xFF}, ${(tag.color >> 8) & 0xFF}, ${tag.color & 0xFF})`
                        }}
                    />
                    <BaseText className={cl("text-bold")}>
                        Are you sure you want to delete "{tag.name}"?
                    </BaseText>
                </div>

                {entityIds.length > 0 && (
                    <>
                        <FormText className={cl("text-muted")}>
                            This tag will be removed from the following {entityIds.length} {entityIds.length === 1 ? "entity" : "entities"}:
                        </FormText>

                        <div style={{
                            maxHeight: "300px",
                            overflowY: "auto",
                            padding: "8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--background-secondary)"
                        }} className={cl("flex-col-large")}>
                            {/* Text Channels */}
                            {grouped.channel.length > 0 && (
                                <div>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Text Channels ({grouped.channel.length})
                                    </FormTitle>
                                    <ul style={{ margin: "0", paddingLeft: "20px" }}>
                                        {grouped.channel.map(entity => (
                                            <li key={entity.id}>
                                                <BaseText className={entity.isDeleted ? cl("text-muted") : ""}>
                                                    {entity.name}
                                                </BaseText>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Voice Channels */}
                            {grouped.voice.length > 0 && (
                                <div>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Voice Channels ({grouped.voice.length})
                                    </FormTitle>
                                    <ul style={{ margin: "0", paddingLeft: "20px" }}>
                                        {grouped.voice.map(entity => (
                                            <li key={entity.id}>
                                                <BaseText className={entity.isDeleted ? cl("text-muted") : ""}>
                                                    {entity.name}
                                                </BaseText>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Members */}
                            {grouped.member.length > 0 && (
                                <div>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Members ({grouped.member.length})
                                    </FormTitle>
                                    <ul style={{ margin: "0", paddingLeft: "20px" }}>
                                        {grouped.member.map(entity => (
                                            <li key={entity.id}>
                                                <BaseText className={entity.isDeleted ? cl("text-muted") : ""}>
                                                    {entity.name}
                                                </BaseText>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Servers */}
                            {grouped.guild.length > 0 && (
                                <div>
                                    <FormTitle tag="h5" className={cl("entity-header")}>
                                        Servers ({grouped.guild.length})
                                    </FormTitle>
                                    <ul style={{ margin: "0", paddingLeft: "20px" }}>
                                        {grouped.guild.map(entity => (
                                            <li key={entity.id}>
                                                <BaseText className={entity.isDeleted ? cl("text-muted") : ""}>
                                                    {entity.name}
                                                </BaseText>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </ModalContent>

            <ModalFooter>
                <Button
                    color={Button.Colors.RED}
                    onClick={handleConfirmDelete}
                >
                    Delete Tag
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

/**
 * Opens the tag delete confirmation modal
 */
export function openTagDeleteConfirmationModal(tag: Tag, onConfirm: () => void) {
    openModal(props => (
        <TagDeleteConfirmationModalComponent
            {...props}
            tag={tag}
            onConfirm={onConfirm}
        />
    ));
}
