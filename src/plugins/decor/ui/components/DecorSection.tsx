/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { useAuthorizationStore } from "@plugins/decor/lib/stores/AuthorizationStore";
import { useCurrentUserDecorationsStore } from "@plugins/decor/lib/stores/CurrentUserDecorationsStore";
import { cl } from "@plugins/decor/ui";
import { openChangeDecorationModal } from "@plugins/decor/ui/modals/ChangeDecorationModal";
import { findComponentByCodeLazy } from "@webpack";
import { NewCustomizationSection, useEffect } from "@webpack/common";

const CustomizationSection = findComponentByCodeLazy(".DESCRIPTION", "hasBackground:");

export interface DecorSectionProps {
    hideTitle?: boolean;
    hideDivider?: boolean;
    noMargin?: boolean;
    useNewSection?: boolean;
}

export default function DecorSection({ hideTitle = false, hideDivider = false, noMargin = false, useNewSection = false }: DecorSectionProps) {
    const authorization = useAuthorizationStore();
    const { selectedDecoration, select: selectDecoration, fetch: fetchDecorations } = useCurrentUserDecorationsStore();

    useEffect(() => {
        if (authorization.isAuthorized()) fetchDecorations();
    }, [authorization.token]);

    const NewSection = useNewSection ? NewCustomizationSection : undefined;

    if (useNewSection && !NewSection) return null;

    const Section = (useNewSection ? NewCustomizationSection : CustomizationSection);
    const sectionProps = useNewSection
        ? { heading: hideTitle ? undefined : "Decor" }
        : {
            title: hideTitle ? undefined : "Decor",
            hasBackground: true,
            hideDivider,
            className: noMargin ? cl("section-remove-margin") : undefined
        };

    const changeLabel = useNewSection ? "Change" : "Change Decoration";
    const removeLabel = useNewSection ? "Remove" : "Remove Decoration";

    return (
        <Section {...sectionProps}>
            <Flex gap="4px">
                <Button
                    onClick={() => {
                        if (!authorization.isAuthorized()) {
                            authorization.authorize().then(openChangeDecorationModal).catch(() => { });
                        } else {
                            openChangeDecorationModal();
                        }
                    }}
                    variant="primary"
                    size="small"
                >
                    {changeLabel}
                </Button>
                {selectedDecoration && authorization.isAuthorized() && (
                    <Button
                        onClick={() => selectDecoration(null)}
                        variant="secondary"
                        size="small"
                    >
                        {removeLabel}
                    </Button>
                )}
            </Flex>
        </Section>
    );
}
