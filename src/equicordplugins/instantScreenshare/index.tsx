/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { ChannelStore, MediaEngineStore, PermissionsBits, PermissionStore, SelectedChannelStore, UserStore, VoiceActions } from "@webpack/common";

import { getCurrentMedia, settings } from "./utils";


const startStream = findByCodeLazy('type:"STREAM_START"');


let hasStreamed;


async function autoStartStream() {
    const selected = SelectedChannelStore.getVoiceChannelId();
    if (!selected) return;
    const channel = ChannelStore.getChannel(selected);


    // Skip stage channels (type 13)
    if (channel.type === 13) return;


    // For guild voice channels, check stream permissions
    // For DM/Group DM calls (type 1, 3), no permission check needed
    const isGuildChannel = channel.guild_id != null;
    if (isGuildChannel && !PermissionStore.can(PermissionsBits.STREAM, channel)) return;


    // Handle auto mute/deafen settings (only toggle if not already muted/deafened)
    if (settings.store.autoDeafen && !MediaEngineStore.isSelfDeaf()) {
        // Deafen also mutes you automatically
        VoiceActions.toggleSelfDeaf();
    } else if (settings.store.autoMute && !MediaEngineStore.isSelfMute()) {
        // Only mute if not deafening (since deafen already mutes)
        VoiceActions.toggleSelfMute();
    }


    const streamMedia = await getCurrentMedia();


    // Check if this is a video device (camera/capture card)
    if (streamMedia.type === "video_device") {
        // For video devices, Discord expects:
        // 1. sourceId prefixed with "camera:"
        // 2. sourceName without the emoji prefix
        // 3. audioSourceId set to the device name (for audio from capture card)
        const streamParams = {
            "pid": null,
            "sourceId": `camera:${streamMedia.id}`, // Add "camera:" prefix
            "sourceName": streamMedia.name,
            "audioSourceId": streamMedia.name, // Use device name for audio
            "sound": true,
            "previewDisabled": false
        };


        startStream(channel.guild_id ?? null, selected, streamParams);
    } else {
        // For desktop sources, use the original logic
        startStream(channel.guild_id ?? null, selected, {
            "pid": null,
            "sourceId": streamMedia.id,
            "sourceName": streamMedia.name,
            "audioSourceId": null,
            "sound": true,
            "previewDisabled": false
        });
    }
}


export default definePlugin({
    name: "InstantScreenshare",
    description: "Instantly screenshare when joining a voice channel with support for desktop sources, windows, and video input devices (cameras, capture cards)",
    authors: [Devs.HAHALOSAH, Devs.thororen, Devs.mart],
    getCurrentMedia,
    settings,



    settingsAboutComponent: () => (
        <>
            <HeadingSecondary>For Linux</HeadingSecondary>
            <Paragraph>
                For Wayland it only pops up the screenshare select
                <br />
                For X11 it may or may not work :shrug:
            </Paragraph>
            <HeadingSecondary>Video Devices</HeadingSecondary>
            <Paragraph>
                Supports cameras and capture cards (like Elgato HD60X) when enabled in settings
            </Paragraph>
        </>
    ),
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myId = UserStore.getCurrentUser().id;
            for (const state of voiceStates) {
                const { userId, channelId } = state;
                if (userId !== myId) continue;


                if (channelId && !hasStreamed) {
                    hasStreamed = true;
                    await autoStartStream();
                }


                if (!channelId) {
                    hasStreamed = false;
                }


                break;
            }
        }
    },
});

