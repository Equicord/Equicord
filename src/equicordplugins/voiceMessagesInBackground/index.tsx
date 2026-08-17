/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import { handlePlaybackRateUpdate, stopPlayback, useBackgroundPlayback } from "./playback";
import { VoiceMessageIcon,VoiceMessagesInBackgroundPlayer } from "./player";

interface PlaybackRateUpdate {
    playbackType: string;
    rate: number;
}

const WrappedVoiceMessagesInBackgroundPlayer = ErrorBoundary.wrap(VoiceMessagesInBackgroundPlayer, { noop: true });

export default definePlugin({
    name: "Voice Messages In-Background",
    description: "Keeps voice messages playing across chats with a synchronized mini player.",
    authors: [EquicordDevs.ELJoOker],
    tags: ["Voice", "Media", "Chat"],
    dependencies: ["AudioPlayerAPI", "HeaderBarAPI"],

    patches: [{
        find: "#{intl::PAUSE_VOICE_MESSAGE_A11Y_LABEL}",
        replacement: {
            match: /(\{src:(\i).{0,200}?playbackCacheKey:(\i)\}=\i,\i=\i\.useRef\(null\).{0,300}?\[(\i),(\i)\]=\i\.useState\(\i\),.{0,120}?)(\[\i,\i\]=)(\i\.useState\(!1\))(?=,\[\i,\i\]=\i\.useState\(!1\),\[\i,\i\]=\i\.useState\(!1\),\[\i,\i\]=\i\.useState\("none"\))/,
            replace: "$1$6$self.useBackgroundPlayback($7,$4,$2,$3,$5)"
        }
    }],

    headerBarButton: {
        icon: VoiceMessageIcon,
        location: "channeltoolbar",
        priority: 30,
        render: () => <WrappedVoiceMessagesInBackgroundPlayer />
    },

    flux: {
        MEDIA_PLAYBACK_RATE_UPDATE({ playbackType, rate }: PlaybackRateUpdate) {
            if (playbackType === "voice_message") handlePlaybackRateUpdate(rate);
        }
    },

    useBackgroundPlayback,
    stop: stopPlayback
});
