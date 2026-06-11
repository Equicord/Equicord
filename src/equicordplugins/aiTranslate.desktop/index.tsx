/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ChatBarButton, type ChatBarButtonFactory } from "@api/ChatButtons";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { type IconComponent } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

import { getAutoTranslateToggleLabel, getTranslationStatusMessage, shouldTranslateOutgoingContent } from "./helpers";
import { settings } from "./settings";
import { abortActiveTranslations, clearContentTranslationCache, getTranslationRateLimitMs, translateText } from "./utils";

const cl = classNameFactory("vc-aitrans-");
const AUTO_TRANSLATE_KEYS: Array<"autoTranslate"> = ["autoTranslate"];
let lastRateLimitToast = 0;

const AITranslateIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg
        viewBox="0 0 24 24"
        height={height}
        width={width}
        className={className}
    >
        <path fill="currentColor" d="M4 4h7v2H8.8c.4 1.5 1.1 2.8 2.1 4 .4-.6.8-1.2 1.1-2h2.1c-.5 1.4-1.1 2.6-2 3.7l1.9 1.9-1.4 1.4-1.8-1.8c-1.2 1.1-2.7 2-4.5 2.8l-.8-1.8c1.5-.7 2.8-1.5 3.8-2.5-1.2-1.4-2-3.3-2.5-5.7H4V4Zm12.5 5h2L22 20h-2.1l-.7-2.2h-3.5L15 20h-2l3.5-11Zm-.2 7h2.3l-1.1-3.7h-.1L16.3 16Z" />
    </svg>
);

function showRateLimitToast(rateLimitMs: number) {
    const now = Date.now();
    if (now - lastRateLimitToast < 5_000) return;

    lastRateLimitToast = now;
    showToast(getTranslationStatusMessage("rateLimited", rateLimitMs), Toasts.Type.FAILURE);
}

const AITranslateChatButtonComponent: ChatBarButtonFactory = ({ isMainChat }) => {
    const { autoTranslate } = settings.use(AUTO_TRANSLATE_KEYS);
    if (!isMainChat) return null;

    function toggle() {
        settings.store.autoTranslate = !autoTranslate;
        showToast(
            getAutoTranslateToggleLabel(settings.store.autoTranslate),
            settings.store.autoTranslate ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE
        );
    }

    return (
        <ChatBarButton
            tooltip={autoTranslate ? "Turn off AI outgoing translate" : "Turn on AI outgoing translate"}
            onClick={toggle}
            onContextMenu={toggle}
        >
            <AITranslateIcon className={cl({ enabled: autoTranslate })} />
        </ChatBarButton>
    );
};

const WrappedAITranslateChatButton = ErrorBoundary.wrap(AITranslateChatButtonComponent, { noop: true });
const AITranslateChatButton: ChatBarButtonFactory = props => <WrappedAITranslateChatButton {...props} />;

export default definePlugin({
    name: "AITranslate",
    description: "Translate your messages with free OpenCode Zen AI models before Discord sends them.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.MasuRii],
    settings,
    chatBarButton: {
        icon: AITranslateIcon,
        render: AITranslateChatButton,
    },

    async onBeforeMessageSend(_, message) {
        const { autoTranslate, targetLanguage } = settings.store;
        if (!shouldTranslateOutgoingContent(message.content, targetLanguage, autoTranslate)) return;

        let rateLimitMs = getTranslationRateLimitMs(targetLanguage);
        if (rateLimitMs > 0) {
            showRateLimitToast(rateLimitMs);
            return { cancel: true };
        }

        showToast(getTranslationStatusMessage("translating"), Toasts.Type.CLOCK);
        const translation = await translateText(message.content, targetLanguage);
        if (translation) {
            message.content = translation.translated;
            showToast(getTranslationStatusMessage("sent"), Toasts.Type.SUCCESS);
            return;
        }

        rateLimitMs = getTranslationRateLimitMs(targetLanguage);
        if (rateLimitMs > 0) showRateLimitToast(rateLimitMs);
        else showToast(getTranslationStatusMessage("failed"), Toasts.Type.FAILURE);
        return { cancel: true };
    },

    stop() {
        abortActiveTranslations();
        clearContentTranslationCache();
    },
});
