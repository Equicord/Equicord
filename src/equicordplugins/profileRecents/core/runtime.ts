/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { classNameFactory } from "@utils/css";
import { findByCodeLazy, findStoreLazy } from "@webpack";
import { FluxDispatcher, SelectedGuildStore, UserStore } from "@webpack/common";

import { settings } from "../settings";
import type { ModalCompleteHandler, ModalOpenEditorHandler, RecentAvatarEntry, RecentData, RecentSelectHandler, SlotKind, StoredSlot } from "./types";

const cl = classNameFactory("vc-profile-recents-");
const RecentAvatarsStore = findStoreLazy("RecentAvatarsStore");
const ArchivedAvatarUtils = findByCodeLazy("ARCHIVED_AVATAR", "storageHash", "allowWebp");
const KEY_PREFIX = "ProfileRecents";
const LEGACY_KEY_PREFIX = "MoreSets";

const toKind = (isBanner: boolean): SlotKind => isBanner ? "banner" : "avatar";
const slotLimit = (kind: SlotKind) => kind === "banner" ? settings.store.bannerSlots : settings.store.avatarSlots;

const dataPayload = (url: string): string | null => {
    if (!url.startsWith("data:")) return null;
    const i = url.indexOf(",");
    return i !== -1 ? url.slice(i + 1) : null;
};

export class ProfileRecentsRuntime {
    private caches: Record<SlotKind, StoredSlot[] | null> = { avatar: null, banner: null };
    private hiddenIds: Record<SlotKind, Set<string>> = { avatar: new Set(), banner: new Set() };
    private nativeDataCache = new Map<string, string | null>();
    private skipCapture: Record<SlotKind, number> = { avatar: 0, banner: 0 };
    private suppressCapture: Record<SlotKind, boolean> = { avatar: false, banner: false };

    private kind: SlotKind = "avatar";
    private avatarEditor: ModalOpenEditorHandler | null = null;
    private avatarComplete: ModalCompleteHandler | null = null;
    private bannerEditor: ModalOpenEditorHandler | null = null;
    private bannerComplete: ModalCompleteHandler | null = null;

    private key(prefix: string, kind: SlotKind) {
        return `${prefix}:${kind}:${UserStore.getCurrentUser()?.id ?? "unknown"}`;
    }

    start() { void this.load("avatar"); void this.load("banner"); }

    setModalKind(isBanner: boolean) { this.kind = toKind(isBanner); }

    beginModalSession(isBanner: boolean) { const k = toKind(isBanner); this.suppressCapture[k] = false; this.skipCapture[k] = 0; }

    hasSlots(isBanner: boolean) { return Boolean(this.caches[toKind(isBanner)]?.length); }

    shouldRenderRecents(avatars: RecentAvatarEntry[] | null | undefined) {
        return !!avatars?.length;
    }

    getRecentTitle() { return this.kind === "banner" ? "Recent Banners" : "Recent Avatars"; }

    getRecentDescription() { return `Access your ${slotLimit(this.kind)} most recent ${this.kind} uploads`; }

    getRecentRootClass() { return cl("recentRoot"); }

    private isBannerEntry(avatar?: { storageHash?: string; } | null) {
        return this.kind === "banner" || /^(?:moresets|profilerecents)_banner_/i.test(avatar?.storageHash ?? "");
    }

    getRecentButtonStyle(avatar?: RecentAvatarEntry | null) {
        return this.isBannerEntry(avatar) ? { width: "100%", aspectRatio: "16 / 9", borderRadius: 8, overflow: "hidden" } : undefined;
    }

    getRecentMediaStyle(avatar?: RecentAvatarEntry | null) {
        return this.isBannerEntry(avatar) ? { width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 } : undefined;
    }

    getRecentButtonClass(avatar: RecentAvatarEntry | null | undefined, cls: string) {
        return this.isBannerEntry(avatar) ? undefined : cls;
    }

