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
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { ClockIcon, CopyIcon } from "@components/Icons";
import { Span } from "@components/Span";
import { copyToClipboard } from "@utils/clipboard";
import { Devs } from "@utils/constants";
import { classes } from "@utils/misc";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { lodash, Modal, openModal, ScrollerAuto, SearchableSelect, Tooltip, useEffect, useRef, useState } from "@webpack/common";

import { cl, decodeAudio, LANGUAGES, TranscriptionWorker } from "./utils";
const Native = VencordNative.pluginHelpers.VoiceMessageTranscriber as PluginNative<typeof import("./native")>;

const ChannelListIcon = findComponentByCodeLazy("1-1-1ZM2 8a1");
let ManaBaseRadioGroup;

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
        description: "Display transcription directly in the voice message attachment instead of a modal",
        default: false,
        restartNeeded: false
    },
    maintainHorizontal: {
        type: OptionType.BOOLEAN,
        description: "Maintain horizontal size for the embedded transcription box and expand vertically",
        default: false,
        restartNeeded: false
    },
    selectedModel: {
        type: OptionType.SELECT,
        description: "Model size",
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
            renderOptionLabel: (option: any) => renderModelOption(option),
            renderOptionValue: (options: any[]) => renderModelOption(options?.[0]),
        },
        restartNeeded: false
    },
    quantized: {
        type: OptionType.BOOLEAN,
        description: "Use quantized model (smaller size, slightly lower accuracy)",
        default: true,
        restartNeeded: false
    },
    delete: {
        type: OptionType.COMPONENT,
        component: () => {
            const [size, setSize] = useState(0);
            const [deleteKeys, setDeleteKeys] = useState<string[]>([]);

            useEffect(() => {
                DataStore.entries().then(entries => {
                    let size = 0;
                    const keys = [] as string[];

                    entries.forEach(([key, val]) => {
                        if (typeof key === "string" && key.startsWith("VoiceMessageTranscriber") && lodash.isArrayBuffer(val)) {
                            keys.push(key);
                            size += val.byteLength ?? 0;
                        }
                    });

                    setSize(size);
                    setDeleteKeys(keys);
                });
            }, []);

            return <Button
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
    const [result, setResult] = useState<{ text: string, chunks: { timestamp: [number, number], text: string; }[]; } | null>(null);
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
                    const arrayBuffer = await Native.fetchAudio(src);
                    blob = new Blob([arrayBuffer as any]);
                } else {
                    const res = await fetch(src);
                    if (!res.ok) throw new Error("Failed to download audio");
                    blob = await res.blob();
                }

                if (!active) return;
                setStatus("processing_audio");
                const audioData = await decodeAudio(blob);

                if (!active) return;
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
                        if (active) setError(String(err));
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
                if (active) setError(String(err));
            }
        })();

        return () => {
            active = false;
            workerRef.current?.terminate();
        };
    }, [src, retryCount]);

    const retry = () => {
        setError(null);
        setStatus("initializing");
        setResult(null);
        setCopied(false);
        setRetryCount(prev => prev + 1);
    };

    const displayText = result ? (
        showTimestamps
            ? result.chunks.map(c => `[${formatTimestamp(c.timestamp[0])} - ${formatTimestamp(c.timestamp[1])}] ${c.text}`).join("\n")
            : result.text
    ) : "";

    const actions: any[] = [];
    if (error) {
        actions.push({
            text: "Retry",
            variant: "primary",
            onClick: retry
        });
    } else if (status === "complete" || (status === "transcribing" && result)) {
        actions.push({
            text: copied ? "Copied!" : "Copy to Clipboard",
            variant: "primary",
            disabled: status === "transcribing" || copied,
            onClick: () => {
                copyToClipboard(displayText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        });
    }

    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Transcription"
            actions={actions}
        >
            <div className={cl("content")}>
                {error ? (
                    <Flex flexDirection="column" gap={16} style={{ padding: "20px 0" }}>
                        <Heading tag="h3" style={{ color: "var(--red-360)" }}>Error</Heading>
                        <Span style={{ whiteSpace: "pre-wrap" }}>{error}</Span>
                    </Flex>
                ) : (status === "complete" || (status === "transcribing" && result)) ? (
                    <Flex flexDirection="column" gap={16} style={{ paddingBottom: "20px" }}>
                        {status === "transcribing" && (
                            <Span size="sm" color="text-muted">Transcribing in progress...</Span>
                        )}
                        <ScrollerAuto className={cl("result")}>
                            <Span>{displayText}</Span>
                        </ScrollerAuto>
                        <Flex flexDirection="row" gap={12} alignItems="center">
                            <div style={{ flexGrow: 1 }}>
                                <FormSwitch
                                    title="Show Timestamps"
                                    value={showTimestamps}
                                    onChange={setShowTimestamps}
                                />
                            </div>
                        </Flex>
                    </Flex>
                ) : (
                    <Flex flexDirection="column" gap={16} style={{ padding: "20px 0", alignItems: "center" }}>
                        <Heading tag="h3">
                            {status === "initializing" && "Initializing..."}
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
    const { embed, maintainHorizontal, quantized, selectedModel } = settings.use([
        "embed",
        "maintainHorizontal",
        "quantized",
        "selectedModel"
    ]);
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<string>("idle");
    const [result, setResult] = useState<{ text: string, chunks: { timestamp: [number, number], text: string; }[]; } | null>(null);
    const [showTimestamps, setShowTimestamps] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const workerRef = useRef<TranscriptionWorker | null>(null);

    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const startTranscription = async () => {
        setIsOpen(true);
        setError(null);
        setStatus("downloading_audio");

        try {
            let blob: Blob;
            if (IS_DISCORD_DESKTOP || IS_EQUIBOP) {
                const arrayBuffer = await Native.fetchAudio(src);
                blob = new Blob([arrayBuffer as any]);
            } else {
                const res = await fetch(src);
                if (!res.ok) throw new Error("Failed to download audio");
                blob = await res.blob();
            }

            setStatus("processing_audio");
            const audioData = await decodeAudio(blob);

            workerRef.current?.terminate();
            workerRef.current = new TranscriptionWorker(
                s => setStatus(s),
                out => {
                    setResult(out);
                    setStatus("complete");
                },
                err => {
                    setError(String(err));
                    setStatus("error");
                },
                partial => {
                    setResult(partial);
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
            setError(String(err));
            setStatus("error");
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

export default definePlugin({
    name: "VoiceMessageTranscriber",
    authors: [Devs.TheSun],
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
    set ManaBaseRadioGroup(value: any) {
        ManaBaseRadioGroup = value;
    },
    settings,

    button(src: string) {
        return <VoiceMessageTranscriber src={src} />;
    },
});
