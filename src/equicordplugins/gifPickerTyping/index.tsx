/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButtonFactory } from "@api/ChatButtons";
import { PencilIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Constants, ExpressionPickerStore, RestAPI, useEffect } from "@webpack/common";

const GifPickerTyping: ChatBarButtonFactory = ({ isMainChat }) => {
    const channelId = ExpressionPickerStore.useExpressionPickerStore(state => state.activeView === "gif" ? state.activeChannelId : null);

    useEffect(() => {
        if (!isMainChat || !channelId) return;

        const type = () => RestAPI.post({ url: Constants.Endpoints.TYPING(channelId) });
        type();

        const interval = setInterval(type, 8000);
        return () => clearInterval(interval);
    }, [isMainChat, channelId]);

    return null;
};

export default definePlugin({
    name: "GifPickerTyping",
    description: "Shows you as typing while the GIF picker is open, so nobody wonders why you went quiet.",
    authors: [EquicordDevs.luqenov],
    chatBarButton: {
        icon: PencilIcon,
        render: GifPickerTyping
    }
});
