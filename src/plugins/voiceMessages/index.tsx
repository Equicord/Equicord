/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Card } from "@components/Card";
import { Microphone } from "@components/Icons";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { lastState as silentMessageEnabled } from "@plugins/silentMessageToggle";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { t, Translate } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { chooseFile } from "@utils/web";
import { RenderModalProps } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { Button, CloudUploader, Constants, FluxDispatcher, Forms, lodash, Menu, MessageActions, Modal, openModal, PendingReplyStore, PermissionsBits, PermissionStore, RestAPI, SelectedChannelStore, showToast, SnowflakeUtils, Toasts, useEffect, useState } from "@webpack/common";
import { ComponentType } from "react";

import { VoiceRecorderDesktop } from "./components/DesktopRecorder";
import { VoiceMessageProps, VoicePreview } from "./components/VoicePreview";
import { VoiceRecorderWeb } from "./components/WebRecorder";

const VOICE_MESSAGE_FLAG = 1 << 13;
const SILENT_MESSAGE_FLAG = 4096;
const DEFAULT_WAVEFORM = "AAAAAAAAAAAA";
const DEFAULT_DURATION = 1;
const WAVEFORM_MIN_BINS = 32;
const WAVEFORM_MAX_BINS = 256;
const WAVEFORM_BINS_PER_SECOND = 10;
const WAVEFORM_MAX_VALUE = 0xFF;

const EMPTY_META: AudioMetadata = {
    waveform: DEFAULT_WAVEFORM,
    duration: DEFAULT_DURATION,
};

export const cl = classNameFactory("vc-vmsg-");

export type VoiceRecorder = React.ComponentType<{
    setAudioBlob(blob: Blob): void;
    onRecordingChange?(recording: boolean): void;
}>;

export let VoiceMessage: ComponentType<VoiceMessageProps> = () => null;

const VoiceRecorder = IS_DISCORD_DESKTOP ? VoiceRecorderDesktop : VoiceRecorderWeb;

export const settings = definePluginSettings({
    noiseSuppression: {
        type: OptionType.BOOLEAN,
        description: t("vencord.voiceMessages.noiseSuppression"),
        default: true,
    },
    echoCancellation: {
        type: OptionType.BOOLEAN,
        description: t("vencord.voiceMessages.echoCancellation"),
        default: true,
    },
});

const ctxMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (props.channel.guild_id && !(PermissionStore.can(PermissionsBits.SEND_VOICE_MESSAGES, props.channel) && PermissionStore.can(PermissionsBits.SEND_MESSAGES, props.channel))) return;

    children.push(
        <Menu.MenuItem
            id="vc-send-vmsg"
            iconLeft={Microphone}
            leadingAccessory={{
                type: "icon",
                icon: Microphone
            }}
            label={t("vencord.voiceMessages.send")}
            action={() => openModal(modalProps => <VoiceMessageModal modalProps={modalProps} />)}
        />
    );
};

export default definePlugin({
    name: "VoiceMessages",
    description: t("vencord.voiceMessages.description"),
    authors: [Devs.Ven, Devs.Vap, Devs.Nickyux, EquicordDevs.Z1xus, Devs.prism],
    tags: ["Voice"],
    settings,

    patches: [
        {
            find: "#{intl::PAUSE_VOICE_MESSAGE_A11Y_LABEL}",
            replacement: {
                match: /(?<=\i=)(?=\i\.memo\(.{0,50}?=1,onVolumeChange:[^}]+?waveform:[^}]+?playbackCacheKey:)/,
                replace: "$self.VoiceMessage=",
            }
        }
    ],

    set VoiceMessage(value) {
        VoiceMessage = value;
    },

    contextMenus: {
        "channel-attach": ctxMenuPatch
    }
});

type AudioMetadata = {
    waveform: string,
    duration: number,
};

function generateWaveform(audioBuffer: AudioBuffer): string {
    const channelData = audioBuffer.getChannelData(0);
    const binCount = lodash.clamp(
        Math.floor(audioBuffer.duration * WAVEFORM_BINS_PER_SECOND),
        Math.min(WAVEFORM_MIN_BINS, channelData.length),
        WAVEFORM_MAX_BINS
    );

    const bins = new Uint8Array(binCount);
    const samplesPerBin = Math.floor(channelData.length / binCount);

    for (let binIdx = 0; binIdx < binCount; binIdx++) {
        let sum = 0;
        for (let sampleIdx = 0; sampleIdx < samplesPerBin; sampleIdx++) {
            const offset = binIdx * samplesPerBin + sampleIdx;
            sum += channelData[offset + sampleIdx] ** 2;
        }
        bins[binIdx] = Math.floor(Math.sqrt(sum / samplesPerBin) * WAVEFORM_MAX_VALUE);
    }

    const maxBin = Math.max(...bins);
    if (maxBin) {
        const easing = Math.min(1, 100 * (maxBin / WAVEFORM_MAX_VALUE) ** 3);
        const ratio = 1 + (WAVEFORM_MAX_VALUE / maxBin - 1) * easing;
        for (let i = 0; i < binCount; i++) {
            bins[i] = Math.min(WAVEFORM_MAX_VALUE, Math.floor(bins[i] * ratio));
        }
    }

    return window.btoa(String.fromCharCode(...bins));
}

