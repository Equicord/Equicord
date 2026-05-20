/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { settings } from "@plugins/decor/settings";
import { DecorationModalClasses, requireAvatarDecorationModal } from "@plugins/decor/ui";
import { t } from "@utils/translation";
import { RenderModalProps } from "@vencord/discord-types";
import { ConfirmModal, openModal } from "@webpack/common";

import { openCreateDecorationModal } from "./CreateDecorationModal";

function GuidelinesModal(props: RenderModalProps) {
    return (
        <ConfirmModal
            {...props}
            title={t("vencord.decor.holdOn")}
            confirmText={t("vencord.decor.continue")}
            variant="primary"
            onConfirm={() => {
                settings.store.agreedToGuidelines = true;
                props.onClose();
                openCreateDecorationModal();
            }}
        >
            <div className={DecorationModalClasses.modal}>
                <Paragraph>
                    {t("vencord.decor.guidelinesAgreementNotice", {
                        guidelines: <Link
                            href="https://github.com/decor-discord/.github/blob/main/GUIDELINES.md"
                        >
                            {t("vencord.decor.theGuidelines")}
                        </Link>
                    })}
                </Paragraph>
            </div>
        </ConfirmModal>
    );
}

export const openGuidelinesModal = () =>
    requireAvatarDecorationModal().then(() => openModal(props => <GuidelinesModal {...props} />));
