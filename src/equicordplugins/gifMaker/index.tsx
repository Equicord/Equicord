/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { FormSwitch } from "@components/FormSwitch";
import { EquicordDevs } from "@utils/constants";
import { getCurrentChannel } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { Menu, Modal, openModal, UploadHandler, useEffect, useRef, useState } from "@webpack/common";

import { CAPTIONS } from "./captions";
import { EFFECTS } from "./effects";
import css from "./styles.css?managed";
import { DEFAULT_OPTIONS, GifMakerOptions } from "./types";
import { createGif, getCaptionHeight } from "./utils";

const settings = definePluginSettings({
    lastWidth: {
        type: OptionType.NUMBER,
        default: DEFAULT_OPTIONS.width,
        hidden: true,
        description: ""
    },
    lastHeight: {
        type: OptionType.NUMBER,
        default: DEFAULT_OPTIONS.height,
        hidden: true,
        description: ""
    },
    lastFrameDelay: {
        type: OptionType.NUMBER,
        default: DEFAULT_OPTIONS.frameDelay,
        hidden: true,
        description: ""
    },
    lastEffectTypes: {
        type: OptionType.STRING,
        default: JSON.stringify(DEFAULT_OPTIONS.effectTypes),
        hidden: true,
        description: ""
    },
    lastGrayscale: {
        type: OptionType.BOOLEAN,
        default: DEFAULT_OPTIONS.grayscale,
        hidden: true,
        description: ""
    },
    lastCaptionMode: {
        type: OptionType.STRING,
        default: DEFAULT_OPTIONS.captionMode,
        hidden: true,
        description: ""
    },
    lastCaptionText: {
        type: OptionType.STRING,
        default: DEFAULT_OPTIONS.captionText,
        hidden: true,
        description: ""
    },
    lastCaptionSize: {
        type: OptionType.NUMBER,
        default: DEFAULT_OPTIONS.captionSize,
        hidden: true,
        description: ""
    },
    lastBubbleTipBase: {
        type: OptionType.NUMBER,
        default: DEFAULT_OPTIONS.bubbleTipBase,
        hidden: true,
        description: ""
    },
    maxDimension: {
        type: OptionType.NUMBER,
        default: 1024,
        description: "Maximum auto-fit dimension for GIF width/height"
    },
});

const GIFMAKER_ID = "vc-gifmaker";

const MEDIA_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];

function getMediaInfo(props: any): { url: string; isVideo: boolean; sourceWidth?: number; sourceHeight?: number; } | null {
    const { message } = props;
    const attachment = props.attachment ?? message?.attachments?.find((a: any) => MEDIA_TYPES.some(t => a.content_type?.startsWith(t)));
    const url = props.itemHref ?? props.itemSrc ?? props.src ?? attachment?.proxy_url ?? attachment?.url;
    if (!url) return null;

    const isVideo = attachment
        ? attachment.content_type?.startsWith("video/")
        : /\.(mp4|webm|mov)([?#]|$)/i.test(url);

    return { url, isVideo, sourceWidth: attachment?.width, sourceHeight: attachment?.height };
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const info = getMediaInfo(props);
    if (!info) return;

    children.push(
        <Menu.MenuItem
            id={GIFMAKER_ID}
            label="Make GIF"
            action={() => openModal(modalProps => (
                <GifMakerModal url={info.url} isVideo={info.isVideo} sourceWidth={info.sourceWidth} sourceHeight={info.sourceHeight} {...modalProps} />
            ))}
        />
    );
};

const imageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props?.src) return;
    if ("href" in props && !props.src) return;
    if (props.target?.classList?.contains("emoji")) return;

    const info = getMediaInfo(props);
    if (!info) return;

    children.push(
        <Menu.MenuItem
            id={GIFMAKER_ID}
            label="Make GIF"
            icon={GifIcon}
            action={() => openModal(modalProps => <GifMakerModal url={info.url} isVideo={info.isVideo} sourceWidth={info.sourceWidth} sourceHeight={info.sourceHeight} {...modalProps} />)}
        />
    );
};

function clamp(val: number, min: number, max: number, fallback: number): number {
    return Math.max(min, Math.min(max, val || fallback));
}

function getInitialSize(sourceWidth?: number, sourceHeight?: number, storedWidth?: number, storedHeight?: number): [number, number] {
    const maxDim = settings.store.maxDimension;
    if (sourceWidth && sourceHeight) {
        if (sourceWidth <= maxDim && sourceHeight <= maxDim) {
            return [sourceWidth, sourceHeight];
        }
        const aspect = sourceWidth / sourceHeight;
        if (sourceWidth > sourceHeight) {
            return [maxDim, Math.round(maxDim / aspect)];
        }
        return [Math.round(maxDim * aspect), maxDim];
    }
    return [storedWidth ?? DEFAULT_OPTIONS.width, storedHeight ?? DEFAULT_OPTIONS.height];
}

