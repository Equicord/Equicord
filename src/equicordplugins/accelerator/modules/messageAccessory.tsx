/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { React } from "@webpack/common";

import { fastCache } from "./fastcache";
import { statsTracker } from "./stats";

const logger = new Logger("Accelerator:MessageAccessory");

interface MessageAccessoryProps {
    message: any;
}

let processedMessages = new Set<string>();

export function CacheIndicatorAccessory({ message }: MessageAccessoryProps) {
    const [showIndicator, setShowIndicator] = React.useState(false);
    const indicatorRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!message?.id || !message?.channel_id) return;

        const messageKey = `${message.channel_id}:${message.id}`;

        // Avoid processing the same message multiple times
        if (processedMessages.has(messageKey)) return;
        processedMessages.add(messageKey);

        // Add slight delay to ensure cache has been checked
        setTimeout(() => {
            const cachedMessage = fastCache.getMessage(message.channel_id, message.id);

            if (cachedMessage) {
                setShowIndicator(true);
                statsTracker.incrementMessagesServedFromCache(1);
                logger.debug(`Message ${message.id} served from cache`);
            }
        }, 100);
    }, [message?.id, message?.channel_id]);

    // Ensure proper positioning after render
    React.useEffect(() => {
        if (showIndicator && indicatorRef.current) {
            const indicator = indicatorRef.current;
            const messageElement = indicator.closest('[class*="message"]') ||
                indicator.closest('[id^="chat-messages-"]') ||
                indicator.closest('[class*="messageListItem-"]');

            if (messageElement) {
                const messageRect = messageElement.getBoundingClientRect();
                // Adjust position to be perfectly centered in the message highlight area
                indicator.style.top = "50%";
                indicator.style.right = "12px";
            }
        }
    }, [showIndicator]);

    if (!showIndicator) return null;

    return (
        <div
            ref={indicatorRef}
            style={{
                position: "absolute",
                top: "50%",
                right: "12px",
                width: "10px",
                height: "10px",
                backgroundColor: "#3ba55c",
                borderRadius: "50%",
                zIndex: 100,
                transform: "translateY(-50%)",
                boxShadow: "0 0 0 2px rgba(32, 34, 37, 0.95), 0 2px 8px rgba(0, 0, 0, 0.5)",
                animation: "acceleratorCachePulse 2.5s ease-in-out infinite",
                cursor: "help",
                pointerEvents: "none" // Don't interfere with message interactions
            }}
            title="This message was served instantly from fastcache"
        />
    );
} 