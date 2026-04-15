/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import { useForceUpdater } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy, findStoreLazy } from "@webpack";
import { React, Toasts } from "@webpack/common";

import { StoreKey } from "./constants";
import { checkFileMime, getFileNative, getFileWeb, hexToBase64 } from "./utils";

const VoiceMessage = findComponentByCodeLazy("waveform:", "onVolumeChange");
const PanelButton = findComponentByCodeLazy(".GREEN,positionKeyStemOverride:");

const selectedChannelStore = findStoreLazy("SelectedChannelStore") as {
    getVoiceChannelId(): string | null;
} | null;
const voiceStateStore = findStoreLazy("VoiceStateStore") as {
    getVoiceStatesForChannel(channelId: string): Record<string, any>;
} | null;
const mediaEngineStore = findStoreLazy("MediaEngineStore") as {
    isDeaf(): boolean;
    isSelfDeaf(): boolean;
} | null;

let isPaused: boolean = false;
let lastAudioPlayTime: number = 0;
let audioContext: AudioContext | null = null;

const settings = definePluginSettings({
    useCustomAudio: {
        type: OptionType.BOOLEAN,
        description: "This can be any mp3, ogg, or wav file.",
        default: false
    },
    component: {
        type: OptionType.COMPONENT,
        component: CustomAudioComponent
    },
    volume: {
        type: OptionType.SLIDER,
        description: undefined as any,
        default: 100,
        markers: [25, 50, 75, 100]
    },
    delay: {
        type: OptionType.NUMBER,
        description: "How many seconds to wait before alerting again",
        default: 120
    },
    alertWhileAlone: {
        type: OptionType.BOOLEAN,
        description: "Alert if muted while alone in a voice channel",
        default: false
    }
});

export default definePlugin({
    name: "rzAlert",
    description: "بس شكل لا تتحمس",
    authors: [Devs.rz30],
    settings,

    flux: {
        VOICE_CHANNEL_SELECT: onVoiceChannelSelect
    },

    patches: [{
        find: "MediaEngineStore",
        replacement: {
            match: /(?<=getSpeakingWhileMuted\(\){)return (\i)(?=})/,
            replace: "$self.handleSpeaking($1); $&"
        }
    },
    {
        find: "renderNoiseCancellation",
        replacement: {
            match: /children:\[(?=\i\?this\.renderNoiseCancellation\(\))/,
            replace: "$&$self.pauseButton(),"
        }
    }],

    handleSpeaking(isSpeaking: boolean) {
        if (!isSpeaking || isPaused
            || lastAudioPlayTime && (Date.now() - lastAudioPlayTime) < (settings.store.delay * 1000)
            || (!selectedChannelStore?.getVoiceChannelId())
            || (mediaEngineStore?.isSelfDeaf())
            || (!settings.store.alertWhileAlone && isAlone())) {
            return;
        }

        lastAudioPlayTime = Date.now();
        playAudio();
    },
    pauseButton: ErrorBoundary.wrap(PauseButton, {
        noop: true,
        onError: e => {
            new Logger("MuteAlert").error("An error occurred while rendering the pause button:", e);
        }
    })
});

async function pickAudio(): Promise<string | undefined> {
    let hex: string | null;
    try {
        hex = await (IS_WEB ? getFileWeb("audio/ogg,audio/wav,audio/mp3") : getFileNative("Select Audio File", [{
            name: "Audio File",
            extensions: ["ogg", "wav", "mp3"]
        }]));
    } catch (e) {
        new Logger("MuteAlert").error("An error occurred while picking the audio file:", e);
        Toasts.show({
            id: Toasts.genId(),
            message: "An error occurred while picking the audio file, check the console for more information.",
            type: Toasts.Type.FAILURE
        });
        return;
    }
    if (!hex) {
        Toasts.show({
            id: Toasts.genId(),
            message: "User cancelled selection.",
            type: Toasts.Type.FAILURE
        });
        return;
    }

    const mime = checkFileMime(hex);
    if (mime === "unknown") {
        Toasts.show({
            id: Toasts.genId(),
            message: "The selected file is not a valid audio file.",
            type: Toasts.Type.FAILURE
        });
        return;
    }

    const base64 = hexToBase64(hex);
    const base64Uri = `data:${mime};base64,${base64}`;
    await setAudio(base64Uri);
    return base64Uri;
}

async function setAudio(base64Uri: string) {
    await DataStore.set(StoreKey, base64Uri);
}

async function getAudio(): Promise<string | undefined> {
    return await DataStore.get<string>(StoreKey);
}

async function removeAudio() {
    await DataStore.del(StoreKey);
}

function isAlone(): boolean {
    const currentChannelId = selectedChannelStore?.getVoiceChannelId();
    if (!currentChannelId || !voiceStateStore) {
        return false;
    }

    const channelStates = voiceStateStore.getVoiceStatesForChannel(currentChannelId);
    return Object.values(channelStates).length <= 1;
}

async function playAudio() {
    const base64 = await getAudio();

    if (!base64 || !settings.store.useCustomAudio) {
        if (!audioContext) {
            audioContext = new AudioContext();
        }
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        gain.gain.value = settings.store.volume / 100;

        osc.start();
        osc.stop(audioContext.currentTime + 0.2);
        return;
    }

    const audio = new Audio(base64);
    audio.volume = settings.store.volume / 100;
    audio.play();
}

function CustomAudioComponent(): React.ReactNode {
    const [base64Uri, setBase64Uri] = React.useState<string>("");

    React.useEffect(() => {
        getAudio().then(base64 => {
            if (base64) {
                setBase64Uri(base64);
            }
        });
    }, []);

    return (
        <>
            <div className="vc-muteAlert-buttonContainer">
                <Button disabled={!settings.store.useCustomAudio}
                    onClick={() => {
                        pickAudio().then(base64 => {
                            if (base64) {
                                setBase64Uri(base64);
                            }
                        });
                    }}>
                    Pick Audio
                </Button>

                <Button color={"RED"}
                    disabled={!settings.store.useCustomAudio || !base64Uri}
                    onClick={() => {
                        removeAudio();
                        setBase64Uri("");
                    }}>
                    Remove Audio
                </Button>
            </div>
            <div className={classes("vc-muteAlert-audioPlayerWrapper", settings.store.useCustomAudio && base64Uri ? null : "vc-muteAlert-audioPlayerWrapper-disabled")}
                onKeyDown={settings.store.useCustomAudio && base64Uri ? undefined : e => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }}>
                {VoiceMessage
                    ? <VoiceMessage key={new Date().getTime()}
                        src={base64Uri} />
                    : <audio key={new Date().getTime()}
                        src={base64Uri}
                        controls={true}
                        controlsList="nodownload noplaybackrate" />}
            </div>
        </>
    );
}

