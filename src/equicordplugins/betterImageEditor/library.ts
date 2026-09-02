/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { nanoid } from "nanoid";

const store = DataStore.createStore("BetterImageEditor", "library");

export type Kind = string;
export type Group = "original" | "cropped";

export interface CropState {
    zoomRatio: number;
    imageRotation: number;
    offsetRatio: { x: number; y: number; };
}

export interface Entry {
    id: string;
    name: string;
    type?: string;
    kind: Kind;
    group: Group;
    sig: string;
    added: number;
    crop?: CropState;
    pinned?: boolean;
    used?: number;
    from?: string;
}

const INDEX = "index";
const fileKey = (id: string) => `file:${id}`;
const thumbKey = (id: string) => `thumb:${id}`;

const THUMB_MAX = 160;

export const readIndex = () => DataStore.get<Entry[]>(INDEX, store).then(entries => entries ?? []);
const writeIndex = (entries: Entry[]) => DataStore.set(INDEX, entries, store);

let turn: Promise<unknown> = Promise.resolve();

function queued<T>(work: () => Promise<T>) {
    const result = turn.then(work);
    turn = result.catch(() => { });
    return result;
}

export const getFile = (id: string) => DataStore.get<Blob>(fileKey(id), store);
export const getThumb = (id: string) => DataStore.get<Blob>(thumbKey(id), store);
export const getThumbs = (ids: string[]) => DataStore.getMany<Blob>(ids.map(thumbKey), store);
export const clear = () => queued(() => DataStore.clear(store));

export const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

const fromDataUrl = (url: string) => fetch(url).then(r => r.blob());
const isDataUrl = (value: unknown) => typeof value === "string" && value.startsWith("data:");

