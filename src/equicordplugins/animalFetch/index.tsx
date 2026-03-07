/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import { animalFetchCommands } from "./commands";

export default definePlugin({
    name: "AnimalFetch",
    description: "Fetch random animal images using /cat, /dog, and /fox commands",
    authors: [EquicordDevs.playfairs, Devs.playfairs],
    commands: animalFetchCommands
});