    getRecentMediaClass(avatar: RecentAvatarEntry | null | undefined, cls: string) {
        return this.isBannerEntry(avatar) ? undefined : cls;
    }

    getRecentListStyle(avatars?: RecentAvatarEntry[] | null) {
        return avatars?.some(a => this.isBannerEntry(a))
            ? { display: "grid", gridTemplateColumns: "1fr", width: "100%", gap: 8 }
            : undefined;
    }

    getRecentItemStyle(avatar?: RecentAvatarEntry | null) {
        return this.isBannerEntry(avatar) ? { width: "100%", maxWidth: "100%" } : undefined;
    }

    getRecentRowStyle(avatar?: RecentAvatarEntry | null) {
        return this.isBannerEntry(avatar) ? { width: "100%", maxWidth: "100%" } : undefined;
    }

    getRecentMediaSrc(avatar: RecentAvatarEntry | { id?: string; storageHash?: string; } | null | undefined, nativeSrc: string) {
        const id = typeof avatar?.id === "string" ? avatar.id : null;
        if (id?.startsWith("data:")) return id;

        const hash = typeof avatar?.storageHash === "string" ? avatar.storageHash : null;
        const m = hash?.match(/^(?:moresets|profilerecents)_(avatar|banner)_(\d+)$/i);
        if (m) {
            const kind = m[1].toLowerCase() as SlotKind;
            const idx = Number(m[2]);
            const slot = Number.isFinite(idx) ? this.caches[kind]?.[idx]?.dataUrl : null;
            if (typeof slot === "string" && slot.startsWith("data:")) return slot;
        }
        return nativeSrc;
    }

    mergeRecentData(data: RecentData): RecentData {
        const k = this.kind;
        if (this.caches[k] == null) void this.load(k);

        const custom = (this.caches[k] ?? []).map((s, i) => ({
            id: s.dataUrl, storageHash: `profilerecents_${k}_${i}`, description: `ProfileRecents ${k}`
        }));
        const native = k === "banner" ? [] : (Array.isArray(data.avatars) ? data.avatars : []);
        const nativeIds = new Set(native.map(e => e.id));
        const hidden = this.hiddenIds[k];
        const seen = new Set<string>();
        const merged: RecentAvatarEntry[] = [];

        for (const entry of [...custom.filter(e => !nativeIds.has(e.id)), ...native]) {
            if (!seen.has(entry.id) && !hidden.has(entry.id)) { seen.add(entry.id); merged.push(entry); }
        }

        const isBanner = k === "banner";
        return { ...data, avatars: merged.slice(0, slotLimit(k)), loading: isBanner ? false : data.loading, error: isBanner ? null : data.error };
    }

    wrapRecentDelete(removeNative: (...a: unknown[]) => unknown) {
        return async (...args: unknown[]) => {
            const id = typeof args[2] === "string" ? args[2] : null;
            if (!id) {
                try { return await removeNative(...args); }
                catch { return; }
            }

            if (id.startsWith("data:") && this.caches[this.kind]?.some(s => s.dataUrl === id)) {
                return void await this.removeSlot(this.kind, id);
            }
            this.hiddenIds[this.kind].add(id);
            this.refreshRecents(true);
            if (!id.startsWith("data:")) {
                try { return await removeNative(...args); }
                catch { return; }
            }
        };
    }

    onRecentSelect(selectRecent: RecentSelectHandler, avatar: RecentAvatarEntry) {
        const id = avatar?.id;
        if (!id?.startsWith("data:")) return selectRecent(avatar);

        if (this.caches[this.kind]?.some(s => s.dataUrl === id)) {
            this.suppressCapture[this.kind] = true;
            this.skipCapture[this.kind]++;
        }
        if (this.kind === "banner") return this.openBannerFromRecent(id);
        return this.openAvatarFromRecent(id);
    }