async function signature(file: Blob) {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return `${file.size}:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function trim(entries: Entry[], limit: number) {
    const counts = new Map<string, number>();
    const kept: Entry[] = [];
    const dropped: Entry[] = [];

    for (const entry of byRecency(entries)) {
        if (entry.pinned) {
            kept.push(entry);
            continue;
        }

        const shelf = `${entry.kind}:${entry.group}`;
        const nth = (counts.get(shelf) ?? 0) + 1;
        counts.set(shelf, nth);
        (nth <= limit ? kept : dropped).push(entry);
    }

    return { kept, dropped };
}

function thumbnail(source: Blob) {
    return new Promise<Blob>((resolve, reject) => {
        const url = URL.createObjectURL(source);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);

            const scale = Math.min(1, THUMB_MAX / Math.max(image.width, image.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            const context = canvas.getContext("2d");
            if (!context) return reject(new Error("could not draw a thumbnail"));

            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("could not draw a thumbnail")), "image/webp", 0.8);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("could not decode that image"));
        };

        image.src = url;
    });
}

export function add(file: File, kind: Kind, group: Group, limit: number, from?: string) {
    return queued(async () => {
        const sig = await signature(file);
        const stored = await readIndex();
        const sameShelf = (entry: Entry) => entry.kind === kind && entry.group === group;

        const known = stored.find(entry => sameShelf(entry) && entry.sig === sig);
        if (known) return known;

        const replaced = from ? stored.filter(entry => sameShelf(entry) && entry.from === from && !entry.pinned) : [];
        const id = nanoid();
        const thumb = await thumbnail(file);
        await DataStore.setMany([[fileKey(id), file], [thumbKey(id), thumb]], store);

        const entry: Entry = { id, name: file.name, type: file.type, kind, group, sig, added: Date.now(), from };
        const { kept, dropped } = trim([entry, ...stored.filter(other => !replaced.includes(other))], limit);

        await writeIndex(kept);
        await forgetBlobs([...dropped, ...replaced].map(other => other.id));

        return entry;
    });
}

const forgetBlobs = (ids: string[]) => DataStore.delMany(ids.flatMap(id => [fileKey(id), thumbKey(id)]), store);

export function forget(id: string) {
    return queued(async () => {
        await writeIndex((await readIndex()).filter(entry => entry.id !== id));
        await forgetBlobs([id]);
    });
}

export async function exportAll() {
    const pictures: Array<Entry & { file: string; thumb: string; }> = [];

    for (const entry of await readIndex()) {
        const [file, thumb] = await Promise.all([getFile(entry.id), getThumb(entry.id)]);
        if (!file || !thumb) continue;

        pictures.push({ ...entry, file: await toDataUrl(file), thumb: await toDataUrl(thumb) });
    }

    return JSON.stringify({ format: "BetterImageEditor", version: 1, pictures }, null, 4);
}

export function importAll(json: string, limit: number) {
    const parsed = JSON.parse(json);
    if (parsed?.format !== "BetterImageEditor" || !Array.isArray(parsed.pictures)) {
        throw new Error("that file is not a picture library");
    }

    return queued(async () => {
        const entries = await readIndex();
        const known = new Map(entries.map(entry => [`${entry.kind}:${entry.group}:${entry.sig}`, entry.id]));
        const renamed = new Map<string, string>();
        const imported: Entry[] = [];

        for (const { file, thumb, ...picture } of parsed.pictures) {
            if (typeof picture.name !== "string" || typeof picture.added !== "number" || !isDataUrl(file) || !isDataUrl(thumb)) continue;

            const shelf = `${picture.kind}:${picture.group}:${picture.sig}`;
            const existing = known.get(shelf);
            if (existing) {
                renamed.set(picture.id, existing);
                continue;
            }

            const id = nanoid();
            known.set(shelf, id);
            renamed.set(picture.id, id);
            await DataStore.setMany([[fileKey(id), await fromDataUrl(file)], [thumbKey(id), await fromDataUrl(thumb)]], store);

            imported.push({ ...picture, id });
        }

        for (const entry of imported) {
            if (entry.from) entry.from = renamed.get(entry.from) ?? entry.from;
        }

        const { kept, dropped } = trim([...entries, ...imported], limit);
        await writeIndex(kept);
        await forgetBlobs(dropped.map(entry => entry.id));

        return imported.length;
    });
}

export function forgetCrops() {
    return queued(async () => {
        const entries = await readIndex();
        const framed = entries.filter(entry => entry.crop);

        for (const entry of framed) delete entry.crop;
        await writeIndex(entries);

        return framed.length;
    });
}

export const byRecency = (entries: Entry[]) =>
    [...entries].sort((a, b) => (b.used ?? b.added) - (a.used ?? a.added));

export function touch(id: string) {
    return queued(async () => {
        const entries = await readIndex();
        const entry = entries.find(entry => entry.id === id);
        if (!entry) return;

        entry.used = Date.now();
        await writeIndex(byRecency(entries));
    });
}

export function togglePin(id: string) {
    return queued(async () => {
        const entries = await readIndex();
        const entry = entries.find(entry => entry.id === id);
        if (!entry) return;

        entry.pinned = !entry.pinned;
        await writeIndex(entries);
    });
}

const historyKey = (kind: Kind) => `history:${kind}`;

export function recordApplied(kind: Kind, id: string | null) {
    return queued(async () => {
        const worn = await DataStore.get<(string | null)[]>(historyKey(kind), store) ?? [];
        if (worn[0] === id) return;

        await DataStore.set(historyKey(kind), [id, ...worn.filter(seen => seen !== id)].slice(0, 5), store);
    });
}

export async function previousApplied(kind: Kind) {
    const worn = await DataStore.get<(string | null)[]>(historyKey(kind), store) ?? [];
    return (await readIndex()).find(entry => entry.id === worn[1]) ?? null;
}

export const currentApplied = (kind: Kind) =>
    DataStore.get<(string | null)[]>(historyKey(kind), store).then(worn => worn?.[0] ?? null);

export function saveCrop(id: string, crop: CropState) {
    return queued(async () => {
        const entries = await readIndex();
        const entry = entries.find(entry => entry.id === id);
        if (!entry) return;

        entry.crop = crop;
        await writeIndex(entries);
    });
}
