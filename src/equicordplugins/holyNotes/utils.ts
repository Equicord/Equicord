/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createStore } from "@api/DataStore";
import { DataStore } from "@api/index";
import { Toasts } from "@webpack/common";

import { noteHandler, noteHandlerCache } from "./NoteHandler";
import { Notebook } from "./types";

export const HolyNoteStore = createStore("HolyNoteData", "HolyNoteStore");

export function saveCacheToDataStore(key: string, value: Notebook) {
    DataStore.set(key, value, HolyNoteStore);
}

export function deleteCacheFromDataStore(key: string) {
    DataStore.del(key, HolyNoteStore);
}

export async function DataStoreToCache() {
    const entries = await DataStore.entries(HolyNoteStore);
    for (const [key, value] of entries) {
        noteHandlerCache.set(String(key), value as Notebook);
    }
}

export async function DeleteEntireStore() {
    await DataStore.clear(HolyNoteStore);
    noteHandler.newNoteBook("Main", true);
}

export async function downloadNotes() {
    const filename = "notes.json";
    const data = JSON.stringify(noteHandler.exportNotes(), null, 2);

    if (IS_VESKTOP || IS_EQUIBOP || IS_WEB) {
        const file = new File([data], filename, { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(a.href);
            document.body.removeChild(a);
        }, 0);
    } else {
        DiscordNative.fileManager.saveWithDialog(data, filename);
    }
}

export async function uploadNotes() {
    if (IS_VESKTOP || IS_EQUIBOP || IS_WEB) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        input.style.display = "none";
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    noteHandler.importNotes(reader.result as string);
                } catch {
                    Toasts.show({
                        id: Toasts.genId(),
                        message: "Failed to import notes",
                        type: Toasts.Type.FAILURE,
                    });
                }
            };
            reader.readAsText(file);
        };
        document.body.appendChild(input);
        input.click();
        setTimeout(() => document.body.removeChild(input), 0);
    } else {
        const [file] = await DiscordNative.fileManager.openFiles({
            filters: [{ name: "notes", extensions: ["json"] }]
        });
        if (file) {
            noteHandler.importNotes(new TextDecoder().decode(file.data));
        }
    }
}
