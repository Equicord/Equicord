/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { User } from "@vencord/discord-types";
import { IconUtils, UserStore } from "@webpack/common";
import { applyPalette, GIFEncoder, quantize } from "gifenc";

import { CANVAS_CONFIG, CanvasConfig, EMOJI_SIZES, EmojiToken, FONT_SIZES, FontSizeCalculation, QuoteFont, QuoteImageOptions, SPACING, TextLine, TextSegment } from "./types";

const logger = new Logger("Quoter");

export function sizeUpgrade(url: string): string {
    const u = new URL(url);
    u.searchParams.set("size", "512");
    return u.toString();
}

export function canvasToBlob(canvas: OffscreenCanvas): Promise<Blob> {
    return canvas.convertToBlob({ type: "image/png" });
}

export async function fetchImageAsBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    return response.blob();
}

export function fixUpQuote(quote: string): string {
    return quote.replace(/<@!?(\d+)>/g, (_, id) => {
        const user = UserStore.getUser(id);
        return user ? `@${user.username}` : _;
    });
}

export function parseEmojis(text: string): EmojiToken[] {
    const tokens: EmojiToken[] = [];
    const matches: { index: number; end: number; emojiId: string }[] = [];

    for (const match of text.matchAll(/<a?:[\w]+:(\d+)>/g)) {
        matches.push({ index: match.index!, end: match.index! + match[0].length, emojiId: match[1] });
    }

    for (const match of text.matchAll(/\([^)]+\)\(https?:\/\/[^/]*discord[^/]*\.com\/emojis\/(\d+)\.(?:webp|png|gif)(?:\?[^)]*)?\)/g)) {
        matches.push({ index: match.index!, end: match.index! + match[0].length, emojiId: match[1] });
    }

    matches.sort((a, b) => a.index - b.index);

    let lastIndex = 0;
    for (const { index, end, emojiId } of matches) {
        if (index > lastIndex) {
            tokens.push({ type: "text", value: text.slice(lastIndex, index) });
        }
        tokens.push({ type: "custom_emoji", value: text.slice(index, end), emojiId });
        lastIndex = end;
    }

    if (lastIndex < text.length) {
        tokens.push({ type: "text", value: text.slice(lastIndex) });
    }

    return tokens;
}

const emojiCache = new Map<string, ImageBitmap>();

export function clearEmojiCaches(): void {
    emojiCache.clear();
}

async function loadEmojiImage(emojiId: string, fontSize: number): Promise<ImageBitmap | null> {
    const cacheKey = `${emojiId}-${fontSize}`;
    if (emojiCache.has(cacheKey)) return emojiCache.get(cacheKey)!;

    const url = IconUtils.getEmojiURL({ id: emojiId, animated: false, size: 64 });

    try {
        const response = await fetch(url, { credentials: "omit" });
        const bitmap = await createImageBitmap(await response.blob());
        emojiCache.set(cacheKey, bitmap);
        return bitmap;
    } catch (err) {
        logger.error("Failed to load emoji image:", url, err);
        return null;
    }
}

export function generateFileNamePreview(message: string): string {
    return message.split(" ").slice(0, 6).join(" ").slice(0, 10);
}

export function getFileExtension(saveAsGif: boolean): string {
    return saveAsGif ? "gif" : "png";
}

export function getMimeType(saveAsGif: boolean): string {
    return saveAsGif ? "image/gif" : "image/png";
}

let fontLoadingPromise: Promise<void> | null = null;

const FONTS = [
    { family: "M PLUS Rounded 1c", weight: "300", url: "https://fonts.gstatic.com/s/mplusrounded1c/v15/VdGCAYIAV6gnpUpSW3G6Hw2_Xs1_5_C7O6GwwGwwGww.woff2" },
    { family: "Open Sans", weight: "300", url: "https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsiH0B4gaVI.woff2" },
    { family: "Momo Signature", weight: "400", url: "https://fonts.gstatic.com/s/momosignature/v16/ZgN0jOe4NxSyZx92xJ9zd7q6E8rEyWta84fA.woff2" },
    { family: "Lora", weight: "400", url: "https://fonts.gstatic.com/s/lora/v35/0QIvMX1D_JOuMwT7I-NP.woff2" },
    { family: "Merriweather", weight: "300", url: "https://fonts.gstatic.com/s/merriweather/v30/u-4n0qyriQwlOrhSvowK_l521wRpWk4.woff2" }
];

