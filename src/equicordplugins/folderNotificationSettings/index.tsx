/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { GuildFolder } from "@vencord/discord-types";
import { NotifyHighlights } from "@vencord/discord-types/enums";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { GuildStore, Menu, React, UserGuildSettingsStore } from "@webpack/common";

import { GuildNotificationSettings, PerGuildNotificationSetting, Trilean } from "./types";

const { updateGuildNotificationSettings } = findByPropsLazy("updateGuildNotificationSettings");
const SortedGuildStore = findStoreLazy("SortedGuildStore");
function getGuildFolder(id: string): GuildFolder {
	return SortedGuildStore.getGuildFolders().find(folder => folder.folderId === id);
}

function getServerNotificationSettings(guildId: string): GuildNotificationSettings | null {
	const guild = GuildStore.getGuild(guildId);
	if (!guild) return null;

	return {
		Muted: UserGuildSettingsStore.isMuted(guildId),
		MutedUntil: UserGuildSettingsStore.getMuteConfig(guildId)?.selected_time_window ?? null,

		Notifications: UserGuildSettingsStore.getMessageNotifications(guildId),
		SuppressEveryoneAndHere: UserGuildSettingsStore.isSuppressEveryoneEnabled(guildId),
		SuppressRoles: UserGuildSettingsStore.isSuppressRolesEnabled(guildId),
		SuppressHighlights: UserGuildSettingsStore.getNotifyHighlights(guildId) === NotifyHighlights.DISABLED,
		MuteNewEvents: UserGuildSettingsStore.isMuteScheduledEventsEnabled(guildId),
		MobilePushNotifications: UserGuildSettingsStore.isMobilePushEnabled(guildId),
	};
}

function booleanToTrilean(value: boolean): Trilean {
	return value ? Trilean.TRUE : Trilean.FALSE;
}

function mergeTrileanSetting(value1: Trilean, value2: boolean) {
	if (value1 === Trilean.MAYBE) return value1;
	if (value1 !== value2) {
		return Trilean.MAYBE;
	} else return value2 ? Trilean.TRUE : Trilean.FALSE;
}

function mergeNotificationSettings(guildNotificationSettings: GuildNotificationSettings[]) {
	if (guildNotificationSettings.length === 0) return null;
	if (guildNotificationSettings.length === 1) return guildNotificationSettings[0];
	const mergedNotificationSettings = {
		Muted: booleanToTrilean(guildNotificationSettings[0].Muted),
		MutedUntil: guildNotificationSettings[0].MutedUntil,
		Notifications: guildNotificationSettings[0].Notifications,
		SuppressEveryoneAndHere: booleanToTrilean(guildNotificationSettings[0].SuppressEveryoneAndHere),
		SuppressRoles: booleanToTrilean(guildNotificationSettings[0].SuppressRoles),
		SuppressHighlights: booleanToTrilean(guildNotificationSettings[0].SuppressHighlights),
		MuteNewEvents: booleanToTrilean(guildNotificationSettings[0].MuteNewEvents),
		MobilePushNotifications: booleanToTrilean(guildNotificationSettings[0].MobilePushNotifications),
	};
	guildNotificationSettings.forEach(guildNotificationSetting => {
		mergedNotificationSettings.Muted = mergeTrileanSetting(mergedNotificationSettings.Muted, guildNotificationSetting.Muted);

		if (mergedNotificationSettings.MutedUntil !== guildNotificationSetting.MutedUntil) mergedNotificationSettings.MutedUntil = null;

		if (mergedNotificationSettings.Notifications !== guildNotificationSetting.Notifications) {
			mergedNotificationSettings.Notifications = PerGuildNotificationSetting.MIX;
		}

		mergedNotificationSettings.SuppressEveryoneAndHere = mergeTrileanSetting(mergedNotificationSettings.SuppressEveryoneAndHere, guildNotificationSetting.SuppressEveryoneAndHere);

		mergedNotificationSettings.SuppressRoles = mergeTrileanSetting(mergedNotificationSettings.SuppressRoles, guildNotificationSetting.SuppressRoles);

		mergedNotificationSettings.SuppressHighlights = mergeTrileanSetting(mergedNotificationSettings.SuppressHighlights, guildNotificationSetting.SuppressHighlights);

		mergedNotificationSettings.MuteNewEvents = mergeTrileanSetting(mergedNotificationSettings.MuteNewEvents, guildNotificationSetting.MuteNewEvents);

		mergedNotificationSettings.MobilePushNotifications = mergeTrileanSetting(mergedNotificationSettings.MobilePushNotifications, guildNotificationSetting.MobilePushNotifications);
	});

	return mergedNotificationSettings;
}

function updateGuildNotificationSettingsInFolder(folder: GuildFolder, settings: {
	muted?: boolean,
	muted_until?: number,
	mobile_push?: boolean,
	suppress_everyone?: boolean,
	suppress_roles?: boolean,
	mute_scheduled_events?: boolean,
	notify_highlights?: NotifyHighlights,
	message_notifications?: PerGuildNotificationSetting;
}) {
	if (!folder) return;
	folder.guildIds.forEach(guildId => {
		updateGuildNotificationSettings(guildId, settings);
	});
}

