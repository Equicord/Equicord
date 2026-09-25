/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { makeLazy } from "@utils/lazy";
import { Channel, Guild } from "@vencord/discord-types";
import { React } from "@webpack/common";
import type { ReactNode } from "react";

import { GuildChannelIcon } from "./discord";

const cl = classNameFactory("vc-favourites-");

export const getFavouriteRowContext = makeLazy(() => React.createContext(false));

export function useChannelIcon(channel: Channel, guild: Guild | null, locked: boolean, hasActiveThreads: boolean, icon: ReactNode) {
    const inFavouriteRow = React.useContext(getFavouriteRowContext());
    if (!inFavouriteRow || guild == null) return icon;

    return <GuildChannelIcon className={cl("guild-icon")} channel={channel} guild={guild} size="SMALL_32" locked={locked} hasActiveThreads={hasActiveThreads} />;
}
