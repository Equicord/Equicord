/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

const store = DataStore.createStore("BetterImageEditor", "library");

// Discord's uploadType, such as AVATAR or GUILD_BANNER
export type Kind = string;
export type Group = "original" | "cropped";

// the cropper's initialTransform prop. offsetRatio is a fraction of the drag range, not pixels
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

// older entries lack a group, use lower-case kinds, or hold crops in pixels
const LEGACY_KINDS: Record<string, string> = { avatar: "AVATAR", banner: "BANNER" };

export const readIndex = () => DataStore.get<Entry[]>(INDEX, store)
    .then(entries => (entries ?? []).map(({ crop, ...entry }) => ({
        ...entry,
        kind: LEGACY_KINDS[entry.kind] ?? entry.kind,
        group: entry.group ?? "original" as Group,
        ...(crop?.offsetRatio ? { crop } : {})
    })));
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

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

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
        const sig = `${file.name}:${file.size}:${file.lastModified}`;
        const stored = await readIndex();
        const sameShelf = (entry: Entry) => entry.kind === kind && entry.group === group;

        const known = stored.find(entry => sameShelf(entry) && entry.sig === sig);
        if (known) return known.id;

        // one cropped copy per source, unless the old one is pinned
        const replaced = from ? stored.filter(entry => sameShelf(entry) && entry.from === from && !entry.pinned) : [];
        const entries = stored.filter(entry => !replaced.includes(entry));

        const id = newId();
        const thumb = await thumbnail(file);

        await DataStore.set(fileKey(id), file, store);
        await DataStore.set(thumbKey(id), thumb, store);

        const next = byRecency([{ id, name: file.name, type: file.type, kind, group, sig, added: Date.now(), from }, ...entries]);
        const dropped = next.filter(entry => sameShelf(entry) && !entry.pinned).slice(limit);

        await writeIndex(next.filter(entry => !dropped.includes(entry)));
        for (const entry of [...dropped, ...replaced]) await forgetBlobs(entry.id);

        return id;
    });
}

async function forgetBlobs(id: string) {
    await DataStore.del(fileKey(id), store);
    await DataStore.del(thumbKey(id), store);
}

export function forget(id: string) {
    return queued(async () => {
        await writeIndex((await readIndex()).filter(entry => entry.id !== id));
        await forgetBlobs(id);
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

        for (const picture of parsed.pictures) {
            const shelf = `${picture.kind}:${picture.group}:${picture.sig}`;
            const existing = known.get(shelf);
            if (existing) {
                renamed.set(picture.id, existing);
                continue;
            }

            const { file, thumb, ...rest } = picture;
            const id = newId();
            known.set(shelf, id);
            renamed.set(picture.id, id);

            await DataStore.set(fileKey(id), await fromDataUrl(file), store);
            await DataStore.set(thumbKey(id), await fromDataUrl(thumb), store);

            imported.push({ ...rest, id });
        }

        for (const entry of imported) {
            if (entry.from) entry.from = renamed.get(entry.from) ?? entry.from;
        }

        entries.push(...imported);
        entries.sort((a, b) => b.added - a.added);

        const counts = new Map<string, number>();
        const kept: Entry[] = [];
        const dropped: Entry[] = [];

        for (const entry of entries) {
            if (entry.pinned) {
                kept.push(entry);
                continue;
            }

            const shelf = `${entry.kind}:${entry.group}`;
            const nth = (counts.get(shelf) ?? 0) + 1;
            counts.set(shelf, nth);
            (nth <= limit ? kept : dropped).push(entry);
        }

        await writeIndex(kept);
        for (const entry of dropped) await forgetBlobs(entry.id);

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

// recorded when Discord confirms the save, not when a picture is handed to the editor
const historyKey = (kind: Kind) => `history:${kind}`;

export async function recordApplied(kind: Kind, id: string) {
    const worn = await DataStore.get<string[]>(historyKey(kind), store) ?? [];
    if (worn[0] === id) return;

    await DataStore.set(historyKey(kind), [id, ...worn.filter(seen => seen !== id)].slice(0, 5), store);
}

export async function previousApplied(kind: Kind) {
    const worn = await DataStore.get<string[]>(historyKey(kind), store) ?? [];
    return (await readIndex()).find(entry => entry.id === worn[1]) ?? null;
}

export const currentApplied = (kind: Kind) =>
    DataStore.get<string[]>(historyKey(kind), store).then(worn => worn?.[0] ?? null);

export function saveCrop(id: string, crop: CropState) {
    return queued(async () => {
        const entries = await readIndex();
        const entry = entries.find(entry => entry.id === id);
        if (!entry) return;

        entry.crop = crop;
        await writeIndex(entries);
    });
}