export async function ensureFontLoaded(): Promise<void> {
    if (fontLoadingPromise) return fontLoadingPromise;

    fontLoadingPromise = (async () => {
        await Promise.all(FONTS.map(async ({ family, weight, url }) => {
            try {
                const response = await fetch(url);
                const fontFace = new FontFace(family, await response.arrayBuffer(), { weight });
                await fontFace.load();
                (self as any).fonts?.add(fontFace);
            } catch (err) {
                logger.error(`Failed to load font: ${family}`, err);
            }
        }));
        await new Promise(r => setTimeout(r, 100));
    })();

    return fontLoadingPromise;
}

export function resetFontLoading() {
    fontLoadingPromise = null;
}

async function canvasToGif(canvas: OffscreenCanvas): Promise<Blob> {
    const ctx = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 256);

    const gif = GIFEncoder();
    gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, { palette });
    gif.finish();

    return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" });
}

async function loadAvatarImage(avatarUrl: string): Promise<ImageBitmap> {
    return createImageBitmap(await fetchImageAsBlob(avatarUrl));
}

function applyGrayscaleFilter(ctx: OffscreenCanvasRenderingContext2D, config: CanvasConfig): void {
    ctx.globalCompositeOperation = "saturation";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, config.width, config.height);
    ctx.globalCompositeOperation = "source-over";
}

function drawGradientOverlay(ctx: OffscreenCanvasRenderingContext2D, config: CanvasConfig): void {
    const gradient = ctx.createLinearGradient(config.height - SPACING.gradientWidth, 0, config.height, 0);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(config.height - SPACING.gradientWidth, 0, SPACING.gradientWidth, config.height);
}

const EMOJI_SIZE_SCALE = EMOJI_SIZES.custom / FONT_SIZES.initial;

function measureSegment(ctx: OffscreenCanvasRenderingContext2D, token: EmojiToken, fontSize: number): TextSegment {
    return token.type === "text"
        ? { type: "text", text: token.value, width: ctx.measureText(token.value).width }
        : { type: "emoji", emojiToken: token, width: fontSize * EMOJI_SIZE_SCALE };
}

function calculateTextLinesWithEmoji(
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    fontSize: number,
    font: QuoteFont,
    maxWidth: number
): TextLine[] {
    ctx.font = `300 ${fontSize}px '${font}', sans-serif`;
    const segments = parseEmojis(text).map(t => measureSegment(ctx, t, fontSize));
    const lines: TextLine[] = [];
    let currentLine: TextLine = { segments: [], totalWidth: 0, emojiCount: 0 };

    const pushLine = () => {
        if (currentLine.segments.length > 0) {
            lines.push(currentLine);
            currentLine = { segments: [], totalWidth: 0, emojiCount: 0 };
        }
    };

    for (const segment of segments) {
        if (segment.type === "text" && segment.text) {
            for (const word of segment.text.split(/(\s+)/)) {
                if (!word) continue;

                if (/^\s+$/.test(word)) {
                    const w = ctx.measureText(word).width;
                    if (currentLine.totalWidth + w <= maxWidth) {
                        currentLine.segments.push({ type: "text", text: word, width: w });
                        currentLine.totalWidth += w;
                    }
                    continue;
                }

                const wordWidth = ctx.measureText(word).width;

                if (wordWidth > maxWidth) {
                    pushLine();
                    let chunk = "";
                    for (const char of word) {
                        const testWidth = ctx.measureText(chunk + char).width;
                        if (testWidth > maxWidth && chunk) {
                            currentLine.segments.push({ type: "text", text: chunk, width: ctx.measureText(chunk).width });
                            currentLine.totalWidth += ctx.measureText(chunk).width;
                            pushLine();
                            chunk = char;
                        } else {
                            chunk += char;
                        }
                    }
                    if (chunk) {
                        currentLine.segments.push({ type: "text", text: chunk, width: ctx.measureText(chunk).width });
                        currentLine.totalWidth += ctx.measureText(chunk).width;
                    }
                } else if (currentLine.totalWidth + wordWidth > maxWidth) {
                    pushLine();
                    currentLine.segments.push({ type: "text", text: word, width: wordWidth });
                    currentLine.totalWidth += wordWidth;
                } else {
                    currentLine.segments.push({ type: "text", text: word, width: wordWidth });
                    currentLine.totalWidth += wordWidth;
                }
            }
        } else if (segment.type === "emoji") {
            if (currentLine.totalWidth + segment.width > maxWidth) pushLine();
            currentLine.segments.push(segment);
            currentLine.totalWidth += segment.width;
            currentLine.emojiCount++;
        }
    }

    pushLine();
    return lines;
}

