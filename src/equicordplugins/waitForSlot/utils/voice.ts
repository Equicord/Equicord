import { Logger } from "@utils/Logger";
import { findByPropsLazy } from "@webpack";
import { VoiceStateStore } from "@webpack/common";

const logger = new Logger("WaitForSlot");
const { selectVoiceChannel } = findByPropsLazy("selectVoiceChannel", "selectChannel");

const NOTIFICATION_SOUND = {
    startHz: 800,
    peakHz: 1000,
    stepSeconds: 0.1,
    durationSeconds: 0.3,
    gainStart: 0.3,
    gainEnd: 0.01,
} as const;

export function getVoiceChannelUserCount(channelId: string): number {
    const voiceStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
    return voiceStates ? Object.keys(voiceStates).length : 0;
}

export function isChannelFull(channelId: string, userLimit?: number | null): boolean {
    if (!userLimit) return false;
    return getVoiceChannelUserCount(channelId) >= userLimit;
}

export function joinVoiceChannel(channelId: string) {
    try {
        selectVoiceChannel(channelId);
    } catch (error) {
        logger.error("Error calling selectVoiceChannel", error);
        throw error;
    }
}

export function playNotificationSound() {
    try {
        const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext; }).webkitAudioContext;
        if (!AudioContextCtor) return;
        const audioContext = new AudioContextCtor();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(NOTIFICATION_SOUND.startHz, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(NOTIFICATION_SOUND.peakHz, audioContext.currentTime + NOTIFICATION_SOUND.stepSeconds);
        oscillator.frequency.setValueAtTime(NOTIFICATION_SOUND.startHz, audioContext.currentTime + (NOTIFICATION_SOUND.stepSeconds * 2));
        gainNode.gain.setValueAtTime(NOTIFICATION_SOUND.gainStart, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(NOTIFICATION_SOUND.gainEnd, audioContext.currentTime + NOTIFICATION_SOUND.durationSeconds);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + NOTIFICATION_SOUND.durationSeconds);
        oscillator.addEventListener("ended", () => {
            audioContext.close().catch(() => { });
        });
    } catch (error) {
        logger.warn("Could not play notification sound", error);
    }
}
