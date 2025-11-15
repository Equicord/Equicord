/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { FormSwitch } from "@components/FormSwitch";
import { Devs } from "@utils/constants";
import { getCurrentChannel } from "@utils/discord";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Button, Menu, UploadHandler, useEffect, useState } from "@webpack/common";
import { applyPalette, GIFEncoder, quantize } from "gifenc";

import { QuoteIcon } from "./components";
import { canvasToBlob, fetchImageAsBlob, FixUpQuote } from "./utils";

interface QuoteImageOptions {
    avatarUrl: string;
    quoteOld: string;
    grayScale: boolean;
    author: {
        username: string;
        globalName?: string;
        id: string;
    };
    watermark?: string;
    showWatermark?: boolean;
    saveAsGif?: boolean;
}

const settings = definePluginSettings({
    watermark: {
        type: OptionType.STRING,
        description: "Custom watermark text (max 32 characters)",
        default: "Made with Equicord"
    }
});

export default definePlugin({
    name: "Quoter",
    description: "Adds the ability to create an inspirational quote image from a message",
    authors: [Devs.Samwich, Devs.thororen],
    settings,
    contextMenus: {
        "message": (children, { message }) => {
            if (!message.content) return;
            const buttonElement = (
                <Menu.MenuItem
                    id="vc-quote"
                    label="Quote"
                    icon={QuoteIcon}
                    action={() => openModal(props => <QuoteModal message={message} {...props} />)}
                />
            );

            const group = findGroupChildrenByChildId("copy-text", children);
            if (!group) children.push(buttonElement);
            else group.splice(group.findIndex(c => c?.props?.id === "copy-text") + 1, 0, buttonElement);
        }
    }
});

function sizeUpgrade(url: string) {
    const u = new URL(url);
    u.searchParams.set("size", "512");
    return u.toString();
}

async function ensureFontLoaded(): Promise<void> {
    const fontName = "M PLUS Rounded 1c";

    if (document.fonts.check(`300 12px "${fontName}"`)) {
        return;
    }

    try {
        const font = new FontFace(
            fontName,
            'url(https://fonts.gstatic.com/s/mplusrounded1c/v15/VdGCAYIAV6gnpUpoWwNkYvrugw9RuM3ixLsg6-av1x0.woff2) format("woff2")',
            { weight: "300", style: "normal" }
        );
        await font.load();
        document.fonts.add(font);
    } catch (error) {
        console.warn("[Quoter] Font loading failed:", error);
    }
}

async function canvasToGif(canvas: HTMLCanvasElement): Promise<Blob> {
    const gif = GIFEncoder();
    const ctx = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);

    gif.writeFrame(index, canvas.width, canvas.height, {
        transparent: false,
        palette,
    });

    gif.finish();
    return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" });
}

async function createQuoteImage(options: QuoteImageOptions): Promise<Blob> {
    const { avatarUrl, quoteOld, grayScale, author, watermark, showWatermark, saveAsGif } = options;

    await ensureFontLoaded();

    const quote = FixUpQuote(quoteOld);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cant get 2d rendering context :(");

    const name = author.globalName || author.username;

    const cardWidth = 1200;
    const cardHeight = 600;
    canvas.width = cardWidth;
    canvas.height = cardHeight;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    const avatarBlob = await fetchImageAsBlob(avatarUrl);
    const avatar = new Image();

    await new Promise<void>(resolve => {
        avatar.onload = () => resolve();
        avatar.src = URL.createObjectURL(avatarBlob);
    });

    ctx.drawImage(avatar, 0, 0, cardHeight, cardHeight);

    if (grayScale) {
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, cardWidth, cardHeight);
        ctx.globalCompositeOperation = "source-over";
    }

    const gradient = ctx.createLinearGradient(cardHeight - 400, 0, cardHeight, 0);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.7)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(cardHeight - 400, 0, 400, cardHeight);

    const quoteWidth = cardWidth / 2 - 80;
    const quoteX = cardWidth - cardHeight + 40;
    const maxContentHeight = cardHeight * 0.8;

    const calculateLines = (text: string, fontSize: number): string[] => {
        ctx.font = `300 ${fontSize}px 'M PLUS Rounded 1c', sans-serif`;
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine: string[] = [];

        words.forEach(word => {
            const testLine = [...currentLine, word].join(" ");
            if (ctx.measureText(testLine).width > quoteWidth && currentLine.length > 0) {
                lines.push(currentLine.join(" "));
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        });

        if (currentLine.length > 0) {
            lines.push(currentLine.join(" "));
        }

        return lines;
    };

    let fontSize = 50;
    let lineHeight = fontSize * 1.25;
    let lines: string[] = [];
    let authorFontSize = 24;
    let usernameFontSize = 18;
    let totalHeight = 0;

    while (fontSize >= 18) {
        lines = calculateLines(quote, fontSize);
        lineHeight = fontSize * 1.25;
        authorFontSize = Math.max(18, fontSize * 0.48);
        usernameFontSize = Math.max(14, fontSize * 0.36);
        const spacing = 40;
        const usernameSpacing = 8;
        totalHeight = (lines.length * lineHeight) + spacing + authorFontSize + usernameSpacing + usernameFontSize;

        if (totalHeight <= maxContentHeight) {
            break;
        }
        fontSize -= 2;
    }

    ctx.fillStyle = "#fff";
    ctx.font = `300 ${fontSize}px 'M PLUS Rounded 1c', sans-serif`;

    let quoteY = (cardHeight - totalHeight) / 2;

    lines.forEach(line => {
        const xOffset = (quoteWidth - ctx.measureText(line).width) / 2;
        quoteY += lineHeight;
        ctx.fillText(line, quoteX + xOffset, quoteY);
    });

    ctx.font = `italic 300 ${authorFontSize}px 'M PLUS Rounded 1c', sans-serif`;
    const authorText = `- ${name}`;
    const authorNameX = quoteX + (quoteWidth - ctx.measureText(authorText).width) / 2;
    const authorNameY = quoteY + 40;
    ctx.fillText(authorText, authorNameX, authorNameY);

    const username = `@${author.username}`;
    ctx.font = `300 ${usernameFontSize}px 'M PLUS Rounded 1c', sans-serif`;
    ctx.fillStyle = "#888";
    const usernameX = quoteX + (quoteWidth - ctx.measureText(username).width) / 2;
    const usernameY = authorNameY + 8 + usernameFontSize;
    ctx.fillText(username, usernameX, usernameY);

    if (showWatermark && watermark) {
        ctx.fillStyle = "#888";
        ctx.font = "300 14px 'M PLUS Rounded 1c', sans-serif";
        const watermarkText = watermark.slice(0, 32);
        const watermarkX = cardWidth - ctx.measureText(watermarkText).width - 20;
        const watermarkY = cardHeight - 20;
        ctx.fillText(watermarkText, watermarkX, watermarkY);
    }

    return saveAsGif ? await canvasToGif(canvas) : await canvasToBlob(canvas);
}

