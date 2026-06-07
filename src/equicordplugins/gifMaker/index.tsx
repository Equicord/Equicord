/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { FormSwitch } from "@components/FormSwitch";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { getCurrentChannel } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { saveFile } from "@utils/web";
import { RenderModalProps } from "@vencord/discord-types";
import { Menu, Modal, openModal, UploadHandler, useEffect, useRef, useState } from "@webpack/common";

import { CAPTIONS } from "./captions";
import { EFFECTS } from "./effects";
import css from "./styles.css?managed";
import { DEFAULT_OPTIONS, GifMakerOptions } from "./types";
import { createGif } from "./utils";

const cl = classNameFactory("vc-gifmaker-");
const logger = new Logger("GifMaker");

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
    lastFps: {
        type: OptionType.NUMBER,
        default: DEFAULT_OPTIONS.fps,
        description: "Frames per second"
    },
    lastMaxDuration: {
        type: OptionType.NUMBER,
        default: DEFAULT_OPTIONS.maxDuration,
        description: "Max GIF duration in seconds"
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
    maxWidth: {
        type: OptionType.NUMBER,
        default: 1280,
        description: "Maximum auto-fit width"
    },
    maxHeight: {
        type: OptionType.NUMBER,
        default: 720,
        description: "Maximum auto-fit height"
    },
});

const GIFMAKER_ID = "vc-gifmaker";

