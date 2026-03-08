/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { sleep, tryOrElse } from "@utils/misc";
import { closeModal, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Channel, VideoDevice } from "@vencord/discord-types";
import { findByPropsLazy, findExportedComponentLazy } from "@webpack";
import { Checkbox, DraftType, Menu, SearchableSelect, showToast, Toasts, UploadHandler, useEffect, useState } from "@webpack/common";

const IMAGE_TYPE = "image/png";
const IMAGE_NAME_PREFIX = "webcam";
const CameraIcon = findExportedComponentLazy("CameraIcon");
const configModule = findByPropsLazy("getVideoDeviceId", "getVideoDevices");
const mediaEngineStore = findByPropsLazy("getCameraComponent", "getVideoDeviceId");
const cl = classNameFactory("vc-webcam-picture-");

let captureVideoElement: HTMLVideoElement | null = null;
let shouldCaptureVideoElement = false;

const getConfigModule = () => tryOrElse(() => configModule, null);

const getCameraComponent = () => tryOrElse(() => mediaEngineStore.getCameraComponent?.() ?? null, null);

type WebcamModalProps = {
    modalProps: ModalProps;
    close(): void;
    channel: Channel;
};

const WebcamModal = ErrorBoundary.wrap(function WebcamModal({ modalProps, close, channel }: WebcamModalProps) {
    const CameraComponent = getCameraComponent();
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSnapping, setIsSnapping] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [timerEnabled, setTimerEnabled] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => getConfigModule()?.getVideoDeviceId?.() ?? "");
    const [videoDevices, setVideoDevices] = useState<VideoDevice[]>([]);

    useEffect(() => {
        captureVideoElement = null;

        return () => {
            captureVideoElement = null;
        };
    }, [selectedDeviceId]);

    useEffect(() => {
        if (!CameraComponent) {
            setError("Webcam is not supported on this client.");
            return;
        }

        let cancelled = false;

        void (async () => {
            setError(null);
            setReady(false);

            const devices = tryOrElse(
                () => Object.values(getConfigModule()?.getVideoDevices?.() ?? {}) as VideoDevice[],
                []
            );
            if (cancelled) return;
            setVideoDevices(devices);

            const resolvedDevice = devices.find(device => device.id === selectedDeviceId) ?? devices[0];
            if (!resolvedDevice) {
                setError("No camera was found.");
                return;
            }

            if (resolvedDevice.id !== selectedDeviceId) {
                setSelectedDeviceId(resolvedDevice.id);
                return;
            }

            setError(null);
            setReady(true);
        })();

        return () => { cancelled = true; };
    }, [CameraComponent, selectedDeviceId]);

    const captureFrame = async () => {
        const video = captureVideoElement;
        if (!video) return;

        if (!video.videoWidth || !video.videoHeight) {
            showToast("Webcam is not ready yet.", Toasts.Type.FAILURE);
            return;
        }

        setIsSnapping(true);
        try {
            const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
            const context = canvas.getContext("2d");
            if (!context) {
                showToast("Failed to capture webcam picture.", Toasts.Type.FAILURE);
                return;
            }

            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

            const blob = await canvas.convertToBlob({ type: IMAGE_TYPE }).catch(() => null);
            if (!blob) {
                showToast("Failed to capture webcam picture.", Toasts.Type.FAILURE);
                return;
            }

            const file = new File([blob], `${IMAGE_NAME_PREFIX}-${Date.now()}.png`, { type: IMAGE_TYPE });

            try {
                await UploadHandler.promptToUpload([file], channel, DraftType.ChannelMessage);
                close();
            } catch {
                showToast("Failed to attach webcam picture.", Toasts.Type.FAILURE);
            }
        } finally {
            setIsSnapping(false);
        }
    };

    const snapAndAttach = async () => {
        if (!timerEnabled) {
            await captureFrame();
            return;
        }

        for (const next of [3, 2, 1]) {
            setCountdown(next);
            await sleep(1000);
        }

        setCountdown(0);
        await captureFrame();
    };

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader className={cl("header")}>
                <Heading className={cl("title")}>Ready to take a picture?</Heading>
                <ModalCloseButton onClick={close} />
            </ModalHeader>

            <ModalContent className={cl("content")}>
                <div className={cl("preview-wrap")}>
                    {!error && CameraComponent && (
                        <div className={cl("preview")}>
                            <CameraComponent
                                deviceId={selectedDeviceId}
                                width={960}
                                height={540}
                                disabled={false}
                            />
                        </div>
                    )}
                    {countdown > 0 && <div className={cl("countdown")}>{countdown}</div>}
                    {error && (
                        <div className={cl("error-wrap")}>
                            <Paragraph className={cl("error")}>{error}</Paragraph>
                        </div>
                    )}
                </div>

                <div className={cl("device-row")}>
                    <SearchableSelect
                        placeholder="Select camera"
                        maxVisibleItems={5}
                        options={videoDevices.map(device => ({
                            label: device.name,
                            value: device.id,
                        }))}
                        value={selectedDeviceId}
                        onChange={setSelectedDeviceId}
                        closeOnSelect
                        isDisabled={isSnapping || !videoDevices.length}
                    />
                </div>
            </ModalContent>

            <ModalFooter className={cl("footer")}>
                <div className={cl("footer-left")}>
                    <Checkbox
                        value={timerEnabled}
                        onChange={(_, value) => setTimerEnabled(value)}
                        disabled={isSnapping}
                    >
                        Timer
                    </Checkbox>
                </div>
                <div className={cl("footer-actions")}>
                    <Button disabled={!!error || !ready || isSnapping} onClick={snapAndAttach}>Capture Image</Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}, { noop: true });

function openWebcamModal(channel: Channel) {
    shouldCaptureVideoElement = true;
    captureVideoElement = null;
    const key = openModal(modalProps => (
        <WebcamModal
            modalProps={modalProps}
            channel={channel}
            close={() => {
                shouldCaptureVideoElement = false;
                captureVideoElement = null;
                closeModal(key);
            }}
        />
    ));
}

const UploadContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props.channel || children.some(c => c?.props?.id === "vc-webcam-picture")) return;

    children.push(
        <Menu.MenuItem
            id="vc-webcam-picture"
            label="Take a Picture"
            iconLeft={CameraIcon}
            leadingAccessory={{
                type: "icon",
                icon: CameraIcon
            }}
            action={() => openWebcamModal(props.channel)}
        />
    );
};

export default definePlugin({
    name: "WebcamPicture",
    description: "Take a webcam picture and attach it to chat.",
    authors: [EquicordDevs.mshl],
    requiresRestart: true,
    patches: [
        {
            find: "handleReady for ${g.current.streamId}, have onReady callback =",
            replacement: {
                match: /(\i)\.addEventListener\("canplaythrough",(\i)\)/,
                replace: "$1.addEventListener(\"canplaythrough\",(e)=>{$self.setCaptureVideoElement($1);$2(e)})"
            }
        }
    ],
    contextMenus: {
        "channel-attach": UploadContextMenuPatch,
    },
    setCaptureVideoElement(video: HTMLVideoElement | null) {
        if (!shouldCaptureVideoElement || !video) return;
        captureVideoElement = video;
    },
    getCaptureVideoElement() {
        return captureVideoElement;
    },
    stop() {
        captureVideoElement = null;
        shouldCaptureVideoElement = false;
    }
});
