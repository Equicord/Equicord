/*
 * VoiceNarratorNatural - TTS plugin with Windows Natural Voices support
 * Copyright (c) 2026 SrMoon (https://github.com/srmooon)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin, { PluginNative, ReporterTestable } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, GuildMemberStore, GuildStore, Menu, SelectedChannelStore, SelectedGuildStore, UserStore, VoiceStateStore } from "@webpack/common";

import { getSAPI5Voices, isServerRunning, SAPI5Voice, speakWithSAPI5, stopSAPI5 } from "./sapi5Server";
import { getCurrentVoice, settings } from "./settings.tsx";

const Native = VencordNative.pluginHelpers.VoiceNarratorNatural as PluginNative<typeof import("./native")>;

let sapi5Voices: SAPI5Voice[] = [];
let sapi5Ready = false;
let isSpeaking = false;

const userStates = new Map<string, { mute: boolean; deaf: boolean; }>();

async function speak(text: string) {
    if (!text) return;
    const { ttsProvider, volume, rate, sapi5Voice } = settings.store;

    isSpeaking = true;

    if (ttsProvider === "sapi5" && sapi5Ready) {
        const vol = Math.round(volume * 100);
        const spd = Math.round((rate - 1) * 5);
        await speakWithSAPI5(text, sapi5Voice || undefined, spd, vol);
        isSpeaking = false;
    } else {
        const speech = new SpeechSynthesisUtterance(text);
        speech.voice = getCurrentVoice()!;
        speech.volume = volume;
        speech.rate = rate;
        speech.onend = () => { isSpeaking = false; };
        speech.onerror = () => { isSpeaking = false; };
        speechSynthesis.speak(speech);
    }
}

function stopSpeaking() {
    isSpeaking = false;
    if (settings.store.ttsProvider === "sapi5") {
        stopSAPI5();
    }
    speechSynthesis.cancel();
}

function clean(str: string) {
    const replacer = settings.store.latinOnly
        ? /[^\p{Script=Latin}\p{Number}\p{Punctuation}\s]/gu
        : /[^\p{Letter}\p{Number}\p{Punctuation}\s]/gu;
    return str.normalize("NFKC").replace(replacer, "").replace(/_{2,}/g, "_").trim();
}

interface FormatData {
    username: string;
    displayName: string;
    nickname: string;
    channel: string;
    server: string;
}

function formatText(str: string, data: FormatData) {
    return str
        .replaceAll("{username}", clean(data.username) || "Someone")
        .replaceAll("{display_name}", clean(data.displayName) || "Someone")
        .replaceAll("{nickname}", clean(data.nickname) || "Someone")
        .replaceAll("{channel}", clean(data.channel) || "channel")
        .replaceAll("{server}", clean(data.server) || "server");
}

let myLastChannelId: string | undefined;

function getTypeAndChannelId({ channelId, oldChannelId }: { channelId?: string; oldChannelId?: string; }, isMe: boolean) {
    if (isMe && channelId !== myLastChannelId) {
        oldChannelId = myLastChannelId;
        myLastChannelId = channelId;
    }
    if (channelId !== oldChannelId) {
        if (channelId) return [oldChannelId ? "move" : "join", channelId];
        if (oldChannelId) return ["leave", oldChannelId];
    }
    return ["", ""];
}

function SpeakIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00204H3C2.45 8.00204 2 8.45304 2 9.00204V15.002C2 15.552 2.45 16.002 3 16.002H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.002V4.00204C12 3.59904 11.757 3.23204 11.383 3.07904ZM14 9.00204C14 9.00204 16 10.002 16 12.002C16 14.002 14 15.002 14 15.002V9.00204ZM14 5.00204V7.00204C14 7.00204 18 8.00204 18 12.002C18 16.002 14 17.002 14 17.002V19.002C14 19.002 20 18.002 20 12.002C20 6.00204 14 5.00204 14 5.00204Z"/>
        </svg>
    );
}

function StopIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24">
            <rect fill="currentColor" x="6" y="6" width="12" height="12" rx="1"/>
        </svg>
    );
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    if (!message?.content) return;

    for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (child?.props?.id === "read-aloud") {
            children.splice(i, 1);
            continue;
        }
        if (Array.isArray(child?.props?.children)) {
            const arr = child.props.children;
            for (let j = arr.length - 1; j >= 0; j--) {
                if (arr[j]?.props?.id === "read-aloud") {
                    arr.splice(j, 1);
                }
            }
        }
    }

    children.push(
        <Menu.MenuItem
            id="voice-narrator-speak"
            key="voice-narrator-speak"
            label={isSpeaking ? "Stop Speaking" : "Speak Message"}
            icon={isSpeaking ? StopIcon : SpeakIcon}
            action={() => {
                if (isSpeaking) {
                    stopSpeaking();
                } else {
                    speak(message.content);
                }
            }}
        />
    );
};

export default definePlugin({
    name: "VoiceNarratorNatural",
    description: "TTS for voice events. Supports Windows Natural Voices via SAPI5.",
    authors: [{ name: "SrMoon", id: 0n }],
    reporterTestable: ReporterTestable.None,

    settings,

    contextMenus: {
        "message": messageContextMenuPatch
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: any[]; }) {
            const myGuildId = SelectedGuildStore.getGuildId();
            const myChanId = SelectedChannelStore.getVoiceChannelId();
            const myId = UserStore.getCurrentUser().id;
            if (!myChanId) return;
            if (ChannelStore.getChannel(myChanId)?.type === 13) return;

            const serverName = GuildStore.getGuild(myGuildId!)?.name || "server";

            for (const state of voiceStates) {
                const { userId, channelId, oldChannelId } = state;
                const isMe = userId === myId;

                if (!isMe && channelId !== myChanId && oldChannelId !== myChanId) continue;

                const user = UserStore.getUser(userId);
                if (!user) continue;

                const skipName = isMe && !settings.store.sayOwnName;
                const username = skipName ? "" : user.username;
                const displayName = skipName ? "" : ((user as any).globalName ?? user.username);
                const nickname = skipName ? "" : (GuildMemberStore.getNick(myGuildId!, userId) ?? displayName);

                const [type, id] = getTypeAndChannelId(state, isMe);
                if (type) {
                    const channelName = ChannelStore.getChannel(id)?.name || "channel";
                    speak(formatText(settings.store[type + "Message"], {
                        username, displayName, nickname, channel: channelName, server: serverName
                    }));
                    if (type === "leave") {
                        userStates.delete(userId);
                    } else if (type === "join") {
                        // Initialize state when user joins so we can detect their first mute/deafen
                        userStates.set(userId, {
                            mute: state.mute || state.selfMute,
                            deaf: state.deaf || state.selfDeaf
                        });
                    }
                    continue;
                }

                if (channelId === myChanId) {
                    const prevState = userStates.get(userId);
                    const currentMute = state.mute || state.selfMute;
                    const currentDeaf = state.deaf || state.selfDeaf;
                    const channelName = ChannelStore.getChannel(myChanId)?.name || "channel";

                    if (prevState) {
                        // Check deafen FIRST - when you deafen, Discord also mutes you
                        // so we need to prioritize deafen detection
                        if (prevState.deaf !== currentDeaf) {
                            const msgType = currentDeaf ? "deafen" : "undeafen";
                            speak(formatText(settings.store[msgType + "Message"], {
                                username, displayName, nickname, channel: channelName, server: serverName
                            }));
                        } else if (prevState.mute !== currentMute) {
                            const msgType = currentMute ? "mute" : "unmute";
                            speak(formatText(settings.store[msgType + "Message"], {
                                username, displayName, nickname, channel: channelName, server: serverName
                            }));
                        }
                    }

                    userStates.set(userId, { mute: currentMute, deaf: currentDeaf });
                }
            }
        }
    },

    async start() {
        const myChanId = SelectedChannelStore.getVoiceChannelId();
        if (myChanId) {
            const states = VoiceStateStore.getVoiceStatesForChannel(myChanId);
            if (states) {
                for (const [id, state] of Object.entries(states) as [string, any][]) {
                    userStates.set(id, {
                        mute: state.mute || state.selfMute,
                        deaf: state.deaf || state.selfDeaf
                    });
                }
            }
        }

        if (settings.store.ttsProvider === "sapi5") {
            const status = await Native.checkSetupStatus();
            if (status.ready) {
                if (!(await isServerRunning())) {
                    await Native.startServer();
                    await new Promise(r => setTimeout(r, 1500));
                }
                sapi5Voices = await getSAPI5Voices();
                sapi5Ready = sapi5Voices.length > 0;
            }
        }
    },

    stop() {
        stopSpeaking();
        userStates.clear();
    }
});
