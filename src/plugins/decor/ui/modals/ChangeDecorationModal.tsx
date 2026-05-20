/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button, Button as NewButton } from "@components/Button";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { Decoration, getPresets, Preset } from "@plugins/decor/lib/api";
import { GUILD_ID, INVITE_KEY } from "@plugins/decor/lib/constants";
import { useAuthorizationStore } from "@plugins/decor/lib/stores/AuthorizationStore";
import { useCurrentUserDecorationsStore } from "@plugins/decor/lib/stores/CurrentUserDecorationsStore";
import { decorationToAvatarDecoration } from "@plugins/decor/lib/utils/decoration";
import { settings } from "@plugins/decor/settings";
import { cl, DecorationModalClasses, requireAvatarDecorationModal } from "@plugins/decor/ui";
import { AvatarDecorationModalPreview } from "@plugins/decor/ui/components";
import DecorationGridCreate from "@plugins/decor/ui/components/DecorationGridCreate";
import DecorationGridNone from "@plugins/decor/ui/components/DecorationGridNone";
import DecorDecorationGridDecoration from "@plugins/decor/ui/components/DecorDecorationGridDecoration";
import SectionedGridList from "@plugins/decor/ui/components/SectionedGridList";
import { copyWithToast, openInviteModal } from "@utils/discord";
import { Margins } from "@utils/margins";
import { Queue } from "@utils/Queue";
import { t } from "@utils/translation";
import { RenderModalProps, User } from "@vencord/discord-types";
import { closeAllModals, ConfirmModal, FluxDispatcher, Forms, GuildStore, Modal, NavigationRouter, openModal, Parser, Tooltip, useEffect, UserStore, UserSummaryItem, UserUtils, useState } from "@webpack/common";

import { openCreateDecorationModal } from "./CreateDecorationModal";
import { openGuidelinesModal } from "./GuidelinesModal";

function usePresets() {
    const [presets, setPresets] = useState<Preset[]>([]);
    useEffect(() => { getPresets().then(setPresets); }, []);
    return presets;
}

interface Section {
    title: string;
    subtitle?: string;
    sectionKey: string;
    items: ("none" | "create" | Decoration)[];
    authorIds?: string[];
}

interface SectionHeaderProps {
    section: Section;
}

const fetchAuthorsQueue = new Queue();

function SectionHeader({ section }: SectionHeaderProps) {
    const hasSubtitle = typeof section.subtitle !== "undefined";
    const hasAuthorIds = typeof section.authorIds !== "undefined";

    const [authors, setAuthors] = useState<User[]>([]);

    useEffect(() => {
        fetchAuthorsQueue.push(async () => {
            if (!section.authorIds) return;

            for (const authorId of section.authorIds) {
                const author = UserStore.getUser(authorId) ?? await UserUtils.getUser(authorId).catch(() => null);
                if (author == null) continue;

                setAuthors(authors => [...authors, author]);
            }
        });
    }, [section.authorIds]);

    return <div>
        <Flex>
            <Forms.FormTitle style={{ flexGrow: 1 }}>{section.title}</Forms.FormTitle>
            {hasAuthorIds && <UserSummaryItem
                users={authors}
                guildId={undefined}
                renderIcon={false}
                max={5}
                showDefaultAvatarsForNullUsers
                size={16}
                showUserPopout
                className={Margins.bottom8}
            />}
        </Flex>
        {hasSubtitle &&
            <Paragraph className={Margins.bottom8}>
                {section.subtitle}
            </Paragraph>
        }
    </div>;
}

