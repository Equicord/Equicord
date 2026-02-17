/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type SlotKind = "avatar" | "banner";
export type StoredSlot = { dataUrl: string; addedAt: number; };
export type RecentAvatarEntry = { id: string; storageHash?: string; description: string; };
export type RecentData = { avatars: RecentAvatarEntry[]; loading: boolean; error?: { message?: string; } | null; };
export type RecentSelectHandler = (avatar: RecentAvatarEntry) => unknown;
export type ModalCompleteHandler = (payload: Record<string, unknown>) => unknown;
export type ModalOpenEditorHandler = (imageUri: string, file: File) => unknown;
