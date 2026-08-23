/*
 * betterMicQuality — an Equicord userplugin
 *
 * v2: adds "Raw Voice" (strips every layer of software audio processing,
 * including legacy Chromium-only flags Discord's spec-compliant constraints
 * don't cover) and "High Bitrate Bypass" (pushes the Opus encoder toward
 * 512kbps and disables the codec-level tricks that quietly cost fidelity:
 * DTX silence-gating and CBR quantization).
 *
 * HONEST LIMITS, read before you assume this makes you "lossless":
 *   - Discord's WebRTC pipeline only ever transmits Opus. Opus is a lossy
 *     codec, full stop. Nothing client-side can make it PCM/FLAC-lossless.
 *   - Discord's voice servers negotiate/cap the accepted bitrate on their
 *     end. This plugin requests up to 512kbps from your own encoder; what
 *     actually gets through depends on what Discord's server accepts for
 *     that call. You should still hear a real improvement, but 512kbps is
 *     a ceiling you're asking for, not a guarantee.
 *   - Windows applies its own mic processing (AGC/noise suppression) at
 *     the driver level, before the browser ever sees the audio. No browser-
 *     level plugin can undo that. For a Yeti: Sound Settings > your Yeti >
 *     Properties > disable "Audio Enhancements".
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    rawVoice: {
        type: OptionType.BOOLEAN,
        description: "RAW Voice — bypass ALL software processing (echo cancellation, noise suppression, AGC, highpass filter, typing-noise detection). Overrides the three toggles below when on.",
        default: true,
        restartNeeded: false,
    },
    disableEchoCancellation: {
        type: OptionType.BOOLEAN,
        description: "Disable echo cancellation individually (ignored if Raw Voice is on).",
        default: true,
        restartNeeded: false,
    },
    disableNoiseSuppression: {
        type: OptionType.BOOLEAN,
        description: "Disable noise suppression individually (ignored if Raw Voice is on).",
        default: true,
        restartNeeded: false,
    },
    disableAutoGainControl: {
        type: OptionType.BOOLEAN,
        description: "Disable automatic gain control individually (ignored if Raw Voice is on).",
        default: true,
        restartNeeded: false,
    },
    stereo: {
        type: OptionType.BOOLEAN,
        description: "Capture and encode in stereo instead of mono (Yeti Classic supports stereo capture).",
        default: true,
        restartNeeded: false,
    },
    sampleRate: {
        type: OptionType.SELECT,
        description: "Microphone sample rate to request.",
        options: [
            { label: "48 kHz (recommended, matches Opus native rate)", value: 48000, default: true },
            { label: "44.1 kHz", value: 44100 },
            { label: "96 kHz (only if your audio interface truly supports it)", value: 96000 },
        ],
    },
    highResCapture: {
        type: OptionType.BOOLEAN,
        description: "Request 24-bit sample depth instead of the default 16-bit (harmless if your mic/driver doesn't support it — it just gets ignored).",
        default: true,
        restartNeeded: false,
    },
    bitrate: {
        type: OptionType.SLIDER,
        description: "High Bitrate Bypass — target outgoing Opus bitrate in kbps. Discord's own UI tops out far lower than this.",
        markers: [8, 16, 32, 64, 96, 128, 192, 256, 320, 384, 450, 512],
        default: 320,
        stickToMarkers: false,
    },
    disableDtx: {
        type: OptionType.BOOLEAN,
        description: "Disable Opus DTX (discontinuous transmission). DTX quietly drops your stream to near-silence during pauses to save bandwidth — bad for musicians who want continuous full-fidelity signal.",
        default: true,
        restartNeeded: false,
    },
    forceCbr: {
        type: OptionType.BOOLEAN,
        description: "Force constant bitrate instead of variable. Off (VBR) generally sounds better per kbps; only enable this if you specifically need a fixed, predictable bitrate.",
        default: false,
        restartNeeded: false,
    },
    blockTrackReplacement: {
        type: OptionType.BOOLEAN,
        description: "EXPERIMENTAL — blocks Discord from swapping your raw mic track for a processed one mid-call (fights Krisp/denoising that isn't controlled by the Noise Suppression checkbox). Only blocks same-device swaps; switching mics still works. Disable this immediately if your mic stops transmitting.",
        default: false,
        restartNeeded: false,
    },
});

let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia;
let originalRTCPeerConnection: typeof RTCPeerConnection;
let originalApplyConstraints: typeof MediaStreamTrack.prototype.applyConstraints;
let originalReplaceTrack: typeof RTCRtpSender.prototype.replaceTrack;

// Shared by both getUserMedia (new streams) and applyConstraints (existing
// tracks). Discord doesn't always request a fresh stream — the mic test
// button, automatic input-sensitivity calibration, and the voice settings
// modal frequently call track.applyConstraints() directly on a track it
// already has open, which would silently put Discord's defaults back if we
// only patched getUserMedia. This is almost certainly why quality flip-
// flopped between "perfect" and "bad" during testing.
function buildAudioConstraints(existing: MediaTrackConstraints): MediaTrackConstraints & Record<string, unknown> {
    const audio: MediaTrackConstraints & Record<string, unknown> = { ...existing };
    const raw = settings.store.rawVoice;

    audio.echoCancellation = raw ? false : !settings.store.disableEchoCancellation;
    audio.noiseSuppression = raw ? false : !settings.store.disableNoiseSuppression;
    audio.autoGainControl = raw ? false : !settings.store.disableAutoGainControl;

    if (settings.store.stereo) audio.channelCount = 2;
    audio.sampleRate = Number(settings.store.sampleRate) || 48000;
    if (settings.store.highResCapture) audio.sampleSize = 24;

    if (raw) {
        audio.googEchoCancellation = false;
        audio.googAutoGainControl = false;
        audio.googNoiseSuppression = false;
        audio.googHighpassFilter = false;
        audio.googTypingNoiseDetection = false;
        audio.googAudioMirroring = false;
    }

    return audio;
}

function patchAudioConstraints(constraints: MediaStreamConstraints): MediaStreamConstraints {
    if (!constraints?.audio) return constraints;
    const existing = typeof constraints.audio === "object" ? constraints.audio : {};
    return { ...constraints, audio: buildAudioConstraints(existing) };
}

function setOrReplaceFmtpParam(fmtpLine: string, key: string, value: string): string {
    const regex = new RegExp(`${key}=\\S+`);
    return regex.test(fmtpLine)
        ? fmtpLine.replace(regex, `${key}=${value}`)
        : `${fmtpLine};${key}=${value}`;
}

function tuneOpusSdp(sdp: string): string {
    const lines = sdp.split("\r\n");
    const opusLine = lines.find(l => /^a=rtpmap:\d+ opus\/48000/i.test(l));
    if (!opusLine) return sdp;

    const payloadType = opusLine.match(/^a=rtpmap:(\d+)/)![1];
    const bitrateBps = Math.round(Number(settings.store.bitrate) * 1000);
    const stereoFlag = settings.store.stereo ? "1" : "0";
    const dtxFlag = settings.store.disableDtx ? "0" : "1";
    const cbrFlag = settings.store.forceCbr ? "1" : "0";

    let foundFmtp = false;
    const newLines = lines.map(line => {
        if (!line.startsWith(`a=fmtp:${payloadType} `)) return line;
        foundFmtp = true;
        let updated = line;
        updated = setOrReplaceFmtpParam(updated, "maxaveragebitrate", String(bitrateBps));
        updated = setOrReplaceFmtpParam(updated, "stereo", stereoFlag);
        updated = setOrReplaceFmtpParam(updated, "sprop-stereo", stereoFlag);
        updated = setOrReplaceFmtpParam(updated, "usedtx", dtxFlag);
        updated = setOrReplaceFmtpParam(updated, "cbr", cbrFlag);
        updated = setOrReplaceFmtpParam(updated, "useinbandfec", "1");
        updated = setOrReplaceFmtpParam(updated, "maxplaybackrate", "48000");
        updated = setOrReplaceFmtpParam(updated, "sprop-maxcapturerate", "48000");
        return updated;
    });

    if (!foundFmtp) {
        const idx = newLines.findIndex(l => l.startsWith(`a=rtpmap:${payloadType} `));
        newLines.splice(
            idx + 1,
            0,
            `a=fmtp:${payloadType} maxaveragebitrate=${bitrateBps};stereo=${stereoFlag};sprop-stereo=${stereoFlag};usedtx=${dtxFlag};cbr=${cbrFlag};useinbandfec=1;maxplaybackrate=48000;sprop-maxcapturerate=48000`
        );
    }

    return newLines.join("\r\n");
}

async function applyBitrate(sender: RTCRtpSender) {
    if (!sender || sender.track?.kind !== "audio") return;
    try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        params.encodings[0].maxBitrate = Math.round(Number(settings.store.bitrate) * 1000);
        await sender.setParameters(params);
    } catch (e) {
        console.warn("[betterMicQuality] Could not set encoding params yet:", e);
    }
}

const trackedConnections = new Set<RTCPeerConnection>();

// Remembers the deviceId of the raw track we originally attached to each
// audio sender, so we can tell "Discord swapped in a denoised version of
// the SAME mic" (block it) apart from "user actually picked a different
// mic" (allow it).
const senderRawDeviceId = new WeakMap<RTCRtpSender, string | undefined>();

function buildPatchedPeerConnection() {
    return class PatchedRTCPeerConnection extends originalRTCPeerConnection {
        constructor(config?: RTCConfiguration) {
            super(config);
            trackedConnections.add(this);

            this.addEventListener("connectionstatechange", () => {
                if (this.connectionState === "connected") {
                    this.getSenders().filter(s => s.track?.kind === "audio").forEach(applyBitrate);
                } else if (this.connectionState === "closed") {
                    trackedConnections.delete(this);
                }
            });
        }

        addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender {
            const sender = super.addTrack(track, ...streams);
            if (track.kind === "audio") {
                senderRawDeviceId.set(sender, track.getSettings().deviceId);
                applyBitrate(sender);
            }
            return sender;
        }

        async setLocalDescription(description?: RTCLocalSessionDescriptionInit): Promise<void> {
            if (description?.sdp && description.type === "offer") {
                description = { ...description, sdp: tuneOpusSdp(description.sdp) };
            }
            return super.setLocalDescription(description as RTCSessionDescriptionInit);
        }
    };
}

function patchRtpSenderReplaceTrack() {
    return function (
        this: RTCRtpSender,
        withTrack: MediaStreamTrack | null
    ): Promise<void> {
        if (
            settings.store.blockTrackReplacement &&
            this.track?.kind === "audio" &&
            withTrack?.kind === "audio"
        ) {
            const originalDeviceId = senderRawDeviceId.get(this);
            const incomingDeviceId = withTrack.getSettings().deviceId;

            // Same physical mic, different track object → almost certainly a
            // post-processed (denoised) swap-in, not a genuine device change.
            // Keep the raw track instead of accepting the replacement.
            if (originalDeviceId && originalDeviceId === incomingDeviceId) {
                console.info("[betterMicQuality] Blocked same-device track replacement (likely Krisp/denoising swap-in)");
                return Promise.resolve();
            }

            // Genuinely a new device — allow it, and remember its id too.
            senderRawDeviceId.set(this, incomingDeviceId);
        }

        return originalReplaceTrack.call(this, withTrack);
    };
}

export default definePlugin({
    name: "BetterMicQuality",
    description: "RAW Voice mode strips all mic processing, plus a High Bitrate Bypass slider up to 512kbps for the cleanest signal Discord's Opus pipeline can carry.",
    authors: [
        {
            name: "YourName", // replace with your name
            id: 770744865675149323n,
        },
    ],
    settings,

    start() {
        originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = (constraints?: MediaStreamConstraints) => {
            return originalGetUserMedia(patchAudioConstraints(constraints ?? {}));
        };

        originalRTCPeerConnection = window.RTCPeerConnection;
        window.RTCPeerConnection = buildPatchedPeerConnection() as unknown as typeof RTCPeerConnection;

        // Catches Discord re-applying its own constraints to an already-open
        // track (mic test, auto sensitivity calibration, settings modal).
        originalApplyConstraints = MediaStreamTrack.prototype.applyConstraints;
        MediaStreamTrack.prototype.applyConstraints = function (
            this: MediaStreamTrack,
            constraints?: MediaTrackConstraints
        ) {
            const patched = this.kind === "audio"
                ? buildAudioConstraints(constraints ?? {})
                : constraints;
            return originalApplyConstraints.call(this, patched);
        };

        originalReplaceTrack = RTCRtpSender.prototype.replaceTrack;
        RTCRtpSender.prototype.replaceTrack = patchRtpSenderReplaceTrack();
    },

    stop() {
        if (originalGetUserMedia) navigator.mediaDevices.getUserMedia = originalGetUserMedia;
        if (originalRTCPeerConnection) window.RTCPeerConnection = originalRTCPeerConnection;
        if (originalApplyConstraints) MediaStreamTrack.prototype.applyConstraints = originalApplyConstraints;
        if (originalReplaceTrack) RTCRtpSender.prototype.replaceTrack = originalReplaceTrack;
        trackedConnections.clear();
    },
});
