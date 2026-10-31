/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { EyeSlashIcon } from "@components/Icons";
import { ServerListItem } from "@components/ServerListItem";
import { HiddenServersStore } from "@equicordplugins/hideServers/HiddenServersStore";
import { classNameFactory } from "@utils/css";
import { GuildStore, useStateFromStores } from "@webpack/common";

import { openHiddenServersModal } from "./HiddenServersMenu";

const cl = classNameFactory("vc-hideservers-");

function HiddenServersButton() {
    const hiddenGuilds = useStateFromStores([HiddenServersStore], () => HiddenServersStore.hiddenGuilds, undefined, (old, newer) => old.size === newer.size);
    // if youve left a server dont show it in the count
    const actuallyHidden = Array.from(hiddenGuilds).filter(x => GuildStore.getGuild(x)).length;

    return actuallyHidden > 0 ? (
        <ServerListItem
            id={cl("container")}
            icon={EyeSlashIcon}
            tooltip="Hidden Servers"
            badge={{
                count: actuallyHidden
            }}
            onClick={() => openHiddenServersModal()}
        />
    ) : (null);
}

export default () => { return <HiddenServersButton />; };
