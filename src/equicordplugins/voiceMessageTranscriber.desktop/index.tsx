/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { ClockIcon, CopyIcon } from "@components/Icons";
import { Span } from "@components/Span";
import { copyToClipboard } from "@utils/clipboard";
import { Devs, EquicordDevs } from "@utils/constants";
import { classes } from "@utils/misc";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { Modal, openModal, ScrollerAuto, SearchableSelect, Tooltip, useEffect, useRef, useState } from "@webpack/common";

import { cl, decodeAudio, LANGUAGES, TranscriptionResult, TranscriptionWorker } from "./utils";
const Native = VencordNative.pluginHelpers.VoiceMessageTranscriber as PluginNative<typeof import("./native")>;

const ChannelListIcon = findComponentByCodeLazy("1-1-1ZM2 8a1");
let ManaBaseRadioGroup: React.ComponentType<{ options: { name: string; value: string; }[]; value: string; onChange: (v: string) => void; }>;

function formatTimestamp(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function CloseIcon({ size = 14 }: { size?: number; }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function CheckmarkIcon({ size = 14 }: { size?: number; }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

const MODEL_SIZES: Record<string, { quantized: string; full: string; }> = {
    "Xenova/whisper-tiny": { quantized: "~40 MB", full: "~150 MB" },
    "Xenova/whisper-base": { quantized: "~77 MB", full: "~290 MB" },
    "Xenova/whisper-small": { quantized: "~250 MB", full: "~960 MB" },
    "Xenova/whisper-medium": { quantized: "~765 MB", full: "~3.1 GB" },
};

function renderModelOption(option?: { label: string; value: string; }) {
    if (!option) return null;
    const isQuantized = settings.use(["quantized"])?.quantized ?? true;
    const size = MODEL_SIZES[option.value]?.[isQuantized ? "quantized" : "full"];

    return (
        <div className={cl("model-option")}>
            <span>{option.label}</span>
            {size && (
                <span className={cl("model-size")}>
                    {size}
                </span>
            )}
        </div>
    );
}

const settings = definePluginSettings({
    embed: {
        type: OptionType.BOOLEAN,
        description: "Display transcription directly in the voice message attachment instead of a modal.",
        default: false,
        restartNeeded: false
    },
    maintainHorizontal: {
        type: OptionType.BOOLEAN,
        description: "Maintain horizontal size for the embedded transcription box and expand vertically.",
        default: false,
        restartNeeded: false
    },
    selectedModel: {
        type: OptionType.SELECT,
        description: "Model size.",
        options: [
            {
                label: "Tiny (Fastest, lowest accuracy)",
                value: "Xenova/whisper-tiny",
            },
            {
                label: "Base (Recommended)",
                value: "Xenova/whisper-base",
                default: true
            },
            {
                label: "Small",
                value: "Xenova/whisper-small"
            },
            {
                label: "Medium (Slowest, best accuracy)",
                value: "Xenova/whisper-medium"
            }
        ],
        componentProps: {
            renderOptionLabel: (option: { label: string; value: string; }) => renderModelOption(option),
            renderOptionValue: (options: { label: string; value: string; }[]) => renderModelOption(options?.[0]),
        },
        restartNeeded: false
    },
    quantized: {
        type: OptionType.BOOLEAN,
        description: "Use quantized models (smaller size, slight quality loss).",
        default: true,
        restartNeeded: false
    },
    deleteModalFiles: {
        type: OptionType.COMPONENT,
        description: "Delete cached files from storage.",
        component: () => {
            const [size, setSize] = useState(0);
            const [deleteKeys, setDeleteKeys] = useState<string[]>([]);

            useEffect(() => {
                let unmounted = false;
                DataStore.entries().then(entries => {
                    if (unmounted) return;
                    let totalSize = 0;
                    const keys: string[] = [];
                    for (const [key, value] of entries) {
                        if (typeof key === "string" && (key.startsWith("whisper-") || key.startsWith("onnx-"))) {
                            totalSize += (value as string).length;
                            keys.push(key);
                        }
                    }
                    setSize(totalSize);
                    setDeleteKeys(keys);
                });
                return () => { unmounted = true; };
            }, []);

            return <Button
                disabled={size === 0}
                variant="dangerPrimary"
                onClick={() => {
                    DataStore.delMany(deleteKeys).then(() => { setSize(0); setDeleteKeys([]); });
                }}
            >
                Delete all cached files ({(size / 1024 / 1024).toFixed(2)} MB)
            </Button>;
        }
    }
});

function LanguageSelectionModal(props: { modalProps: RenderModalProps, src: string; }) {
    const { modalProps, src } = props;
    const [language, setLanguage] = useState<string>("auto");
    const [task, setTask] = useState<string>("transcribe");

    const languageOptions = [
        { label: "Auto Detect", value: "auto" },
        ...Object.entries(LANGUAGES).map(([code, name]) => ({
            label: name.charAt(0).toUpperCase() + name.slice(1),
            value: code
        }))
    ];

    const start = () => {
        modalProps.onClose();
        openModal(modalProps => (
            <TranscriptionModal
                modalProps={modalProps}
                src={src}
                options={{ language, task }}
            />
        ));
    };

    return (
        <Modal
            {...modalProps}
            size="md"
            title="Transcription Options"
            actions={[
                {
                    text: "Start",
                    variant: "primary",
                    onClick: start
                }
            ]}
        >
            <Flex flexDirection="column" gap={20} style={{ padding: "16px" }}>
                <div>
                    <BaseText size="sm" weight="semibold" style={{ marginBottom: "8px" }}>
                        Audio Language
                    </BaseText>
                    <SearchableSelect
                        options={languageOptions}
                        value={languageOptions.find(o => o.value === language)?.value}
                        onChange={setLanguage}
                    />
                </div>

                <div>
                    <BaseText size="sm" weight="semibold" style={{ marginBottom: "8px" }}>
                        Action
                    </BaseText>
                    <ManaBaseRadioGroup
                        options={[{
                            name: "Transcribe",
                            value: "transcribe"
                        }, {
                            name: "Translate to English",
                            value: "translate"
                        }]}
                        value={task}
                        onChange={v => setTask(v as string)}
                    />
                </div>
            </Flex>
        </Modal>
    );
}

function TranscriptionModal(props: { modalProps: RenderModalProps, src: string, options: { language: string, task: string; }; }) {
    const { modalProps, src, options } = props;
    const [status, setStatus] = useState<string>("initializing");
    const [result, setResult] = useState<TranscriptionResult | null>(null);
    const [showTimestamps, setShowTimestamps] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    const workerRef = useRef<TranscriptionWorker | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                setStatus("downloading_audio");
                setError(null);

                let blob: Blob;
                if (IS_DISCORD_DESKTOP || IS_EQUIBOP) {
                    const data = await Native.fetchAudio(src);
                    blob = new Blob([new Uint8Array(data)]);
                } else {
                    const res = await fetch(src);
                    if (!res.ok) throw new Error("Failed to download audio");
                    blob = await res.blob();
                }

                if (!active) return;
                setStatus("processing_audio");
                const audioData = await decodeAudio(blob);

                if (!active) return;
                workerRef.current?.terminate();
                workerRef.current = new TranscriptionWorker(
                    s => {
                        if (active) setStatus(s);
                    },
                    out => {
                        if (active) {
                            setResult(out);
                            setStatus("complete");
                        }
                    },
                    err => {
                        if (active) {
                            setError(String(err));
                            setStatus("error");
                        }
                    },
                    partial => {
                        if (active) setResult(partial);
                    }
                );

                const { quantized, selectedModel } = settings.store;
                workerRef.current.run(
                    audioData,
                    selectedModel,
                    quantized,
                    options.language === "auto" ? undefined : options.language,
                    options.task
                );
            } catch (err) {
                if (active) {
                    setError(String(err));
                    setStatus("error");
                }
            }
        })();

        return () => {
            active = false;
            workerRef.current?.terminate();
        };
    }, [retryCount]);

    const handleCopy = () => {
        if (!result) return;
        const text = showTimestamps
            ? result.chunks.map(c => `[${formatTimestamp(c.timestamp[0])} - ${formatTimestamp(c.timestamp[1])}] ${c.text}`).join("\n")
            : result.text;
        copyToClipboard(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const displayText = result ? (
        showTimestamps
            ? result.chunks.map(c => `[${formatTimestamp(c.timestamp[0])} - ${formatTimestamp(c.timestamp[1])}] ${c.text}`).join("\n")
            : result.text
    ) : "";

    return (
        <Modal
            {...modalProps}
            size="md"
            title={options.task === "translate" ? "Voice Message Translation" : "Voice Message Transcription"}
            actions={[
                ...(error ? [{
                    text: "Retry",
                    variant: "primary" as const,
                    onClick: () => setRetryCount(c => c + 1)
                }] : []),
                ...(result ? [
                    {
                        text: showTimestamps ? "Hide Timestamps" : "Show Timestamps",
                        variant: "secondary" as const,
                        onClick: () => setShowTimestamps(!showTimestamps)
                    },
                    {
                        text: copied ? "Copied!" : "Copy Text",
                        variant: "secondary" as const,
                        onClick: handleCopy
                    }
                ] : [])
            ]}
        >
            <div className={cl("content")}>
                {error ? (
                    <Flex flexDirection="column" alignItems="center" gap={12} style={{ padding: "32px 16px" }}>
                        <Heading tag="h3" style={{ color: "var(--red-360)" }}>Transcription Failed</Heading>
                        <BaseText size="sm" color="text-muted" style={{ textAlign: "center" }}>
                            {error}
                        </BaseText>
                    </Flex>
                ) : displayText ? (
                    <div className={cl("result")}>
                        <BaseText size="md">{displayText}</BaseText>
                    </div>
                ) : (
                    <Flex flexDirection="column" alignItems="center" justifyContent="center" gap={16} style={{ height: "200px" }}>
                        <Heading tag="h3">
                            {status === "downloading_audio" && "Downloading Audio..."}
                            {status === "processing_audio" && "Processing Audio..."}
                            {status === "loading" && "Loading Model..."}
                            {status === "transcribing" && "Transcribing..."}
                        </Heading>
                    </Flex>
                )}
            </div>
        </Modal>
    );
}

function VoiceMessageTranscriber({ src }: { src: string; }) {
    const { embed, maintainHorizontal, quantized, selectedModel } = settings.use(["embed", "maintainHorizontal", "quantized", "selectedModel"]);
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<string>("idle");
    const [result, setResult] = useState<TranscriptionResult | null>(null);
    const [showTimestamps, setShowTimestamps] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const workerRef = useRef<TranscriptionWorker | null>(null);
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
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

    const startTranscription = async () => {
        const runId = ++activeRunId.current;
        workerRef.current?.terminate();
        workerRef.current = null;

        setIsOpen(true);
        setError(null);
        setStatus("downloading_audio");

        try {
            let blob: Blob;
            if (IS_DISCORD_DESKTOP || IS_EQUIBOP) {
                const data = await Native.fetchAudio(src);
                blob = new Blob([new Uint8Array(data)]);
            } else {
                const res = await fetch(src);
                if (!res.ok) throw new Error("Failed to download audio");
                blob = await res.blob();
            }

            if (runId !== activeRunId.current) return;

            setStatus("processing_audio");
            const audioData = await decodeAudio(blob);

            if (runId !== activeRunId.current) return;

            workerRef.current = new TranscriptionWorker(
                s => {
                    if (runId === activeRunId.current) setStatus(s);
                },
                out => {
                    if (runId === activeRunId.current) {
                        setResult(out);
                        setStatus("complete");
                    }
                },
                err => {
                    if (runId === activeRunId.current) {
                        setError(String(err));
                        setStatus("error");
                    }
                },
                partial => {
                    if (runId === activeRunId.current) setResult(partial);
                }
            );

            workerRef.current.run(
                audioData,
                selectedModel,
                quantized,
                undefined,
                "transcribe"
            );
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

    const displayText = result ? (
        showTimestamps
            ? result.chunks.map(c => `[${formatTimestamp(c.timestamp[0])} - ${formatTimestamp(c.timestamp[1])}] ${c.text}`).join("\n")
            : result.text
    ) : "";

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
                                                {copied ? <CheckmarkIcon size={14} /> : <CopyIcon width={14} height={14} />}
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
                                        <CloseIcon size={14} />
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

const VoiceMessageTranscriberWrapped = ErrorBoundary.wrap(VoiceMessageTranscriber, { noop: true });

export default definePlugin({
    name: "VoiceMessageTranscriber",
    authors: [Devs.TheSun, EquicordDevs.tt],
    description: "On-device transcriptions for voice messages powered by Whisper v3",
    tags: ["Chat", "Media", "Utility", "Voice"],
    patches: [
        {
            find: ".VOICE_MESSAGE)),",
            replacement: {
                match: /"source",{src:(\i).{0,700}duration:\i}\),/,
                replace: "$&$self.button($1),"
            }
        },
        {
            find: '"data-mana-component":"BaseRadioGroup"',
            replacement: {
                match: /(?=function (\i)\(\i\)\{.{0,400}"data-mana-component":"BaseRadioGroup")/,
                replace: "$self.ManaBaseRadioGroup=$1;"
            }
        },
    ],
    set ManaBaseRadioGroup(value: typeof ManaBaseRadioGroup) {
        ManaBaseRadioGroup = value;
    },
    settings,

    button(src: string) {
        return <VoiceMessageTranscriberWrapped src={src} />;
    },
});