function ContextCallback(children: React.ReactNode[], props: { folderId?: string; }) {
	if (!("folderId" in props) || props.folderId === undefined) return;

	const guildNotificationSettings: GuildNotificationSettings[] = [];
	const folder = getGuildFolder(props.folderId);

	if (!folder) return;

	folder.guildIds.forEach(guildId => {
		const notificationSettings = getServerNotificationSettings(guildId);
		if (notificationSettings) guildNotificationSettings.push(notificationSettings);
	});
	if (guildNotificationSettings.length === 0) return;

	const mergedNotificationSettings = mergeNotificationSettings(guildNotificationSettings);
	if (!mergedNotificationSettings) return;

	children.splice(1, 0, (
		<Menu.MenuGroup>
			<Menu.MenuItem
				id="folder-mute-guild"
				label={mergedNotificationSettings.Muted === true ? "Unmute Servers" : "Mute Servers"}
				action={() => updateGuildNotificationSettingsInFolder(folder, {
					muted: !mergedNotificationSettings.Muted
				})}
			>
				{mergedNotificationSettings.Muted !== Trilean.TRUE && ([{
					label: "For 15 Minutes",
					value: 15 * 60,
				}, {
					label: "For 1 Hour",
					value: 60 * 60,
				}, {
					label: "For 3 Hours",
					value: 3 * 60 * 60,
				}, {
					label: "For 8 Hours",
					value: 8 * 60 * 60,
				}, {
					label: "For 24 Hours",
					value: 24 * 60 * 60,
				}, {
					label: "Until I turn it back on",
					value: -1
				}].map(time => (
					<Menu.MenuItem
						key={time.value}
						id={`folder-mute-guild-${time.value}`}
						label={`${time.label}`}
						action={() => {
							updateGuildNotificationSettingsInFolder(folder, {
								muted: true,
								muted_until: time.value
							});
						}}
					/>
				)))}
			</Menu.MenuItem>
			<Menu.MenuItem
				id="folder-notifications"
				label="Notification Settings"
			>
				<Menu.MenuRadioItem
					id="folder-notifications-all-messages"
					label="All Messages"
					group="folder-notifications-radio"
					checked={mergedNotificationSettings.Notifications === PerGuildNotificationSetting.ALL_MESSAGES}
					action={() => updateGuildNotificationSettingsInFolder(folder, {
						message_notifications: PerGuildNotificationSetting.ALL_MESSAGES
					})}
				/>
				<Menu.MenuRadioItem
					id="folder-notifications-mentions"
					label="Only @mentions"
					group="folder-notifications-radio"
					checked={mergedNotificationSettings.Notifications === PerGuildNotificationSetting.ONLY_MENTIONS}
					action={() => updateGuildNotificationSettingsInFolder(folder, {
						message_notifications: PerGuildNotificationSetting.ONLY_MENTIONS
					})}
				/>
				<Menu.MenuRadioItem
					id="folder-notifications-nothing"
					label="Nothing"
					group="folder-notifications-radio"
					checked={mergedNotificationSettings.Notifications === PerGuildNotificationSetting.NO_MESSAGES}
					action={() => updateGuildNotificationSettingsInFolder(folder, {
						message_notifications: PerGuildNotificationSetting.NO_MESSAGES
					})}
				/>
				<Menu.MenuSeparator />
				<Menu.MenuCheckboxItem
					id="folder-notifications--0"
					label="Suppress @everyone and @here"
					checked={mergedNotificationSettings.SuppressEveryoneAndHere === Trilean.TRUE}
					action={() => updateGuildNotificationSettingsInFolder(folder, { suppress_everyone: !mergedNotificationSettings.SuppressEveryoneAndHere })}
				/>
				<Menu.MenuCheckboxItem
					id="folder-notifications--1"
					label="Suppress All Role @mentions"
					checked={mergedNotificationSettings.SuppressRoles === Trilean.TRUE}
					action={() => updateGuildNotificationSettingsInFolder(folder, { suppress_roles: !mergedNotificationSettings.SuppressRoles })}
				/>
				<Menu.MenuCheckboxItem
					id="folder-notifications--2"
					label="Suppress Highlights"
					checked={mergedNotificationSettings.SuppressHighlights === Trilean.TRUE}
					action={() => updateGuildNotificationSettingsInFolder(folder, { notify_highlights: mergedNotificationSettings.SuppressHighlights ? NotifyHighlights.ENABLED : NotifyHighlights.DISABLED })}
				/>
				<Menu.MenuCheckboxItem
					id="folder-notifications--3"
					label="Mute New Events"
					checked={mergedNotificationSettings.MuteNewEvents === Trilean.TRUE}
					action={() => updateGuildNotificationSettingsInFolder(folder, { mute_scheduled_events: !mergedNotificationSettings.MuteNewEvents })}
				/>
				<Menu.MenuSeparator />
				<Menu.MenuCheckboxItem
					id="folder-notifications--4"
					label="Mobile Push Notifications"
					checked={mergedNotificationSettings.MobilePushNotifications === Trilean.TRUE}
					action={() => updateGuildNotificationSettingsInFolder(folder, { mobile_push: !mergedNotificationSettings.MobilePushNotifications })}
				/>
			</Menu.MenuItem>
		</Menu.MenuGroup>
	));
}

export default definePlugin({
	name: "Folder Notification Settings",
	description: "Allows you to manage notifications for a folder of servers. \n The UI tends to lagg but cause of a technical limitation, but the changes are applied instantly.",
	tags: ["Notifications", "Servers", "Utility", "Organisation"],
	authors: [EquicordDevs.darkodaaa],

	contextMenus: {
		"guild-context": ContextCallback,
	},
});
