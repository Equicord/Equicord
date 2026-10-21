/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { CheckmarkLargeBoldIcon, ClockIcon, CopyIcon, XLargeBoldIcon } from "@components/Icons";
import { Span } from "@components/Span";
import { copyToClipboard } from "@utils/clipboard";
import { classes } from "@utils/misc";
import { findComponentByCodeLazy } from "@webpack";
import { openModal, ScrollerAuto, Tooltip, useEffect, useRef, useState } from "@webpack/common";

import { settings } from "../settings";
import { decodeAudio, fetchVoiceMessage } from "../utils/audio";
import { cl, formatTranscript } from "../utils/misc";
import { TranscriptionJob, TranscriptionResult } from "../utils/worker";
import { LanguageSelectionModal } from "./LanguageSelectionModal";

const ChannelListIcon = findComponentByCodeLazy("1-1-1ZM2 8a1");

export function VoiceMessageButton({ src }: { src: string; }) {
    const { embed, maintainHorizontal, quantized, selectedModel, useGpu } = settings.use(["embed", "maintainHorizontal", "quantized", "selectedModel", "useGpu"]);
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<string>("idle");
    const [result, setResult] = useState<TranscriptionResult | null>(null);
    const [showTimestamps, setShowTimestamps] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const jobRef = useRef<TranscriptionJob | null>(null);
    const activeRunId = useRef(0);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const parent = buttonRef.current?.parentElement;
        if (!parent) return;
        parent.classList.add("vc-transcription-container");
        return () => {
            parent.classList.remove("vc-transcription-container", "vc-transcription-has-embed", "vc-transcription-maintain-horizontal");
        };
    }, []);

    useEffect(() => {
        const parent = buttonRef.current?.parentElement;
        if (!parent) return;
        parent.classList.toggle("vc-transcription-has-embed", Boolean(embed && isOpen));
        parent.classList.toggle("vc-transcription-maintain-horizontal", Boolean(embed && isOpen && maintainHorizontal));
    }, [embed, isOpen, maintainHorizontal]);

    useEffect(() => {
        return () => {
            activeRunId.current++;
            jobRef.current?.cancel();
            jobRef.current = null;
        };
    }, []);

    const startTranscription = async () => {
        const runId = ++activeRunId.current;
        jobRef.current?.cancel();
        jobRef.current = null;

        setIsOpen(true);
        setError(null);
        setStatus("downloading_audio");

        try {
            const blob = await fetchVoiceMessage(src);

            if (runId !== activeRunId.current) return;

            setStatus("processing_audio");
            const audioData = await decodeAudio(blob);

            if (runId !== activeRunId.current) return;

            jobRef.current = new TranscriptionJob({
                onStatus: s => {
                    if (runId === activeRunId.current) setStatus(s);
                },
                onComplete: out => {
                    if (runId === activeRunId.current) {
                        setResult(out);
                        setStatus("complete");
                    }
                },
                onError: err => {
                    if (runId === activeRunId.current) {
                        setError(String(err));
                        setStatus("error");
                    }
                },
                onPartial: partial => {
                    if (runId === activeRunId.current) setResult(partial);
                }
            });

            jobRef.current.run(audioData, {
                model: selectedModel,
                quantized,
                useGpu,
                task: "transcribe"
            });
        } catch (err) {
            if (runId === activeRunId.current) {
                setError(String(err));
                setStatus("error");
            }
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (embed) {
            if (!isOpen) {
                if (status === "idle" || status === "error") {
                    startTranscription();
                } else {
                    setIsOpen(true);
                }
            } else {
                setIsOpen(false);
            }
        } else {
            openModal(modalProps => <LanguageSelectionModal modalProps={modalProps} src={src} />);
        }
    };

    const displayText = formatTranscript(result, showTimestamps);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!displayText) return;
        copyToClipboard(displayText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isWorking = status === "downloading_audio" || status === "processing_audio" || status === "loading" || status === "transcribing";

    return (
        <>
            <button
                ref={buttonRef}
                className={cl("button")}
                style={{ backgroundColor: "transparent" }}
                onClick={handleClick}
                title="Transcribe Voice Message"
            >
                <ChannelListIcon colorClass={cl("icon")} />
            </button>
            {embed && isOpen && (
                <div
                    className={classes(
                        cl("embed"),
                        maintainHorizontal && cl("embed-maintain-horizontal")
                    )}
                    onClick={e => e.stopPropagation()}
                >
                    <div className={cl("embed-header")}>
                        <div className={cl("embed-title")}>
                            <span className={classes(cl("status-dot"), isWorking && cl("status-dot-active"), status === "error" && cl("status-dot-error"))} />
                            <span>
                                {status === "downloading_audio" && "Downloading Audio..."}
                                {status === "processing_audio" && "Processing Audio..."}
                                {status === "loading" && "Loading Model..."}
                                {status === "transcribing" && "Transcribing..."}
                                {status === "complete" && "Transcription"}
                                {status === "error" && "Transcription Error"}
                            </span>
                        </div>
                        <div className={cl("embed-actions")}>
                            {result && (
                                <>
                                    <Tooltip text={showTimestamps ? "Hide Timestamps" : "Show Timestamps"}>
                                        {props => (
                                            <button
                                                {...props}
                                                className={classes(cl("action-btn"), showTimestamps && cl("action-btn-active"))}
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    setShowTimestamps(!showTimestamps);
                                                }}
                                            >
                                                <ClockIcon width={14} height={14} />
                                            </button>
                                        )}
                                    </Tooltip>
                                    <Tooltip text={copied ? "Copied!" : "Copy Text"}>
                                        {props => (
                                            <button
                                                {...props}
                                                className={cl("action-btn")}
                                                onClick={handleCopy}
                                            >
                                                {copied ? <CheckmarkLargeBoldIcon width={14} height={14} /> : <CopyIcon width={14} height={14} />}
                                            </button>
                                        )}
                                    </Tooltip>
                                </>
                            )}
                            <Tooltip text="Close">
                                {props => (
                                    <button
                                        {...props}
                                        className={cl("action-btn")}
                                        onClick={e => {
                                            e.stopPropagation();
                                            setIsOpen(false);
                                        }}
                                    >
                                        <XLargeBoldIcon width={14} height={14} />
                                    </button>
                                )}
                            </Tooltip>
                        </div>
                    </div>
                    <div className={cl("embed-body")}>
                        {error ? (
                            <Flex flexDirection="column" gap={8}>
                                <Span size="xs" color="text-danger">{error}</Span>
                                <Button
                                    size="small"
                                    variant="primary"
                                    onClick={startTranscription}
                                    style={{ alignSelf: "flex-start" }}
                                >
                                    Retry
                                </Button>
                            </Flex>
                        ) : displayText ? (
                            <ScrollerAuto className={cl("embed-text")}>
                                <Span size="sm">{displayText}</Span>
                            </ScrollerAuto>
                        ) : (
                            <Span size="xs" color="text-muted">
                                {isWorking ? "Transcribing in progress..." : "Initializing..."}
                            </Span>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