function calculateFontSizeMetrics(fontSize: number, lines: TextLine[]) {
    const lineHeight = fontSize * FONT_SIZES.lineHeightMultiplier;
    const authorFontSize = Math.max(FONT_SIZES.authorMinimum, fontSize * FONT_SIZES.authorMultiplier);
    const usernameFontSize = Math.max(FONT_SIZES.usernameMinimum, fontSize * FONT_SIZES.usernameMultiplier);
    const totalHeight = lines.length * lineHeight + SPACING.authorTop + authorFontSize + SPACING.username + usernameFontSize;
    return { lineHeight, authorFontSize, usernameFontSize, totalHeight };
}

async function calculateOptimalFontSize(
    ctx: OffscreenCanvasRenderingContext2D,
    quote: string,
    font: QuoteFont,
    config: CanvasConfig
): Promise<FontSizeCalculation> {
    for (let fontSize = FONT_SIZES.initial; fontSize >= FONT_SIZES.minimum; fontSize -= FONT_SIZES.decrement) {
        const lines = calculateTextLinesWithEmoji(ctx, quote, fontSize, font, config.quoteAreaWidth);
        const metrics = calculateFontSizeMetrics(fontSize, lines);
        if (metrics.totalHeight <= config.maxContentHeight) {
            return { fontSize, ...metrics, lines };
        }
    }

    const lines = calculateTextLinesWithEmoji(ctx, quote, FONT_SIZES.minimum, font, config.quoteAreaWidth);
    const metrics = calculateFontSizeMetrics(FONT_SIZES.minimum, lines);
    return { fontSize: FONT_SIZES.minimum, ...metrics, lines };
}

async function collectAndDrawEmojis(
    ctx: OffscreenCanvasRenderingContext2D,
    calculation: FontSizeCalculation,
    config: CanvasConfig
): Promise<void> {
    const positions: { x: number; y: number; size: number; emojiId: string }[] = [];
    let quoteY = (config.height - calculation.totalHeight) / 2;

    for (const line of calculation.lines) {
        const lineWidth = line.segments.reduce((sum, s) => sum + s.width, 0);
        let currentX = config.quoteAreaX + (config.quoteAreaWidth - lineWidth) / 2;
        quoteY += calculation.lineHeight;

        for (const segment of line.segments) {
            if (segment.type === "emoji" && segment.emojiToken?.emojiId) {
                positions.push({
                    x: currentX,
                    y: quoteY - calculation.fontSize * 0.85,
                    size: segment.width,
                    emojiId: segment.emojiToken.emojiId
                });
            }
            currentX += segment.width;
        }
    }

    const bitmaps = await Promise.all(
        positions.map(async p => {
            const bitmap = await loadEmojiImage(p.emojiId, calculation.fontSize);
            return bitmap ? { ...p, bitmap } : null;
        })
    );

    for (const emoji of bitmaps) {
        if (emoji) ctx.drawImage(emoji.bitmap, emoji.x, emoji.y, emoji.size, emoji.size);
    }
}

