/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher, RestAPI } from "@webpack/common";

const NOTES_LIMIT = 256;
const STORAGE_KEY = "UnlimitedNotes";

export default definePlugin({
    name: "UnlimitedNotes",
    description: "Removes the serversided character limits from user notes.",
    authors: [EquicordDevs.bratic, EquicordDevs.omaw],
    requiresRestart: true,

    patches: [
        {
            find: "#{intl::NOTE_PLACEHOLDER}",
            replacement: [
                {
                    match: /(?<=maxLength:)\i\.\i/,
                    replace: "999999",
                },
                {
                    match: /(?<=\.length>=)5(?=&&\i\.preventDefault\(\))/,
                    replace: "999999",
                },
                {
                    match: /\i\.\i\.updateNote\((\i),(\i)\)/,
                    replace: "$self.updateNote($1,$2)",
                }
            ]
        },
        {
            find: "Invalid response from server",
            replacement: [
                {
                    match: /\i\.\i\.dispatch\(\{type:"USER_NOTE_UPDATE",id:(\i),note:(\i)\.note\}\)/,
                    replace: "$self.dispatchLoadedNote($1,$2.note)",
                },
                {
                    match: /\i\.\i\.dispatch\(\{type:"USER_NOTE_UPDATE",id:(\i)\}\)/,
                    replace: "$self.dispatchLoadedNote($1)",
                }
            ]
        }
    ],

    dispatchNoteUpdate(userId: string, note?: string) {
        FluxDispatcher.dispatch(
            note == null
                ? { type: "USER_NOTE_UPDATE", id: userId }
                : { type: "USER_NOTE_UPDATE", id: userId, note }
        );
    },

    dispatchLoadedNote(userId: string, remoteNote?: string) {
        this.dispatchNoteUpdate(userId, remoteNote);

        void DataStore.get<string>(`${STORAGE_KEY}:${userId}`).then(note => {
            if (note != null && note !== remoteNote) {
                this.dispatchNoteUpdate(userId, note);
            }
        });
    },

    async updateNote(userId: string, note: string) {
        const remoteNote = note.slice(0, NOTES_LIMIT);
        const updateStorage = note.length > NOTES_LIMIT
            ? DataStore.set(`${STORAGE_KEY}:${userId}`, note)
            : DataStore.del(`${STORAGE_KEY}:${userId}`);

        await updateStorage;

        await RestAPI.put({
            url: `/users/@me/notes/${userId}`,
            body: { note: remoteNote }
        });

        this.dispatchNoteUpdate(userId, note);
    }
});