function PauseButton() {
    const forceUpdate = useForceUpdater();
    const onClick = () => {
        isPaused = !isPaused;
        lastAudioPlayTime = 0;
        forceUpdate();
    };

    if (!PanelButton) {
        return (
            <Button onClick={onClick}>
                {isPaused ? "Unpause" : "Pause"}
            </Button>
        );
    }

    return (
        <PanelButton tooltipText={isPaused ? "Unpause Mute Alert" : "Pause Mute Alert"}
            icon={getIcon()}
            role="switch"
            redGlow={isPaused}
            onClick={onClick}
        />
    );
}

function getIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill={isPaused ? "var(--status-danger)" : "currentColor"}
                d={isPaused
                    ? "M1.3 21.3a1 1 0 1 0 1.4 1.4l20-20a1 1 0 0 0-1.4-1.4l-20 20ZM3.13 16.13c.11.27.46.28.66.08L15.73 4.27a.47.47 0 0 0-.07-.74 6.97 6.97 0 0 0-1.35-.64.62.62 0 0 1-.38-.43 2 2 0 0 0-3.86 0 .62.62 0 0 1-.38.43A7 7 0 0 0 5 9.5v2.09a.5.5 0 0 1-.13.33l-1.1 1.22A3 3 0 0 0 3 15.15v.28c0 .24.04.48.13.7ZM18.64 9.36c.13-.13.36-.05.36.14v2.09c0 .12.05.24.13.33l1.1 1.22a3 3 0 0 1 .77 2.01v.28c0 .67-.34 1.29-.95 1.56-1.31.6-4 1.51-8.05 1.51-.46 0-.9-.01-1.33-.03a.48.48 0 0 1-.3-.83l8.27-8.28ZM9.18 19.84A.16.16 0 0 0 9 20a3 3 0 1 0 6 0c0-.1-.09-.17-.18-.16a24.84 24.84 0 0 1-5.64 0Z"
                    : "M9.7 2.89c.18-.07.32-.24.37-.43a2 2 0 0 1 3.86 0c.05.2.19.36.38.43A7 7 0 0 1 19 9.5v2.09c0 .12.05.24.13.33l1.1 1.22a3 3 0 0 1 .77 2.01v.28c0 .67-.34 1.29-.95 1.56-1.31.6-4 1.51-8.05 1.51-4.05 0-6.74-.91-8.05-1.5-.61-.28-.95-.9-.95-1.57v-.28a3 3 0 0 1 .77-2l1.1-1.23a.5.5 0 0 0 .13-.33V9.5a7 7 0 0 1 4.7-6.61ZM9.18 19.84A.16.16 0 0 0 9 20a3 3 0 1 0 6 0c0-.1-.09-.17-.18-.16a24.86 24.86 0 0 1-5.64 0Z"}
            />
        </svg>
    );
}

function onVoiceChannelSelect(data) {
    if (!data.channelId && data.currentVoiceChannelId) {
        isPaused = false;
        lastAudioPlayTime = 0;
    }
}
