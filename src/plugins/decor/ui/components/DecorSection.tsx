/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { SKU_ID } from "@plugins/decor/lib/constants";
import { useAuthorizationStore } from "@plugins/decor/lib/stores/AuthorizationStore";
import { useCurrentUserDecorationsStore } from "@plugins/decor/lib/stores/CurrentUserDecorationsStore";
import { useUsersDecorationsStore } from "@plugins/decor/lib/stores/UsersDecorationsStore";
import { cl } from "@plugins/decor/ui";
import { openChangeDecorationModal } from "@plugins/decor/ui/modals/ChangeDecorationModal";
import { classes } from "@utils/misc";
import { findByCodeLazy, findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { Avatar, NewCustomizationSection, useEffect, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

const CustomizationSection = findComponentByCodeLazy(".DESCRIPTION", "hasBackground:");
const EditTile = findComponentByCodeLazy(".tileButton,", "affordance:");
const useAvatarWithDecoration = findByCodeLazy("avatarOverride:", "avatarDecorationOverride:", "avatarPlaceholderSrc:");
const TilePreviewClasses = findCssClassesLazy("emptyPreview", "fadeInAvatarImg");

const AvatarWithDecoration = Avatar as ComponentType<any>;

export interface DecorSectionProps {
    hideTitle?: boolean;
    hideDivider?: boolean;
    noMargin?: boolean;
    useNewSection?: boolean;
    disabled?: boolean;
}

function DecorTilePreview({ asset, isInteracting }: { asset: string | null | undefined; isInteracting: boolean; }) {
    const { avatarDecorationSrc, avatarSrc, avatarPlaceholderSrc } = useAvatarWithDecoration({
        userId: UserStore.getCurrentUser().id,
        size: "SIZE_72",
        showPending: true,
        avatarDecorationOverride: asset ? { asset, skuId: SKU_ID } : null,
        animateOnHover: !isInteracting
    });

    const showAvatar = avatarDecorationSrc != null && isInteracting;

    return (
        <AvatarWithDecoration
            className={classes(avatarDecorationSrc == null && TilePreviewClasses.emptyPreview)}
            src={showAvatar ? avatarSrc : avatarPlaceholderSrc}
            imageClassName={showAvatar ? TilePreviewClasses.fadeInAvatarImg : undefined}
            avatarDecoration={avatarDecorationSrc}
            size="SIZE_72"
            aria-hidden
        />
    );
}

function DecorTile({ disabled, onClick, onRemove }: { disabled?: boolean; onClick(): void; onRemove?(): void; }) {
    const asset = useUsersDecorationsStore(state => state.getAsset(UserStore.getCurrentUser().id));

    return (
        <EditTile
            variant="square"
            affordance={onRemove
                ? { type: "remove", onClick: onRemove, accessibleLabel: "Remove Decor decoration" }
                : asset ? undefined : "add"
            }
            onClick={onClick}
            accessibleLabel="Decor"
            accessibleValue={asset ? "Decor decoration" : "None"}
            aria-haspopup="dialog"
            disabled={disabled}
            renderPreview={(isInteracting: boolean) => <DecorTilePreview asset={asset} isInteracting={isInteracting} />}
        />
    );
}

export default function DecorSection({ hideTitle = false, hideDivider = false, noMargin = false, useNewSection = false, disabled = false }: DecorSectionProps) {
    const authorization = useAuthorizationStore();
    const { selectedDecoration, select: selectDecoration, fetch: fetchDecorations } = useCurrentUserDecorationsStore();

    useEffect(() => {
        if (authorization.isAuthorized()) fetchDecorations();
    }, [authorization.token]);

    const openModal = () => {
        if (!authorization.isAuthorized()) {
            authorization.authorize().then(openChangeDecorationModal).catch(() => { });
        } else {
            openChangeDecorationModal();
        }
    };

    const canRemove = selectedDecoration != null && authorization.isAuthorized();

    if (useNewSection) {
        if (!NewCustomizationSection) return null;

        return (
            <NewCustomizationSection heading={hideTitle ? undefined : "Decor"} disabled={disabled}>
                <DecorTile
                    disabled={disabled}
                    onClick={openModal}
                    onRemove={canRemove ? () => selectDecoration(null) : undefined}
                />
            </NewCustomizationSection>
        );
    }

    return (
        <CustomizationSection
            title={hideTitle ? undefined : "Decor"}
            hasBackground
            hideDivider={hideDivider}
            className={noMargin ? cl("section-remove-margin") : undefined}
        >
            <Flex gap="4px">
                <Button onClick={openModal} variant="primary" size="small">
                    Change Decoration
                </Button>
                {canRemove && (
                    <Button
                        onClick={() => selectDecoration(null)}
                        variant="secondary"
                        size="small"
                    >
                        Remove Decoration
                    </Button>
                )}
            </Flex>
        </CustomizationSection>
    );
}
