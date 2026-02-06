import { Logger } from "@utils/Logger";
import { findByPropsLazy } from "@webpack";
import { VoiceStateStore } from "@webpack/common";

const logger = new Logger("WaitForSlot");
const { selectVoiceChannel } = findByPropsLazy("selectVoiceChannel", "selectChannel");

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
        const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        const audioContext = new AudioContextCtor();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        oscillator.addEventListener("ended", () => {
            audioContext.close().catch(() => {});
        });
    } catch (error) {
        logger.warn("Could not play notification sound", error);
    }
}