function generateFileNamePreview(message: string) {
    const words = message.split(" ");
    return words.length >= 6 ? words.slice(0, 6).join(" ") : words.join(" ");
}

function QuoteModal({ message, ...props }: ModalProps & { message: Message; }) {
    const [gray, setGray] = useState(true);
    const [showWatermark, setShowWatermark] = useState(false);
    const [saveAsGif, setSaveAsGif] = useState(false);
    const [quoteImage, setQuoteImage] = useState<Blob | null>(null);
    const { watermark } = settings.store;
    const safeContent = message.content ? message.content : "";

    const generateImage = async () => {
        const image = await createQuoteImage({
            avatarUrl: sizeUpgrade(message.author.getAvatarURL()),
            quoteOld: safeContent,
            grayScale: gray,
            author: message.author,
            watermark,
            showWatermark,
            saveAsGif
        });
        setQuoteImage(image);
        document.getElementById("quoterPreview")?.setAttribute("src", URL.createObjectURL(image));
    };

    useEffect(() => { generateImage(); }, [gray, showWatermark, saveAsGif, safeContent, watermark]);

    const Export = () => {
        if (!quoteImage) return;
        const link = document.createElement("a");
        const preview = generateFileNamePreview(safeContent);
        const extension = saveAsGif ? "gif" : "png";
        link.href = URL.createObjectURL(quoteImage);
        link.download = `${preview} - ${message.author.username}.${extension}`;
        link.click();
        link.remove();
    };

    const SendInChat = () => {
        if (!quoteImage) return;
        const preview = generateFileNamePreview(safeContent);
        const extension = saveAsGif ? "gif" : "png";
        const mimeType = saveAsGif ? "image/gif" : "image/png";
        const file = new File([quoteImage], `${preview} - ${message.author.username}.${extension}`, { type: mimeType });
        // @ts-expect-error typing issue
        UploadHandler.promptToUpload([file], getCurrentChannel(), 0);
        props.onClose?.();
    };

    return (
        <ModalRoot {...props} size={ModalSize.MEDIUM}>
            <ModalHeader separator={false}>
                <BaseText color="header-primary" size="lg" weight="semibold" tag="h1" style={{ flexGrow: 1 }}>
                    Catch Them In 4K.
                </BaseText>
                <ModalCloseButton onClick={props.onClose} />
            </ModalHeader>
            <ModalContent scrollbarType="none">
                <img alt="" src="" id="quoterPreview" style={{ borderRadius: "20px", width: "100%" }} />
                <br /><br />
                <br /><br />
                <FormSwitch title="Grayscale" value={gray} onChange={setGray} />
                <FormSwitch title="Watermark" value={showWatermark} onChange={setShowWatermark} description="Customize watermark text in plugin settings" />
                <FormSwitch title="Save as GIF" value={saveAsGif} onChange={setSaveAsGif} description="Saves/Sends the image as a GIF instead of a PNG" />
                <br />
                <Button color={Button.Colors.BRAND} size={Button.Sizes.SMALL} onClick={async () => await Export()} style={{ display: "inline-block", marginRight: "5px" }}>Export</Button>
                <Button color={Button.Colors.BRAND} size={Button.Sizes.SMALL} onClick={async () => await SendInChat()} style={{ display: "inline-block" }}>Send</Button>
            </ModalContent>
            <br />
        </ModalRoot>
    );
}