function ChangeDecorationModal(props: RenderModalProps) {
    // undefined = not trying, null = none, Decoration = selected
    const [tryingDecoration, setTryingDecoration] = useState<Decoration | null | undefined>(undefined);
    const isTryingDecoration = typeof tryingDecoration !== "undefined";

    const avatarDecoration = tryingDecoration != null ? decorationToAvatarDecoration(tryingDecoration) : tryingDecoration;

    const {
        decorations,
        selectedDecoration,
        fetch: fetchUserDecorations,
        select: selectDecoration
    } = useCurrentUserDecorationsStore();

    useEffect(() => {
        fetchUserDecorations();
    }, []);

    const activeSelectedDecoration = isTryingDecoration ? tryingDecoration : selectedDecoration;
    const activeDecorationHasAuthor = typeof activeSelectedDecoration?.authorId !== "undefined";
    const hasDecorationPendingReview = decorations.some(d => d.reviewed === false);

    const presets = usePresets();
    const presetDecorations = presets.flatMap(preset => preset.decorations);

    const activeDecorationPreset = presets.find(preset => preset.id === activeSelectedDecoration?.presetId);
    const isActiveDecorationPreset = typeof activeDecorationPreset !== "undefined";

    const ownDecorations = decorations.filter(d => !presetDecorations.some(p => p.hash === d.hash));

    const data = [
        {
            title: t("vencord.decor.yourDecorations"),
            subtitle: t("vencord.decor.deleteInstructions"),
            sectionKey: "ownDecorations",
            items: ["none", ...ownDecorations, "create"]
        },
        ...presets.map(preset => ({
            title: preset.name,
            subtitle: preset.description || undefined,
            sectionKey: `preset-${preset.id}`,
            items: preset.decorations,
            authorIds: preset.authorIds
        }))
    ] as Section[];

    return <Modal
        {...props}
        title={t("vencord.decor.changeDecoration")}
        size="lg"
        actions={[
            {
                text: t("vencord.cancel"),
                variant: "secondary",
                onClick: props.onClose
            },
            {
                text: t("vencord.decor.apply"),
                variant: "primary",
                onClick: () => {
                    selectDecoration(tryingDecoration!).then(props.onClose);
                },
                disabled: !isTryingDecoration
            }
        ]}
        preview={
            <div className={cl("modal-footer-btn-container", Margins.top8)}>
                <Tooltip text={t("vencord.decor.discordTooltip")}>
                    {tooltipProps => <NewButton
                        {...tooltipProps}
                        onClick={async () => {
                            if (!GuildStore.getGuild(GUILD_ID)) {
                                const inviteAccepted = await openInviteModal(INVITE_KEY);
                                if (inviteAccepted) {
                                    closeAllModals();
                                    FluxDispatcher.dispatch({ type: "LAYER_POP_ALL" });
                                }
                            } else {
                                props.onClose();
                                FluxDispatcher.dispatch({ type: "LAYER_POP_ALL" });
                                NavigationRouter.transitionToGuild(GUILD_ID);
                            }
                        }}
                        variant="link"
                    >
                        {t("vencord.decor.discordServer")}
                    </NewButton>}
                </Tooltip>
                <NewButton
                    onClick={() => openModal(modalProps => (
                        <ConfirmModal
                            {...modalProps}
                            title={t("vencord.decor.logOut")}
                            subtitle={t("vencord.decor.confirmLogOut")}
                            confirmText={t("vencord.decor.logOut")}
                            cancelText={t("vencord.cancel")}
                            onConfirm={() => {
                                useAuthorizationStore.getState().remove(UserStore.getCurrentUser().id);
                                props.onClose();
                            }}
                        />
                    ))}
                    variant="dangerSecondary"
                >
                    {t("vencord.decor.logOut")}
                </NewButton>
            </div>
        }
    >
        <div className={cl("change-decoration-modal-content", DecorationModalClasses.modal)}>
            <SectionedGridList
                renderItem={item => {
                    if (typeof item === "string") {
                        switch (item) {
                            case "none":
                                return <DecorationGridNone
                                    className={cl("change-decoration-modal-decoration")}
                                    isSelected={activeSelectedDecoration === null}
                                    onSelect={() => setTryingDecoration(null)}
                                />;
                            case "create":
                                return <Tooltip text={t("vencord.decor.alreadyPending")} shouldShow={hasDecorationPendingReview}>
                                    {tooltipProps => <DecorationGridCreate
                                        className={cl("change-decoration-modal-decoration")}
                                        {...tooltipProps}
                                        onSelect={!hasDecorationPendingReview ? (settings.store.agreedToGuidelines ? openCreateDecorationModal : openGuidelinesModal) : () => { }}
                                    />}
                                </Tooltip>;
                        }
                    } else {
                        return <Tooltip text={t("vencord.decor.pendingReview")} shouldShow={item.reviewed === false}>
                            {tooltipProps => (
                                <DecorDecorationGridDecoration
                                    {...tooltipProps}
                                    className={cl("change-decoration-modal-decoration")}
                                    onSelect={item.reviewed !== false ? () => setTryingDecoration(item) : () => { }}
                                    isSelected={activeSelectedDecoration?.hash === item.hash}
                                    decoration={item}
                                />
                            )}
                        </Tooltip>;
                    }
                }}
                getItemKey={item => typeof item === "string" ? item : item.hash}
                getSectionKey={section => section.sectionKey}
                renderSectionHeader={section => <SectionHeader section={section} />}
                sections={data}
            />

            <div className={cl("change-decoration-modal-preview")}>
                <AvatarDecorationModalPreview
                    avatarDecoration={avatarDecoration}
                    user={UserStore.getCurrentUser()}
                />
                {isActiveDecorationPreset && <Forms.FormTitle className="">{t("vencord.decor.presetPart", { name: activeDecorationPreset.name })}</Forms.FormTitle>}
                {typeof activeSelectedDecoration === "object" &&
                    <BaseText
                        size="sm"
                        weight="semibold"
                        style={{ color: "var(--text-strong)" }}
                    >
                        {activeSelectedDecoration?.alt}
                    </BaseText>
                }
                {activeDecorationHasAuthor && (
                    <BaseText key={`createdBy-${activeSelectedDecoration.authorId}`}>
                        {t("vencord.decor.createdBy")} {Parser.parse(`<@${activeSelectedDecoration.authorId}>`)}
                    </BaseText>
                )}
                {isActiveDecorationPreset && (
                    <Button onClick={() => copyWithToast(activeDecorationPreset.id)}>
                        {t("vencord.decor.copyPresetId")}
                    </Button>
                )}
            </div>

        </div>
    </Modal>;
}

export const openChangeDecorationModal = () =>
    requireAvatarDecorationModal().then(() => openModal(props => <ChangeDecorationModal {...props} />));
