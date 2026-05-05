/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { settings as PluginSettings } from "@equicordplugins/toastNotifications/index";
import { classNameFactory } from "@utils/css";
import { findComponentByCodeLazy } from "@webpack";
import { FluxDispatcher, GuildStore, IconUtils, React, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { MessageNotification, NotificationData } from "./Notifications";

export const cl = classNameFactory("vc-toast-notifications-");
const MessageComponent = findComponentByCodeLazy("childrenExecutedCommand:", ".hideAccessories");

function isMessageNotification(props: NotificationData): props is MessageNotification {
    return "mockedMessage" in props;
}

function renderContextHeader(channel: MessageNotification["channel"]): React.ReactNode {
    if (channel.isGroupDM()) {
        const icon = channel.icon
            ? IconUtils.getChannelIconURL?.({ id: channel.id, icon: channel.icon, size: 32 })
            : undefined;
        const rawName = channel.name?.trim() || channel.rawRecipients.slice(0, 3).map(e => e.username).join(", ");
        const name = rawName.length > 20 ? rawName.substring(0, 20) + "..." : rawName;
        return (
            <div className={cl("context-header")}>
                {icon && <img className={cl("context-header-icon")} src={icon} alt="" />}
                <span className={cl("context-header-name")}>{name}</span>
            </div>
        );
    }

    if (channel.guild_id) {
        const guild = GuildStore.getGuild(channel.guild_id);
        const icon = guild?.icon
            ? IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 32 })
            : undefined;
        return (
            <div className={cl("context-header")}>
                {icon && <img className={cl("context-header-icon")} src={icon} alt="" />}
                <span className={cl("context-header-name")}>
                    {guild?.name ?? "Unknown Server"}
                    {channel.name && (
                        <>
                            <span className={cl("context-header-separator")}>{" \u203A "}</span>
                            <span className={cl("context-header-channel")}>#{channel.name}</span>
                        </>
                    )}
                </span>
            </div>
        );
    }

    return null;
}

export default ErrorBoundary.wrap(function NotificationComponent(props: NotificationData) {
    const [isHover, setIsHover] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    const timeout = (PluginSettings.store.timeout ?? 5) * 1000;
    const opacity = PluginSettings.store.opacity / 100;
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (isHover || props.permanent) {
            setElapsed(0);
            return;
        }

        startRef.current = Date.now();
        const intervalId = setInterval(() => {
            const next = Date.now() - startRef.current;
            if (next >= timeout) props.onClose!();
            else setElapsed(next);
        }, 10);

        return () => clearInterval(intervalId);
    }, [isHover, props.permanent, timeout]);

    const timeoutProgress = elapsed / timeout;

    const handleClick = () => {
        props.onClick?.();
        if (props.dismissOnClick !== false) props.onClose!();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Also marks the message as read.
        if (isMessageNotification(props)) {
            FluxDispatcher.dispatch({
                type: "BULK_ACK",
                context: "APP",
                channels: [{
                    channelId: props.channel.id,
                    messageId: props.message.id,
                    readStateType: 0
                }]
            });
        }

        props.onClose!();
    };

    const closeButton = useMemo(() => (
        <button
            className={cl("notification-close-btn")}
            onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                props.onClose!();
            }}
        >
            <svg width="24" height="24" viewBox="0 0 24 24" role="img" aria-labelledby="vc-toast-notifications-dismiss-title">
                <title id="vc-toast-notifications-dismiss-title">Dismiss Notification</title>
                <path fill="currentColor" d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
        </button>
    ), [props.onClose]);

    let content: React.ReactNode;
    if (isMessageNotification(props)) {
        content = (
            <div className={cl("notification-content")}>
                {renderContextHeader(props.channel)}
                <MessageComponent
                    id={`toastnotification-mock-${props.message.id}`}
                    message={props.mockedMessage}
                    channel={props.channel}
                    subscribeToComponentDispatch={false}
                />
            </div>
        );
    } else {
        const { title, body, icon } = props;
        content = (
            <div className={cl("notification-system")}>
                {icon && <img className={cl("notification-icon")} src={icon} alt="" />}
                <div className={cl("notification-content")}>
                    <div className={cl("notification-header")}>
                        <h2 className={cl("notification-title")}>{title}</h2>
                    </div>
                    {body && (
                        <p className={cl("notification-p")}>
                            {body.length > 500 ? body.slice(0, 500) + "..." : body}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <button
            style={{ opacity }}
            className={cl("notification-root")}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
        >
            {closeButton}
            {content}
            {timeout !== 0 && !props.permanent && (
                <div
                    className={cl("notification-progressbar")}
                    style={{ width: `${(1 - timeoutProgress) * 100}%` }}
                />
            )}
        </button>
    );
}, {
    onError: ({ props }) => props.onClose!()
});