async function drawQuoteText(
    ctx: OffscreenCanvasRenderingContext2D,
    calculation: FontSizeCalculation,
    font: QuoteFont,
    config: CanvasConfig
): Promise<number> {
    ctx.fillStyle = "#fff";
    ctx.font = `300 ${calculation.fontSize}px '${font}', sans-serif`;

    let quoteY = (config.height - calculation.totalHeight) / 2;

    for (const line of calculation.lines) {
        const lineWidth = line.segments.reduce((sum, s) => sum + s.width, 0);
        let currentX = config.quoteAreaX + (config.quoteAreaWidth - lineWidth) / 2;
        quoteY += calculation.lineHeight;

        for (const segment of line.segments) {
            if (segment.type === "text" && segment.text) {
                ctx.fillText(segment.text, currentX, quoteY);
            }
            currentX += segment.width;
        }
    }

    return quoteY;
}

function drawAuthorInfo(
    ctx: OffscreenCanvasRenderingContext2D,
    author: User,
    calculation: FontSizeCalculation,
    config: CanvasConfig,
    startY: number
): void {
    const name = author.globalName || author.username;
    const centerX = (text: string) => config.quoteAreaX + (config.quoteAreaWidth - ctx.measureText(text).width) / 2;

    ctx.font = `italic 300 ${calculation.authorFontSize}px 'M PLUS Rounded 1c', sans-serif`;
    ctx.fillStyle = "#fff";
    const authorText = `- ${name}`;
    const authorY = startY + SPACING.authorTop;
    ctx.fillText(authorText, centerX(authorText), authorY);

    ctx.font = `300 ${calculation.usernameFontSize}px 'M PLUS Rounded 1c', sans-serif`;
    ctx.fillStyle = "#888";
    const username = `@${author.username}`;
    ctx.fillText(username, centerX(username), authorY + SPACING.username + calculation.usernameFontSize);
}

function drawWatermark(ctx: OffscreenCanvasRenderingContext2D, watermark: string, config: CanvasConfig): void {
    const text = watermark.slice(0, 32);
    ctx.fillStyle = "#888";
    ctx.font = `300 ${FONT_SIZES.watermark}px 'M PLUS Rounded 1c', sans-serif`;
    ctx.fillText(text, config.width - ctx.measureText(text).width - SPACING.watermarkPadding, config.height - SPACING.watermarkPadding);
}

export async function createQuoteImage(options: QuoteImageOptions): Promise<Blob> {
    const { avatarUrl, quote: rawQuote, grayScale, author, watermark, showWatermark, saveAsGif, quoteFont, renderEmoji } = options;

    await ensureFontLoaded();

    let quote = fixUpQuote(rawQuote);

    if (!renderEmoji) {
        quote = quote
            .replace(/<a?:[\w]+:\d+>/g, "")
            .replace(/\[[^\]]+\]\(https:\/\/cdn\.discordapp\.com\/emojis\/\d+\.[^)]+\)/g, "")
            .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu, "");
    }

    quote = quote.replace(/\s+/g, " ").trim();

    const canvas = new OffscreenCanvas(CANVAS_CONFIG.width, CANVAS_CONFIG.height);
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);

    ctx.drawImage(await loadAvatarImage(avatarUrl), 0, 0, CANVAS_CONFIG.height, CANVAS_CONFIG.height);

    if (grayScale) applyGrayscaleFilter(ctx, CANVAS_CONFIG);
    drawGradientOverlay(ctx, CANVAS_CONFIG);

    const calculation = await calculateOptimalFontSize(ctx, quote, quoteFont, CANVAS_CONFIG);

    const quoteEndY = await drawQuoteText(ctx, calculation, quoteFont, CANVAS_CONFIG);

    if (renderEmoji) {
        await collectAndDrawEmojis(ctx, calculation, CANVAS_CONFIG);
    }

    drawAuthorInfo(ctx, author, calculation, CANVAS_CONFIG, quoteEndY);

    if (showWatermark && watermark) {
        drawWatermark(ctx, watermark, CANVAS_CONFIG);
    }

    return saveAsGif ? canvasToGif(canvas) : canvasToBlob(canvas);
}
