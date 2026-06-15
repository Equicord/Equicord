/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByCodeLazy } from "@webpack";
import { React } from "@webpack/common";

export const PROFILE_SETS_SECTION = "profile_sets";

export type ProfileSubsectionState = {
    subsection: string;
    scrollPosition: unknown;
};

export const ProfileSubsectionStore = findByCodeLazy(
    "scrollPosition:null",
    "subsection:"
) as {
    getState: () => ProfileSubsectionState;
    subscribe: (listener: () => void) => () => void;
};

export function useProfileSubsection() {
    return React.useSyncExternalStore(
        listener => ProfileSubsectionStore.subscribe(listener),
        () => ProfileSubsectionStore.getState().subsection,
        () => ProfileSubsectionStore.getState().subsection
    );
}
