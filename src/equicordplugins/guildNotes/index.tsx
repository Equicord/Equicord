/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Menu } from "@webpack/common";

import { openEditServerNoteModal } from "./modals";

type UserNote = {
    serverId: string;
    note: string;
};

function createMenuItem(guildId: string) {
    return (
        <Menu.MenuItem
            id="vc-view-server-note"
            label="View Server Note"
            action={async () => {
                const notes = (await DataStore.get<UserNote[]>("GuildNotes")) ?? [];

                const existing = notes.find(
                    n => n.serverId === guildId
                );

                const currentNote = existing?.note ?? "";

                openEditServerNoteModal(
                    currentNote,
                    async newNote => {
                        if (newNote === currentNote) return;

                        if (newNote === "" && existing) {
                            notes.splice(notes.indexOf(existing), 1);
                            await DataStore.set("GuildNotes", notes);
                            return;
                        }

                        if (existing) {
                            existing.note = newNote;
                        } else {
                            notes.push({
                                serverId: guildId,
                                note: newNote
                            });
                        }
                        await DataStore.set("GuildNotes", notes);
                    }
                );
            }}
        />
    );
}

const GuildContext: NavContextMenuPatchCallback = (children, props) => {
    const group = findGroupChildrenByChildId("privacy", children);

    if (group) {
        group.push(
            createMenuItem(props.guild.id)
        );
    }
};
export const contextMenus = {
    "guild-context": GuildContext
};

export default definePlugin({
    name: "Server Notes",
    description:
        "Allows you to add server notes",
    authors: [EquicordDevs.BastiGame],
    contextMenus,
});
