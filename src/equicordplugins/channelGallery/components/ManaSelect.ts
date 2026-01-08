/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findComponentByCodeLazy } from "@webpack";
import type React from "react";

import type { ManaSelectProps } from "../types/select";

export const ManaSelect: React.ComponentType<ManaSelectProps> = findComponentByCodeLazy('"data-mana-component":"select"');
