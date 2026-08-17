/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Microphone } from "@components/Icons";
import { classNameFactory } from "@utils/css";
import { useFixedTimer } from "@utils/react";
import { formatDuration } from "@utils/text";
import { ChannelRouter, ChannelStore, SelectedChannelStore, Slider, Tooltip, useStateFromStores } from "@webpack/common";
import type { ComponentProps, ComponentType } from "react";

import { getPlaybackSnapshot, seekPlayback, setPlaybackSpeed, stopPlayback, togglePlayback } from "./playback";

const cl = classNameFactory("vc-vmib-");
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
type ControlledSliderProps = ComponentProps<typeof Slider> & { value?: number; };

const ControlledSlider: ComponentType<ControlledSliderProps> = Slider;

export const VoiceMessageIcon = Microphone;

function PlayPauseIcon({ paused }: { paused: boolean; }) {
    return (
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <path fill="currentColor" d={paused ? "M8 5v14l11-7Z" : "M6 5h4v14H6Zm8 0h4v14h-4Z"} />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
            <path fill="currentColor" d="m6.7 5.3 5.3 5.29 5.3-5.3 1.4 1.42-5.29 5.3 5.3 5.29-1.42 1.4-5.3-5.29-5.29 5.3-1.4-1.42 5.29-5.3-5.3-5.29Z" />
        </svg>
    );
}

function time(seconds: number) {
    return formatDuration(Math.max(0, seconds) * 1000);
}

export function VoiceMessagesInBackgroundPlayer() {
    useFixedTimer({ interval: 50 });
    const snapshot = getPlaybackSnapshot();
    const selectedChannelId = useStateFromStores(
        [SelectedChannelStore],
        () => SelectedChannelStore.getChannelId()
    );
    const channel = useStateFromStores(
        [ChannelStore],
        () => snapshot?.channelId ? ChannelStore.getChannel(snapshot.channelId) : undefined,
        [snapshot?.channelId]
    );

    if (!snapshot || snapshot.channelId === selectedChannelId) return null;

    const channelName = channel?.name ?? "Direct message";
    const duration = Math.max(snapshot.duration, snapshot.position, 1);
    const position = Math.min(snapshot.position, duration);
    const nextSpeed = SPEEDS[(SPEEDS.findIndex(speed => speed === snapshot.speed) + 1) % SPEEDS.length];

    return (
        <div className={cl("player", { playing: !snapshot.paused })} aria-label="Voice Messages In-Background player">
            <div className={cl("voice-icon")}>
                <Microphone width={17} height={17} />
            </div>
            <Tooltip text={snapshot.paused ? "Resume voice message" : "Pause voice message"}>
                {tooltipProps => (
                    <Button
                        {...tooltipProps}
                        aria-label={snapshot.paused ? "Resume voice message" : "Pause voice message"}
                        className={cl("control")}
                        size="iconOnly"
                        variant="none"
                        onClick={togglePlayback}
                    >
                        <PlayPauseIcon paused={snapshot.paused} />
                    </Button>
                )}
            </Tooltip>
            <Button
                aria-label={`Return to ${channelName}`}
                className={cl("origin")}
                disabled={!snapshot.channelId}
                size="min"
                variant="none"
                onClick={() => snapshot.channelId && ChannelRouter.transitionToChannel(snapshot.channelId)}
            >
                <span className={cl("origin-copy")}>
                    <span className={cl("title")}>Voice message</span>
                    <span className={cl("channel")}>{channelName}</span>
                </span>
            </Button>
            <div className={cl("timeline")}>
                <span className={cl("time")}>{time(position)}</span>
                <ControlledSlider
                    key={snapshot.src}
                    aria-label="Voice message position"
                    asValueChanges={seekPlayback}
                    className={cl("seek")}
                    handleSize={10}
                    hideBubble
                    initialValue={position}
                    maxValue={duration}
                    minValue={0}
                    mini
                    onValueChange={seekPlayback}
                    onValueRender={time}
                    value={position}
                />
                <span className={cl("time")}>{time(snapshot.duration)}</span>
            </div>
            <Tooltip text="Change playback speed">
                {tooltipProps => (
                    <Button
                        {...tooltipProps}
                        aria-label={`Playback speed ${snapshot.speed} times`}
                        className={cl("speed")}
                        size="min"
                        variant="none"
                        onClick={() => setPlaybackSpeed(nextSpeed)}
                    >
                        {snapshot.speed}×
                    </Button>
                )}
            </Tooltip>
            <Tooltip text="Close voice message player">
                {tooltipProps => (
                    <Button
                        {...tooltipProps}
                        aria-label="Close voice message player"
                        className={cl("control", "close")}
                        size="iconOnly"
                        variant="none"
                        onClick={stopPlayback}
                    >
                        <CloseIcon />
                    </Button>
                )}
            </Tooltip>
        </div>
    );
}
