/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openModal } from "@utils/modal";

import { CommandPaletteModal } from "./ui/CommandPaletteModal";

export function openCommandPalette() {
    openModal(modalProps => <CommandPaletteModal modalProps={modalProps} />);
}
