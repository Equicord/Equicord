/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";

export function ProfileSetsSettingsAbout() {
    return (
        <>
            <HeadingSecondary>Profile Sets tab</HeadingSecondary>
            <Paragraph>
                User Settings → Profiles → <strong>Profile Sets</strong>.
                {" "}
                Save your current look as a preset, then click a row to load it into the profile editor (preview before you hit Apply).
                Main and per-server presets are separate lists.
            </Paragraph>

            <HeadingSecondary>Equicord themes</HeadingSecondary>
            <Paragraph>
                <strong>⋮</strong>
                {" "}
                on a preset → assign a local or online theme.
                {" "}
                <strong>Pinned themes</strong>
                {" "}
                (button above the list) stay enabled no matter which preset you pick.
                Clicking a preset adds its bound theme on top; your last clicked preset is remembered across reloads.
            </Paragraph>

            <Paragraph>
                Theme bindings and UI rework: Jahbas.
            </Paragraph>
        </>
    );
}
