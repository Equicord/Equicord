/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";

export function ProfileSetsSettingsAbout() {
    return (
        <Paragraph>
            <strong>Profile Sets</strong>
            {" "}
            is under User Settings → Profiles. Save a preset, click a row to preview it in the editor.
            {" "}
            <strong>⋮</strong>
            {" "}
            binds an Equicord theme; pinned themes (top right) stay on either way.
        </Paragraph>
    );
}