    handleRecentComplete(complete: ModalCompleteHandler, openEditor?: ModalOpenEditorHandler) {
        const isBanner = this.kind === "banner";
        if (isBanner) {
            this.bannerComplete = complete;
            this.bannerEditor = openEditor ?? null;
        } else {
            this.avatarComplete = complete;
            this.avatarEditor = openEditor ?? null;
        }
        return async (payload: { imageUri?: string; file?: File | null; } & Record<string, unknown>) => {
            if (!isBanner) return complete(payload);
            const uri = typeof payload.imageUri === "string" ? payload.imageUri : null;
            if (!uri) return complete(payload);
            const file = payload.file instanceof File ? payload.file : await this.toFile(uri, "profilerecents-banner.png");
            return this.bannerEditor && file ? this.bannerEditor(uri, file) : complete(payload);
        };
    }

    async captureSlot(imageUri?: string, file?: Blob | null, assetOrigin?: unknown, originalAsset?: unknown) {
        const k = this.kind;
        if (originalAsset != null || (assetOrigin != null && `${assetOrigin}` !== "NEW_ASSET")) return;
        if (this.suppressCapture[k] || this.skipCapture[k]-- > 0) return;
        if (!(file instanceof Blob) && typeof imageUri === "string" && !imageUri.startsWith("data:")) return;
        const dataUrl = await this.toDataUrl(imageUri, file);
        if (dataUrl) await this.addSlot(k, dataUrl);
    }

    private refreshRecents(force = false) {
        FluxDispatcher.dispatch({ type: "RECENT_AVATARS_UPDATE" });
        if (force) FluxDispatcher.dispatch({ type: "RECENT_AVATARS_FETCH_SUCCESS", avatars: [...(RecentAvatarsStore.getAvatars?.() ?? [])] });
    }

    private async isDuplicateNative(dataUrl: string): Promise<boolean> {
        const payload = dataPayload(dataUrl);
        if (!payload) return false;
        const natives = RecentAvatarsStore.getAvatars?.() as RecentAvatarEntry[] | undefined;
        if (!natives?.length) return false;
        for (const a of natives) {
            const native = await this.getNativeDataUrl(a);
            if (native && dataPayload(native) === payload) return true;
        }
        return false;
    }

    private async getNativeDataUrl(entry: RecentAvatarEntry): Promise<string | null> {
        if (entry.id.startsWith("data:")) return entry.id;
        const key = `${entry.id}:${entry.storageHash ?? ""}`;
        if (this.nativeDataCache.has(key)) return this.nativeDataCache.get(key) ?? null;

        const userId = UserStore.getCurrentUser()?.id;
        if (!userId) { this.nativeDataCache.set(key, null); return null; }

        const url = ArchivedAvatarUtils?.ARCHIVED_AVATAR?.({ userId, avatarId: entry.id, storageHash: entry.storageHash, canAnimate: false, allowWebp: true, size: 128 })
            ?? ArchivedAvatarUtils?.Xp?.({ userId, avatarId: entry.id, storageHash: entry.storageHash, size: 128 });

        if (typeof url !== "string") { this.nativeDataCache.set(key, null); return null; }
        const dataUrl = await this.toDataUrl(url);
        this.nativeDataCache.set(key, dataUrl);
        return dataUrl;
    }

    private async load(kind: SlotKind) {
        if (this.caches[kind]) return;
        const seen = new Set<string>();
        const key = this.key(KEY_PREFIX, kind);
        try {
            const raw = await DataStore.get(key) ?? await DataStore.get(this.key(LEGACY_KEY_PREFIX, kind));
            this.caches[kind] = Array.isArray(raw)
                ? raw.filter((e): e is StoredSlot => {
                    if (!e || typeof e !== "object") return false;
                    const s = e as Partial<StoredSlot>;
                    if (typeof s.dataUrl !== "string" || !s.dataUrl.startsWith("data:") || seen.has(s.dataUrl)) return false;
                    seen.add(s.dataUrl);
                    return true;
                }).map(s => ({ dataUrl: s.dataUrl, addedAt: typeof s.addedAt === "number" ? s.addedAt : Date.now() }))
                : [];
            this.refreshRecents();
        } catch {
            this.caches[kind] = [];
        }
    }