const MEDIA_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
const MEDIA_EXT_RE = /\.(png|jpe?g|webp|gif|mp4|webm|mov)([?#]|$)/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov)([?#]|$)/i;

// Bunch of strategies for it to properly work. Took a lot of time to figure out
function getMediaInfo(props: Record<string, unknown>): { url: string; isVideo: boolean; sourceWidth?: number; sourceHeight?: number; } | null {
    const msg = props.message as Record<string, any> | undefined;

    // 1. Direct attachment prop (right-click on file upload)
    const directAttachment = props.attachment as Record<string, any> | undefined;
    if (directAttachment?.proxy_url && MEDIA_TYPES.some(t => directAttachment.content_type?.startsWith(t))) {
        logger.info("getMediaInfo path 1 (direct attachment):", directAttachment.proxy_url, "w:", directAttachment.width, "h:", directAttachment.height);
        return {
            url: directAttachment.proxy_url ?? directAttachment.url,
            isVideo: directAttachment.content_type?.startsWith("video/"),
            sourceWidth: directAttachment.width,
            sourceHeight: directAttachment.height
        };
    }

    // 2. Message attachments (find by content type)
    const msgAttachment = msg?.attachments?.find((a: any) => MEDIA_TYPES.some(t => a.content_type?.startsWith(t)));
    if (msgAttachment?.proxy_url) {
        logger.info("getMediaInfo path 2 (msg attachment):", msgAttachment.proxy_url, "w:", msgAttachment.width, "h:", msgAttachment.height);
        return {
            url: msgAttachment.proxy_url ?? msgAttachment.url,
            isVideo: msgAttachment.content_type?.startsWith("video/"),
            sourceWidth: msgAttachment.width,
            sourceHeight: msgAttachment.height
        };
    }

    // 3. Embeds (Tenor, Giphy)
    if (msg?.embeds) {
        for (const embed of msg.embeds) {
            const v = embed?.video;
            if (v?.proxyURL || v?.url) {
                logger.info("getMediaInfo path 3a (embed video):", v.url || v.proxyURL, "w:", v.width, "h:", v.height);
                return { url: v.proxyURL ?? v.url, isVideo: true, sourceWidth: v.width, sourceHeight: v.height };
            }
            const i = embed?.image ?? embed?.thumbnail;
            if (i?.proxyURL || i?.url) {
                logger.info("getMediaInfo path 3b (embed image):", i.url || i.proxyURL, "w:", i.width, "h:", i.height);
                return { url: i.proxyURL ?? i.url, isVideo: false, sourceWidth: i.width, sourceHeight: i.height };
            }
        }
    }

    // 4. Link/image props (itemHref from links, src from image elements)
    const linkUrl = (props.itemHref ?? props.itemSrc ?? props.src) as string | undefined;
    if (linkUrl && MEDIA_EXT_RE.test(linkUrl)) {
        logger.info("getMediaInfo path 4 (src link):", linkUrl);
        return {
            url: linkUrl,
            isVideo: VIDEO_EXT_RE.test(linkUrl)
        };
    }

    logger.info("getMediaInfo: no match found");
    return null;
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const info = getMediaInfo(props);
    if (!info) return;
    logger.info("messageContextMenu: url:", info.url, "w:", info.sourceWidth, "h:", info.sourceHeight);

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
    logger.info("imageContextMenu: url:", info.url, "w:", info.sourceWidth, "h:", info.sourceHeight);

    children.push(
        <Menu.MenuItem
            id={GIFMAKER_ID}
            label="Make GIF"
            action={() => openModal(modalProps => <GifMakerModal url={info.url} isVideo={info.isVideo} sourceWidth={info.sourceWidth} sourceHeight={info.sourceHeight} {...modalProps} />)}
        />
    );
};

function clamp(val: number, min: number, max: number, fallback: number): number {
    return Math.max(min, Math.min(max, val || fallback));
}

function getInitialSize(sourceWidth?: number, sourceHeight?: number, storedWidth?: number, storedHeight?: number): [number, number] {
    if (sourceWidth && sourceHeight) {
        const maxW = settings.store.maxWidth;
        const maxH = settings.store.maxHeight;
        if (sourceWidth <= maxW && sourceHeight <= maxH) {
            return [sourceWidth, sourceHeight];
        }
        const scale = Math.min(maxW / sourceWidth, maxH / sourceHeight);
        return [Math.round(sourceWidth * scale), Math.round(sourceHeight * scale)];
    }
    return [storedWidth ?? DEFAULT_OPTIONS.width, storedHeight ?? DEFAULT_OPTIONS.height];
}

function GifMakerModal({ url, isVideo, sourceWidth, sourceHeight, ...props }: RenderModalProps & { url: string; isVideo: boolean; sourceWidth?: number; sourceHeight?: number; }) {
    logger.info("GifMakerModal mounted with url:", url, "isVideo:", isVideo, "sourceWidth:", sourceWidth, "sourceHeight:", sourceHeight);

    const [options, setOptions] = useState<GifMakerOptions>(() => {
        const [width, height] = getInitialSize(sourceWidth, sourceHeight, settings.store.lastWidth, settings.store.lastHeight);
        logger.info("GifMakerModal initial size:", width, "x", height, "(source:", sourceWidth, "x", sourceHeight, "last:", settings.store.lastWidth, "x", settings.store.lastHeight, ")");
        return {
            width: width, height: height,
            fps: settings.store.lastFps,
            maxDuration: settings.store.lastMaxDuration,
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
    const generationRef = useRef(0);
    optionsRef.current = options;

    const patch = (partial: Partial<GifMakerOptions>) => {
        setOptions(prev => {
            const next = { ...prev, ...partial };
            settings.store.lastWidth = next.width;
            settings.store.lastHeight = next.height;
            settings.store.lastFps = next.fps;
            settings.store.lastMaxDuration = next.maxDuration;
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
        logger.info("useEffect sourceWidth/sourceHeight:", sourceWidth, sourceHeight);
        if (sourceWidth && sourceHeight) {
            const [w, h] = getInitialSize(sourceWidth, sourceHeight);
            logger.info("useEffect: source dims available, setting to", w, "x", h);
            setOptions(prev => ({ ...prev, width: w, height: h }));
            return;
        }
        // Try to auto-detect natural dimensions from the URL
        if (isVideo) {
            logger.info("useEffect: no source dims and isVideo, can't auto-detect");
            return;
        }
        logger.info("useEffect: no source dims, trying auto-detect from URL:", url);
        const img = new Image();
        img.onload = () => {
            logger.info("useEffect: auto-detect loaded", img.naturalWidth, "x", img.naturalHeight);
            const [w, h] = getInitialSize(img.naturalWidth, img.naturalHeight);
            logger.info("useEffect: auto-detect setting to", w, "x", h);
            setOptions(prev => ({ ...prev, width: w, height: h }));
        };
        img.onerror = () => {
            logger.info("useEffect: auto-detect failed to load image");
        };
        img.src = url;
    }, [sourceWidth, sourceHeight]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const gen = ++generationRef.current;
            setGenerating(true);

            const { current } = optionsRef;
            createGif(url, isVideo, current).then(blob => {
                if (gen !== generationRef.current) {
                    URL.revokeObjectURL(URL.createObjectURL(blob));
                    return;
                }
                setError(null);
                setGifBlob(blob);
                setPreviewUrl(prev => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(blob);
                });
                setGenerating(false);
            }).catch((err: unknown) => {
                if (gen !== generationRef.current) return;
                logger.error("GIF generation failed", err);
                setError(err instanceof Error ? err.message : String(err));
                setGenerating(false);
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [JSON.stringify(options.effectTypes), options.width, options.height, options.fps, options.maxDuration, options.grayscale, options.captionMode, options.captionText, options.captionSize, options.bubbleTipX, options.bubbleTipY, options.bubbleTipBase]);

    const handlePreviewClick = (e: React.MouseEvent<HTMLImageElement>) => {
        if (options.captionMode !== "speechbubble") return;
        const img = previewRef.current;
        if (!img) return;

        const rect = img.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * options.width;
        const y = (e.clientY - rect.top) / rect.height * options.height;
        patch({ bubbleTipX: x, bubbleTipY: y });
    };

    const handleExport = () => {
        if (!gifBlob) return;
        saveFile(new File([gifBlob], "export.gif", { type: "image/gif" }));
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
            <div className={cl("modal-body")}>
                <div className={cl("preview-section")}>
                    <div className={cl("preview-wrapper")}>
                        <img
                            ref={previewRef}
                            alt="GIF preview"
                            src={previewUrl ?? ""}
                            onClick={handlePreviewClick}
                            className={cl("preview", { "preview-generating": generating, "preview-crosshair": options.captionMode === "speechbubble" })}
                        />

                        {generating && (
                            <div className={cl("generating-overlay")}>
                                Generating GIF...
                            </div>
                        )}

                        {error && !generating && (
                            <div className={cl("error-overlay")}>
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                <div className={cl("controls-section")}>

                    <div className={cl("section-heading")}>Captions</div>
                    <div className={cl("tab-row")}>
                        {CAPTIONS.map(c => (
                            <button
                                key={c.type}
                                onClick={() => patch({ captionMode: c.type })}
                                className={cl("tab-btn", { "tab-btn-active": options.captionMode === c.type })}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>

                    {options.captionMode === "caption" && (
                        <div className={cl("section")}>
                            <div style={{ marginBottom: "8px" }}>
                                <label className={cl("label")}>Text</label>
                                <input
                                    type="text"
                                    value={options.captionText}
                                    onChange={e => patch({ captionText: e.target.value })}
                                    placeholder="Enter caption..."
                                    className={cl("input")}
                                />
                            </div>
                            <div>
                                <label className={cl("label")}>Font Size: {options.captionSize}px</label>
                                <input
                                    type="range"
                                    min={10}
                                    max={120}
                                    value={options.captionSize}
                                    onChange={e => patch({ captionSize: Number(e.target.value) })}
                                    className={cl("slider")}
                                />
                            </div>
                        </div>
                    )}

                    {options.captionMode === "speechbubble" && (
                        <div className={cl("section")}>
                            <div className={cl("section-hint")}>
                                Click on the preview to position the bubble tip
                            </div>
                            <div>
                                <label className={cl("label")}>Tip Base: {Math.round(options.bubbleTipBase * 100)}%</label>
                                <input
                                    type="range"
                                    min={0}
                                    max={80}
                                    value={Math.round(options.bubbleTipBase * 100)}
                                    onChange={e => patch({ bubbleTipBase: Number(e.target.value) / 100 })}
                                    className={cl("slider")}
                                />
                            </div>
                        </div>
                    )}

                    <div className={cl("section-heading")}>Effects</div>
                    <div className={cl("tab-row")}>
                        <button
                            onClick={() => patch({ effectTypes: [] })}
                            className={cl("tab-btn", { "tab-btn-active": options.effectTypes.length === 0 })}
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
                                className={cl("tab-btn", { "tab-btn-active": options.effectTypes.includes(e.type) })}
                            >
                                {e.name}
                            </button>
                        ))}
                    </div>

                    <div className={cl("dims-row")}>
                        <div className={cl("field")}>
                            <label className={cl("label")}>FPS</label>
                            <input
                                type="number"
                                min={1}
                                max={60}
                                step={1}
                                value={options.fps}
                                onChange={e => patch({ fps: Number(e.target.value) })}
                                onBlur={e => patch({ fps: clamp(Number(e.target.value), 1, 60, 10) })}
                                className={cl("input")}
                            />
                        </div>
                        <div className={cl("field")}>
                            <label className={cl("label")}>Duration (s)</label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                step={0.5}
                                value={options.maxDuration}
                                onChange={e => patch({ maxDuration: Number(e.target.value) })}
                                onBlur={e => patch({ maxDuration: clamp(Number(e.target.value), 1, 10, 3) })}
                                className={cl("input")}
                            />
                        </div>
                    </div>

                    <div className={cl("section-heading")}>Dimensions</div>
                    <div className={cl("dims-row")}>
                        <div className={cl("field")}>
                            <label className={cl("label")}>Width</label>
                            <input
                                type="number"
                                min={32}
                                max={1024}
                                value={options.width}
                                onChange={e => patch({ width: Number(e.target.value) })}
                                onBlur={e => patch({ width: clamp(Number(e.target.value), 32, 1024, 32) })}
                                className={cl("input")}
                            />
                        </div>
                        <div className={cl("field")}>
                            <label className={cl("label")}>Height</label>
                            <input
                                type="number"
                                min={32}
                                max={1024}
                                value={options.height}
                                onChange={e => patch({ height: Number(e.target.value) })}
                                onBlur={e => patch({ height: clamp(Number(e.target.value), 32, 1024, 32) })}
                                className={cl("input")}
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
    managedStyle: css,
});
