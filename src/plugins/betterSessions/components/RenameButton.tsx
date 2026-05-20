/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { SessionInfo } from "@plugins/betterSessions/types";
import { t } from "@utils/translation";
import { openModal } from "@webpack/common";

import { RenameModal } from "./RenameModal";

export function RenameButton({ session, state }: { session: SessionInfo["session"], state: [string, React.Dispatch<React.SetStateAction<string>>]; }) {
    return (
        <Button
            variant="secondary"
            size="xs"
            className="vc-betterSessions-rename-btn"
            onClick={() =>
                openModal(props => (
                    <RenameModal
                        props={props}
                        session={session}
                        state={state}
                    />
                ))
            }
        >
            {t("vencord.betterSessions.rename")}
        </Button>
    );
}

export function NewButton() {
    return (
        <Button
            variant="dangerPrimary"
            size="min"
            className="vc-betterSessions-new-btn"
        >
            {t("vencord.betterSessions.newBadge")}
        </Button>
    );
}