    private async persist(kind: SlotKind) {
        const key = this.key(KEY_PREFIX, kind);
        try {
            await DataStore.set(key, this.caches[kind] ?? []);
        } catch {
            return;
        }
    }

    private async addSlot(kind: SlotKind, dataUrl: string) {
        await this.load(kind);
        const payload = dataPayload(dataUrl);
        if (!payload) return;

        const current = this.caches[kind] ?? [];
        if (current.some(s => dataPayload(s.dataUrl) === payload)) return;
        if (kind === "avatar" && await this.isDuplicateNative(dataUrl)) return;

        const seen = new Set<string>();
        this.caches[kind] = [{ dataUrl, addedAt: Date.now() }, ...current]
            .filter(s => { const p = dataPayload(s.dataUrl) ?? s.dataUrl; if (seen.has(p)) return false; seen.add(p); return true; })
            .slice(0, slotLimit(kind));
        await this.persist(kind);
        this.refreshRecents();
    }

    private async removeSlot(kind: SlotKind, dataUrl: string) {
        await this.load(kind);
        this.caches[kind] = (this.caches[kind] ?? []).filter(s => s.dataUrl !== dataUrl);
        await this.persist(kind);
        this.refreshRecents(true);
    }

    private applyPendingPreview(dataUrl: string) {
        const k = this.kind;
        const guildId = SelectedGuildStore.getGuildId();
        const type = k === "banner" ? (guildId ? "GUILD_IDENTITY_SETTINGS_SET_PENDING_BANNER" : "USER_SETTINGS_ACCOUNT_SET_PENDING_BANNER") : (guildId ? "GUILD_IDENTITY_SETTINGS_SET_PENDING_AVATAR" : "USER_SETTINGS_ACCOUNT_SET_PENDING_AVATAR");
        FluxDispatcher.dispatch(guildId ? { type, guildId, [k]: dataUrl } : { type, [k]: dataUrl });
    }

    private async openBannerFromRecent(dataUrl: string) {
        const file = this.bannerEditor ? await this.toFile(dataUrl, "profilerecents-banner.png") : null;
        if (this.bannerEditor && file) return this.bannerEditor(dataUrl, file);
        if (this.bannerComplete) return this.bannerComplete({ imageUri: dataUrl });
        this.applyPendingPreview(dataUrl);
    }

    private async openAvatarFromRecent(dataUrl: string) {
        const file = this.avatarEditor ? await this.toFile(dataUrl, "profilerecents-avatar.png") : null;
        if (this.avatarEditor && file) return this.avatarEditor(dataUrl, file);
        if (this.avatarComplete) return this.avatarComplete({ imageUri: dataUrl, file });
        this.applyPendingPreview(dataUrl);
    }

    private async toFile(dataUrl: string, name: string): Promise<File | null> {
        try {
            const b = await (await fetch(dataUrl)).blob();
            return new File([b], name, { type: b.type ?? "image/png" });
        } catch {
            return null;
        }
    }

    private blobToDataUrl(blob: Blob): Promise<string | null> {
        return new Promise(r => {
            const rd = new FileReader();
            rd.onloadend = () => r(typeof rd.result === "string" ? rd.result : null);
            rd.onerror = () => r(null);
            rd.readAsDataURL(blob);
        });
    }

    private async toDataUrl(uri?: string, file?: Blob | null): Promise<string | null> {
        if (uri?.startsWith("data:")) return uri;
        if (file instanceof Blob) return this.blobToDataUrl(file);
        try {
            return uri ? this.blobToDataUrl(await (await fetch(uri)).blob()) : null;
        } catch {
            return null;
        }
    }
}

export const runtime = new ProfileRecentsRuntime();
