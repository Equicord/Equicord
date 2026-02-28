/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { ChatBarButton, ChatBarButtonFactory, ChatBarProps } from "@api/ChatButtons";
import { DeleteIcon } from "@components/Icons";
import { classes, sleep } from "@utils/misc";
import { IconComponent } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Alerts, AuthenticationStore, Constants, MessageActions, RestAPI, Toasts } from "@webpack/common";

import { cl } from "./utils";

export const DeleterIcon: IconComponent = ({ height = 20, width = 20, className }: { height?: number | string; width?: number | string; className?: string; }) => {
    return (
        <DeleteIcon
            height={height}
            width={width}
            className={classes(cl("icon"), className)}
        />
    );
};

async function deleteMyMessages(channelId: string) {
    const myId = AuthenticationStore.getId();
    let deletedCount = 0;
    let lastId: string | undefined;

    const toastId = Toasts.genId();

    try {
        while (true) {
            const { body: messages }: { body: Message[]; } = await RestAPI.get({
                url: Constants.Endpoints.MESSAGES(channelId),
                query: {
                    limit: 50,
                    before: lastId
                }
            });

            if (!messages.length) break;

            const myMessages = messages.filter(m => m.author.id === myId);

            for (const msg of myMessages) {
                // We use true for 'silent' to avoid triggering more things
                await MessageActions.deleteMessage(channelId, msg.id, true);
                deletedCount++;
                Toasts.show({
                    id: toastId,
                    message: `Deleting messages... (${deletedCount})`,
                    type: Toasts.Type.SUCCESS
                });
                // Small delay to be polite to the API
                await sleep(200);
            }

            lastId = messages[messages.length - 1].id;
            // Another small delay between batches
            await sleep(500);
        }

        Toasts.show({
            id: toastId,
            message: `Cleanup finished! Deleted ${deletedCount} messages.`,
            type: Toasts.Type.SUCCESS
        });
    } catch (e) {
        Toasts.show({
            id: toastId,
            message: "Failed to delete some messages.",
            type: Toasts.Type.FAILURE
        });
    }
}

export const MessageDeleterChatBarIcon: ChatBarButtonFactory = ({ channel, isAnyChat }: ChatBarProps & { isMainChat: boolean; isAnyChat: boolean; }) => {
    if (!isAnyChat) return null;

    return (
        <ChatBarButton
            tooltip="Delete My Messages"
            onClick={() => {
                Alerts.show({
                    title: "Delete My Messages",
                    body: "Are you sure you want to delete all your messages in this channel? This action cannot be undone.",
                    confirmText: "Delete all",
                    cancelText: "Cancel",
                    confirmColor: "vc-notification-log-danger-btn",
                    onConfirm: () => deleteMyMessages(channel.id)
                });
            }}
        >
            <DeleterIcon />
        </ChatBarButton>
    );
};