function GifMakerModal({ url, isVideo, sourceWidth, sourceHeight, ...props }: RenderModalProps & { url: string; isVideo: boolean; sourceWidth?: number; sourceHeight?: number; }) {
    const [options, setOptions] = useState<GifMakerOptions>(() => {
        const [width, height] = getInitialSize(sourceWidth, sourceHeight, settings.store.lastWidth, settings.store.lastHeight);
        return {
            width: width, height: height,
            frameDelay: settings.store.lastFrameDelay,
            effectTypes: JSON.parse(settings.store.lastEffectTypes as string || "[]"),
            grayscale: settings.store.lastGrayscale,
            captionMode: settings.store.lastCaptionMode as GifMakerOptions["captionMode"],
            captionText: settings.store.lastCaptionText,
            captionSize: settings.store.lastCaptionSize,
            bubbleTipX: DEFAULT_OPTIONS.bubbleTipX,
            bubbleTipY: DEFAULT_OPTIONS.bubbleTipY,
            bubbleTipBase: settings.store.lastBubbleTipBase,
        };
    });

    const [gifBlob, setGifBlob] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const previewRef = useRef<HTMLImageElement>(null);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const patch = (partial: Partial<GifMakerOptions>) => {
        setOptions(prev => {
            const next = { ...prev, ...partial };
            settings.store.lastWidth = next.width;
            settings.store.lastHeight = next.height;
            settings.store.lastFrameDelay = next.frameDelay;
            settings.store.lastEffectTypes = JSON.stringify(next.effectTypes);
            settings.store.lastGrayscale = next.grayscale;
            settings.store.lastCaptionMode = next.captionMode;
            settings.store.lastCaptionText = next.captionText;
            settings.store.lastCaptionSize = next.captionSize;
            settings.store.lastBubbleTipBase = next.bubbleTipBase;
            return next;
        });
    };

    useEffect(() => {
        if (!sourceWidth || !sourceHeight) return;
        const [w, h] = getInitialSize(sourceWidth, sourceHeight);
        setOptions(prev => ({ ...prev, width: w, height: h }));
    }, [sourceWidth, sourceHeight]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setGenerating(true);

            const { current } = optionsRef;
            createGif(url, isVideo, current).then(blob => {
                setError(null);
                setGifBlob(blob);
                setPreviewUrl(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(blob);
                });
                setGenerating(false);
            }).catch((err: any) => {
                console.error("[GifMaker]", err);
                setError(err?.message ?? String(err));
                setGenerating(false);
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [JSON.stringify(options.effectTypes), options.width, options.height, options.frameDelay, options.grayscale, options.captionMode, options.captionText, options.captionSize, options.bubbleTipX, options.bubbleTipY, options.bubbleTipBase]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handlePreviewClick = (e: React.MouseEvent<HTMLImageElement>) => {
        if (options.captionMode !== "speechbubble") return;
        const img = previewRef.current;
        if (!img) return;

        const tempCtx = document.createElement("canvas").getContext("2d")!;
        const capHeight = getCaptionHeight(tempCtx, options.width, options);

        const rect = img.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * options.width;
        const totalHeight = options.height + capHeight;
        const y = (e.clientY - rect.top) / rect.height * totalHeight;
        patch({ bubbleTipX: x, bubbleTipY: Math.max(0, y - capHeight) });
    };

    const handleExport = () => {
        if (!gifBlob) return;

        const objUrl = URL.createObjectURL(gifBlob);
        const link = document.createElement("a");
        link.href = objUrl;
        link.download = "export.gif";
        link.click();
        link.remove();
        URL.revokeObjectURL(objUrl);
    };

    const handleSend = () => {
        if (!gifBlob) return;

        const channel = getCurrentChannel();
        if (!channel) return;

        const file = new File([gifBlob], "export.gif", { type: "image/gif" });
        UploadHandler.promptToUpload([file], channel, 0);
        props.onClose?.();
    };

    return (
        <Modal
            {...props}
            size="lg"
            title="Make GIF"
            actions={[
                {
                    text: "Send",
                    variant: "primary",
                    onClick: handleSend
                },
                {
                    text: "Export",
                    variant: "primary",
                    onClick: handleExport
                }
            ]}
        >
            <div className="vc-gifmaker-modal-body">
                <div className="vc-gifmaker-preview-section">
                    <div className="vc-gifmaker-preview-wrapper">
                        <img
                            ref={previewRef}
                            alt="GIF preview"
                            src={previewUrl ?? ""}
                            onClick={handlePreviewClick}
                            className={"vc-gifmaker-preview" + (generating ? " vc-gifmaker-preview-generating" : "") + (options.captionMode === "speechbubble" ? " vc-gifmaker-preview-crosshair" : "")}
                        />

                        {generating && (
                            <div className="vc-gifmaker-generating-overlay">
                                Generating GIF...
                            </div>
                        )}

                        {error && !generating && (
                            <div className="vc-gifmaker-error-overlay">
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                <div className="vc-gifmaker-controls-section">

                    <div className="vc-gifmaker-section-heading">Captions</div>
                    <div className="vc-gifmaker-tab-row">
                        {CAPTIONS.map(c => (
                            <button
                                key={c.type}
                                onClick={() => patch({ captionMode: c.type })}
                                className={"vc-gifmaker-tab-btn" + (options.captionMode === c.type ? " vc-gifmaker-tab-btn-active" : "")}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>

                    {options.captionMode === "caption" && (
                        <div className="vc-gifmaker-section">
                            <div style={{ marginBottom: "8px" }}>
                                <label className="vc-gifmaker-label">Text</label>
                                <input
                                    type="text"
                                    value={options.captionText}
                                    onChange={e => patch({ captionText: e.target.value })}
                                    placeholder="Enter caption..."
                                    className="vc-gifmaker-input"
                                />
                            </div>
                            <div>
                                <label className="vc-gifmaker-label">Font Size: {options.captionSize}px</label>
                                <input
                                    type="range"
                                    min={10}
                                    max={120}
                                    value={options.captionSize}
                                    onChange={e => patch({ captionSize: Number(e.target.value) })}
                                    className="vc-gifmaker-slider"
                                />
                            </div>
                        </div>
                    )}

                    {options.captionMode === "speechbubble" && (
                        <div className="vc-gifmaker-section">
                            <div className="vc-gifmaker-section-hint">
                                Click on the preview to position the bubble tip
                            </div>
                            <div>
                                <label className="vc-gifmaker-label">Tip Base: {Math.round(options.bubbleTipBase * 100)}%</label>
                                <input
                                    type="range"
                                    min={0}
                                    max={80}
                                    value={Math.round(options.bubbleTipBase * 100)}
                                    onChange={e => patch({ bubbleTipBase: Number(e.target.value) / 100 })}
                                    className="vc-gifmaker-slider"
                                />
                            </div>
                        </div>
                    )}

                    <div className="vc-gifmaker-section-heading">Effects</div>
                    <div className="vc-gifmaker-tab-row">
                        <button
                            onClick={() => patch({ effectTypes: [] })}
                            className={"vc-gifmaker-tab-btn" + (options.effectTypes.length === 0 ? " vc-gifmaker-tab-btn-active" : "")}
                        >
                            None
                        </button>
                        {EFFECTS.map(e => (
                            <button
                                key={e.type}
                                onClick={() => {
                                    if (options.effectTypes.includes(e.type)) {
                                        patch({ effectTypes: options.effectTypes.filter(t => t !== e.type) });
                                    } else {
                                        patch({ effectTypes: [...options.effectTypes, e.type] });
                                    }
                                }}
                                className={"vc-gifmaker-tab-btn" + (options.effectTypes.includes(e.type) ? " vc-gifmaker-tab-btn-active" : "")}
                            >
                                {e.name}
                            </button>
                        ))}
                    </div>

                    <div className="vc-gifmaker-field">
                        <label className="vc-gifmaker-label">Delay (ms)</label>
                        <input
                            type="number"
                            min={20}
                            max={1000}
                            step={10}
                            value={options.frameDelay}
                            onChange={e => patch({ frameDelay: Number(e.target.value) })}
                            onBlur={e => patch({ frameDelay: clamp(Number(e.target.value), 20, 1000, 20) })}
                            className="vc-gifmaker-input"
                        />
                    </div>

                    <div className="vc-gifmaker-section-heading">Dimensions</div>
                    <div className="vc-gifmaker-dims-row">
                        <div className="vc-gifmaker-field">
                            <label className="vc-gifmaker-label">Width</label>
                            <input
                                type="number"
                                min={32}
                                max={1024}
                                value={options.width}
                                onChange={e => patch({ width: Number(e.target.value) })}
                                onBlur={e => patch({ width: clamp(Number(e.target.value), 32, 1024, 32) })}
                                className="vc-gifmaker-input"
                            />
                        </div>
                        <div className="vc-gifmaker-field">
                            <label className="vc-gifmaker-label">Height</label>
                            <input
                                type="number"
                                min={32}
                                max={1024}
                                value={options.height}
                                onChange={e => patch({ height: Number(e.target.value) })}
                                onBlur={e => patch({ height: clamp(Number(e.target.value), 32, 1024, 32) })}
                                className="vc-gifmaker-input"
                            />
                        </div>
                    </div>

                    <FormSwitch
                        title="Grayscale"
                        value={options.grayscale}
                        onChange={(v: boolean) => patch({ grayscale: v })}
                    />
                </div>
            </div>
        </Modal>
    );
}

export default definePlugin({
    name: "GifMaker",
    description: "Creates a GIF from any image or video in chat",
    authors: [EquicordDevs.Leon135],
    settings,
    contextMenus: {
        "message": messageContextMenuPatch,
        "image-context": imageContextMenuPatch
    },
    start() {
        enableStyle(css);
    },
    stop() {
        disableStyle(css);
    }
});
