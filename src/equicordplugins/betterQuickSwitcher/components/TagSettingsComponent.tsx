/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { useForceUpdater } from "@utils/react";
import { Button, Forms, showToast, Toasts } from "@webpack/common";

import { cl } from "..";
import { deleteTag, getAllTags, getEntitiesWithTag, type Tag } from "../utils/tagData";
import { openTagAssignmentsModal } from "./TagAssignmentsModal";
import { openTagDeleteConfirmationModal } from "./TagDeleteConfirmationModal";

const { FormTitle, FormText } = Forms;

interface TagCardProps {
    tag: Tag;
    onUpdate: () => void;
}

function TagCard({ tag, onUpdate }: TagCardProps) {
    const assignmentCount = getEntitiesWithTag(tag.id).length;

    function handleDelete() {
        openTagDeleteConfirmationModal(tag, () => {
            const success = deleteTag(tag.id);
            if (success) {
                showToast(`Deleted tag "${tag.name}"`, Toasts.Type.SUCCESS);
                onUpdate();
            }
        });
    }

    return (
        <div className={cl("tag-card")}>
            <div
                className={cl("tag-color-preview")}
                style={{
                    backgroundColor: `rgb(${(tag.color >> 16) & 0xFF}, ${(tag.color >> 8) & 0xFF}, ${tag.color & 0xFF})`
                }}
            />
            <div className={cl("tag-card-info")}>
                <BaseText className={cl("text-bold")}>{tag.name}</BaseText>
                <FormText className={cl("text-small-muted")}>
                    {assignmentCount} {assignmentCount === 1 ? "assignment" : "assignments"}
                </FormText>
            </div>
            <div className={cl("tag-card-actions")}>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.PRIMARY}
                    onClick={() => openTagAssignmentsModal(tag)}
                >
                    View
                </Button>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    onClick={handleDelete}
                >
                    Delete
                </Button>
            </div>
        </div>
    );
}

export function TagSettingsComponent() {
    const update = useForceUpdater();
    const allTags = getAllTags();

    return (
        <div>
            <FormTitle tag="h3">Tag Management</FormTitle>
            <FormText>
                Manage all your tags and view their assignments across channels, voice channels, members, and servers.
            </FormText>

            {allTags.length === 0 ? (
                <FormText className={cl("empty-state")}>
                    No tags created yet. Right-click a channel, voice channel, or member to create and assign tags!
                </FormText>
            ) : (
                <div className={cl("tag-cards-list")}>
                    {allTags.map(tag => (
                        <TagCard
                            key={tag.id}
                            tag={tag}
                            onUpdate={update}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