function sendAudio(blob: Blob, meta: AudioMetadata) {
    const channelId = SelectedChannelStore.getChannelId();
    const reply = PendingReplyStore.getPendingReply(channelId);
    if (reply) FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId });

    const upload = new CloudUploader({
        file: new File([blob], "voice-message.ogg", { type: "audio/ogg; codecs=opus" }),
        isThumbnail: false,
        platform: CloudUploadPlatform.WEB,
    }, channelId);

    upload.on("complete", () => {
        RestAPI.post({
            url: Constants.Endpoints.MESSAGES(channelId),
            body: {
                flags: VOICE_MESSAGE_FLAG | (silentMessageEnabled ? SILENT_MESSAGE_FLAG : 0),
                channel_id: channelId,
                content: "",
                nonce: SnowflakeUtils.fromTimestamp(Date.now()),
                sticker_ids: [],
                type: 0,
                attachments: [{
                    id: "0",
                    filename: upload.filename,
                    uploaded_filename: upload.uploadedFilename,
                    waveform: meta.waveform,
                    duration_secs: meta.duration,
                }],
                message_reference: reply ? MessageActions.getSendMessageOptionsForReply(reply)?.messageReference : null,
            }
        });
    });
    upload.on("error", () => showToast(t("vencord.voiceMessages.failedToUpload"), Toasts.Type.FAILURE));

    upload.upload();
}

function useObjectUrl() {
    const [url, setUrl] = useState<string>();
    const setWithFree = (blob: Blob) => {
        if (url) URL.revokeObjectURL(url);
        setUrl(URL.createObjectURL(blob));
    };

    return [url, setWithFree] as const;
}

function VoiceMessageModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const [isRecording, setRecording] = useState(false);
    const [blob, setBlob] = useState<Blob>();
    const [blobUrl, setBlobUrl] = useObjectUrl();

    useEffect(() => () => {
        if (blobUrl)
            URL.revokeObjectURL(blobUrl);
    }, [blobUrl]);

    const [meta, metaError] = useAwaiter(async () => {
        if (!blob) return EMPTY_META;

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer());

        return {
            waveform: generateWaveform(audioBuffer),
            duration: audioBuffer.duration,
        };
    }, {
        deps: [blob],
        fallbackValue: EMPTY_META,
    });

    const isUnsupportedFormat = blob && (!blob.type.startsWith("audio/ogg") || blob.type.includes("codecs") && !blob.type.includes("opus"));

    return (
        <Modal
            {...modalProps}
            title={t("vencord.voiceMessages.recordModal")}
            actions={[{
                text: t("vencord.voiceMessages.send"),
                variant: "primary",
                onClick: () => {
                    sendAudio(blob!, meta ?? EMPTY_META);
                    modalProps.onClose();
                    showToast(t("vencord.voiceMessages.sending"), Toasts.Type.MESSAGE);
                },
                disabled: !blob
            }]}
        >
            <div className={cl("buttons")}>
                <VoiceRecorder
                    setAudioBlob={blob => {
                        setBlob(blob);
                        setBlobUrl(blob);
                    }}
                    onRecordingChange={setRecording}
                />

                <Button
                    onClick={async () => {
                        const file = await chooseFile("audio/*");
                        if (file) {
                            setBlob(file);
                            setBlobUrl(file);
                        }
                    }}
                >
                    {t("vencord.voiceMessages.uploadFile")}
                </Button>
            </div>

            <Forms.FormTitle>{t("vencord.voiceMessages.preview")}</Forms.FormTitle>
            {metaError
                ? <Paragraph className={cl("error")}>{t("vencord.voiceMessages.failedToParse", { error: metaError.message })}</Paragraph>
                : (
                    <VoicePreview
                        src={blobUrl}
                        waveform={meta.waveform}
                        recording={isRecording}
                    />
                )}

            {isUnsupportedFormat && (
                <Card variant="warning" className={Margins.top16} defaultPadding>
                    <Forms.FormText>
                        <Translate i18nKey="vencord.voiceMessages.iosWarning" variables={{ type: blob.type }}>
                            Voice Messages have to be OggOpus to be playable on iOS. This file is <code>{blob.type}</code> so it will not be playable on iOS.
                        </Translate>
                    </Forms.FormText>

                    <Forms.FormText className={Margins.top8}>
                        <Translate i18nKey="vencord.voiceMessages.iosFix">
                            To fix it, first convert it to OggOpus, for example using the <Link href="https://convertio.co/mp3-opus/">convertio web converter</Link>
                        </Translate>
                    </Forms.FormText>
                </Card>
            )}
        </Modal>
    );
}
