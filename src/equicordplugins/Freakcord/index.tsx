/*
 * Equicord, a Discord client mod
 * Copyright (c) 2025 Equicord and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addChatBarButton, ChatBarButton, ChatBarButtonFactory, removeChatBarButton } from "@api/ChatButtons";
import { EquicordDevs } from "@utils/constants";
import { getCurrentChannel, sendMessage } from "@utils/discord";
import definePlugin from "@utils/types";
const audioURL = "https://cdn.nest.rip/uploads/5919aa31-e61b-421d-af08-ad7ddacd28ea.ogg";
const audioPlayer = new Audio(audioURL);
async function handleButtonClick() {
    const channel = getCurrentChannel();
    if (channel) {
        sendMessage(channel.id, { content: "Freakcord" });
        audioPlayer.play().catch(console.error);
    }
}


const ChatBarIcon: ChatBarButtonFactory = () => {
    return (
        <ChatBarButton tooltip="Freakcord 👅" onClick={handleButtonClick}>
            <img
                src="https://cdn.nest.rip/uploads/10f3f862-afd2-4244-964f-f48219e89d8e.png"
                width="24"
                style={{ objectFit: "contain" }}
            />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "Freakcord",
    description: "Adds freakness to your discord experience.",
    authors:
        [EquicordDevs.Crxa],
    start: () => addChatBarButton("Freakcord", ChatBarIcon),
    stop: () => removeChatBarButton("Freakcord")
});

