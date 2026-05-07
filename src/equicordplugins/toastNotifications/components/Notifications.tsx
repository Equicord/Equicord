/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings as PluginSettings } from "@equicordplugins/toastNotifications/index";
import { Channel, Message } from "@vencord/discord-types";
import { createRoot } from "@webpack/common";
import type { JSX } from "react";
import type { Root } from "react-dom/client";

import NotificationComponent from "./NotificationComponent";

let NotificationQueue: JSX.Element[] = [];
let notificationID = 0;
let RootContainer: Root | undefined;
let ToastContainer: HTMLDivElement | undefined;

function getNotificationContainer() {
    // If the root container doesn't exist, create it.
    if (!RootContainer) {
        ToastContainer = document.createElement("div");
        ToastContainer.id = "vc-toast-notifications-container";
        document.body.append(ToastContainer);
        RootContainer = createRoot(ToastContainer);
    }

    // Keep the container's position class in sync with the user's setting.
    if (ToastContainer) {
        ToastContainer.className = `vc-toast-notifications-position-${PluginSettings.store.position ?? "bottom-left"}`;
    }

    return RootContainer;
}

export function setContainerPosition(position: string) {
    if (ToastContainer) ToastContainer.className = `vc-toast-notifications-position-${position ?? "bottom-left"}`;
}

interface BaseNotification {
    permanent?: boolean;
    dismissOnClick?: boolean;
    onClick?(): void;
    onClose?(): void;
}

export interface MessageNotification extends BaseNotification {
    message: Message;
    mockedMessage: Message;
    channel: Channel;
}

export interface SystemNotification extends BaseNotification {
    title: string;
    body: string;
    icon?: string;
}

export type NotificationData = MessageNotification | SystemNotification;

export async function showNotification(notification: NotificationData) {
    const root = getNotificationContainer();
    const thisNotificationID = notificationID++;

    return new Promise<void>(resolve => {
        const ToastNotification = (
            <NotificationComponent
                key={thisNotificationID.toString()}
                {...notification}
                onClose={() => {
                    NotificationQueue = NotificationQueue.filter(n => n.key !== thisNotificationID.toString());
                    notification.onClose?.();
                    root.render(<>{NotificationQueue}</>);
                    resolve();
                }}
            />
        );

        // Push this notification into the stack.
        NotificationQueue.push(ToastNotification);

        // If the queue exceeds the maximum number of notifications, remove the oldest one.
        if (NotificationQueue.length > PluginSettings.store.maxNotifications) NotificationQueue.shift();

        root.render(<>{NotificationQueue}</>);
    });
}

/**
 * Tears down the notification root and removes the container from the DOM.
 * Called when the plugin is disabled.
 */
export function teardownNotifications() {
    NotificationQueue = [];
    RootContainer?.unmount();
    RootContainer = undefined;
    ToastContainer?.remove();
    ToastContainer = undefined;
}
