/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const Trilean = {
	TRUE: true,
	MAYBE: null,
	FALSE: false,
} as const;
export type Trilean = typeof Trilean[keyof typeof Trilean];

export const PerGuildNotificationSetting = {
	ALL_MESSAGES: 0,
	ONLY_MENTIONS: 1,
	NO_MESSAGES: 2,
	MIX: 3,
} as const;
export type PerGuildNotificationSetting = typeof PerGuildNotificationSetting[keyof typeof PerGuildNotificationSetting];

export type GuildNotificationSettings = {
	Muted: boolean;
	MutedUntil: number | null;

	Notifications: PerGuildNotificationSetting;
	SuppressEveryoneAndHere: boolean;
	SuppressRoles: boolean;
	SuppressHighlights: boolean;
	MuteNewEvents: boolean;
	MobilePushNotifications: boolean;
};
