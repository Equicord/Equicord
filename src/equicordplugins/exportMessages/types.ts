/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserJSON } from "@vencord/discord-types";

export interface ContactsList {
    id: string;
    type: number;
    nickname?: any;
    user: UserJSON;
    since: string;
}
