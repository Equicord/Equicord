/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { copyToClipboard } from "@utils/clipboard";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { isObject, parseUrl } from "@utils/misc";
import { saveFile } from "@utils/web";
import { Embed, EmbedMedia, MessageComponent } from "@vencord/discord-types";
import { Alerts, moment, showToast, Toasts } from "@webpack/common";

import { settings } from "./settings";
import { EmbedAsset, PreviewEmbed, PreviewMedia, WebhookAuthor, WebhookEmbed, WebhookField, WebhookFooter } from "./types";

export const cl = classNameFactory("vc-embed-studio-");
export const logger = new Logger("EmbedStudio");

export const EmbedLimits = {
    title: 256,
    description: 4096,
    fields: 25,
    fieldName: 256,
    fieldValue: 1024,
    footerText: 2048,
    authorName: 256,
    total: 6000
} as const;

export const newFieldKey = () => crypto.randomUUID();

export function intToHex(color: number) {
    return `#${color.toString(16).padStart(6, "0")}`;
}

export function hexToInt(hex: string): number | undefined {
    const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
    if (!match) return undefined;
    return parseInt(match[1], 16);
}

export function intToRgb(color: number) {
    return {
        r: (color >> 16) & 0xff,
        g: (color >> 8) & 0xff,
        b: color & 0xff
    };
}

function hslToInt(h: number, s: number, l: number): number {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let rgb: [number, number, number];
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    const [r, g, b] = rgb.map(v => Math.round((v + m) * 255));
    return (r << 16) | (g << 8) | b;
}

export function parseDiscordColor(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value))
        return Math.max(0, Math.min(0xffffff, Math.round(value)));
    if (typeof value !== "string" || !value) return undefined;

    const hex = hexToInt(value);
    if (hex !== undefined) return hex;

    const hsl = value.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+(?:calc\([^)]*?([\d.]+)%\)|([\d.]+)%)[\s,]+([\d.]+)%/i);
    if (hsl) return hslToInt(parseFloat(hsl[1]), parseFloat(hsl[2] ?? hsl[3]), parseFloat(hsl[4]));

    const rgb = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
    if (rgb) return (parseInt(rgb[1], 10) << 16) | (parseInt(rgb[2], 10) << 8) | parseInt(rgb[3], 10);

    logger.warn("Could not parse embed color", value);
    return undefined;
}

export function toWebhookEmbed(embed: Embed): WebhookEmbed {
    const imageUrl = embed.image?.url || embed.images?.[0]?.url;
    return {
        title: embed.rawTitle || undefined,
        description: embed.rawDescription || undefined,
        url: embed.url || undefined,
        color: parseDiscordColor(embed.color),
        timestamp: embed.timestamp ? moment(embed.timestamp).toISOString() : undefined,
        author: embed.author?.name ? {
            name: embed.author.name,
            url: embed.author.url || undefined,
            icon_url: embed.author.iconURL || embed.author.iconProxyURL || undefined
        } : undefined,
        thumbnail: embed.thumbnail?.url ? { url: embed.thumbnail.url } : undefined,
        image: imageUrl ? { url: imageUrl } : undefined,
        footer: embed.footer?.text ? {
            text: embed.footer.text,
            icon_url: embed.footer.iconURL || embed.footer.iconProxyURL || undefined
        } : undefined,
        fields: (embed.fields ?? []).map(f => ({
            key: newFieldKey(),
            name: f.rawName,
            value: f.rawValue,
            inline: !!f.inline
        }))
    };
}

export function toPreviewEmbed(embed: WebhookEmbed, media: { image: PreviewMedia | null; thumbnail: PreviewMedia | null; }): PreviewEmbed {
    return {
        id: "vc-embed-studio-preview",
        url: embed.url,
        rawTitle: embed.title,
        rawDescription: embed.description,
        color: embed.color !== undefined ? intToHex(embed.color) : undefined,
        author: embed.author?.name ? {
            name: embed.author.name,
            url: embed.author.url,
            iconURL: embed.author.icon_url,
            iconProxyURL: embed.author.icon_url
        } : undefined,
        footer: embed.footer?.text ? {
            text: embed.footer.text,
            iconURL: embed.footer.icon_url,
            iconProxyURL: embed.footer.icon_url
        } : undefined,
        timestamp: embed.timestamp ? moment(embed.timestamp) : undefined,
        thumbnail: media.thumbnail ?? undefined,
        image: media.image ?? undefined,
        fields: embed.fields.map(f => ({
            rawName: f.name,
            rawValue: f.value,
            inline: f.inline
        }))
    };
}

export interface EmbedUsage {
    total: number;
    title: number;
    description: number;
    footer: number;
    author: number;
}

export function getUsage(embed: WebhookEmbed): EmbedUsage {
    const title = embed.title?.length ?? 0;
    const description = embed.description?.length ?? 0;
    const footer = embed.footer?.text.length ?? 0;
    const author = embed.author?.name.length ?? 0;
    const fields = embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0);
    return {
        total: title + description + footer + author + fields,
        title,
        description,
        footer,
        author
    };
}

function isValidHttpUrl(url: string) {
    const parsed = parseUrl(url);
    return parsed !== null && (parsed.protocol === "https:" || parsed.protocol === "http:");
}

export function validateEmbed(embed: WebhookEmbed): string[] {
    const warnings: string[] = [];
    const usage = getUsage(embed);

    if (usage.title > EmbedLimits.title)
        warnings.push(`Title exceeds ${EmbedLimits.title} characters.`);
    if (usage.description > EmbedLimits.description)
        warnings.push(`Description exceeds ${EmbedLimits.description} characters.`);
    if (usage.footer > EmbedLimits.footerText)
        warnings.push(`Footer text exceeds ${EmbedLimits.footerText} characters.`);
    if (usage.author > EmbedLimits.authorName)
        warnings.push(`Author name exceeds ${EmbedLimits.authorName} characters.`);
    if (usage.total > EmbedLimits.total)
        warnings.push(`Total embed length exceeds ${EmbedLimits.total} characters.`);
    if (embed.fields.length > EmbedLimits.fields)
        warnings.push(`Embeds allow at most ${EmbedLimits.fields} fields.`);

    embed.fields.forEach((field, i) => {
        if (!field.name.trim() || !field.value.trim())
            warnings.push(`Field ${i + 1} needs both a name and a value.`);
        if (field.name.length > EmbedLimits.fieldName)
            warnings.push(`Field ${i + 1} name exceeds ${EmbedLimits.fieldName} characters.`);
        if (field.value.length > EmbedLimits.fieldValue)
            warnings.push(`Field ${i + 1} value exceeds ${EmbedLimits.fieldValue} characters.`);
    });

    const urls: [string, string | undefined][] = [
        ["Embed URL", embed.url],
        ["Author URL", embed.author?.url],
        ["Author icon URL", embed.author?.icon_url],
        ["Thumbnail URL", embed.thumbnail?.url],
        ["Image URL", embed.image?.url],
        ["Footer icon URL", embed.footer?.icon_url]
    ];
    for (const [label, url] of urls) {
        if (url && !isValidHttpUrl(url))
            warnings.push(`${label} is not a valid http(s) URL.`);
    }

    if (embed.timestamp && isNaN(new Date(embed.timestamp).getTime()))
        warnings.push("Timestamp is not a valid date.");

    return warnings;
}

export function cleanForWebhook(embed: WebhookEmbed): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (embed.title) out.title = embed.title;
    if (embed.description) out.description = embed.description;
    if (embed.url) out.url = embed.url;
    if (embed.color !== undefined) out.color = embed.color;
    if (embed.timestamp) out.timestamp = embed.timestamp;
    if (embed.author?.name) {
        const author: Record<string, string> = { name: embed.author.name };
        if (embed.author.url) author.url = embed.author.url;
        if (embed.author.icon_url) author.icon_url = embed.author.icon_url;
        out.author = author;
    }
    if (embed.thumbnail?.url) out.thumbnail = { url: embed.thumbnail.url };
    if (embed.image?.url) out.image = { url: embed.image.url };
    if (embed.footer?.text) {
        const footer: Record<string, string> = { text: embed.footer.text };
        if (embed.footer.icon_url) footer.icon_url = embed.footer.icon_url;
        out.footer = footer;
    }
    if (embed.fields.length) {
        out.fields = embed.fields.map(f => f.inline
            ? { name: f.name, value: f.value, inline: true }
            : { name: f.name, value: f.value }
        );
    }
    return out;
}

export function webhookJson(embed: WebhookEmbed, pretty: boolean) {
    return JSON.stringify({ embeds: [cleanForWebhook(embed)] }, null, pretty ? 2 : undefined);
}

function str(value: unknown): string | undefined {
    return typeof value === "string" && value ? value : undefined;
}

function coerceEmbed(raw: Record<string, unknown>): WebhookEmbed {
    let color: number | undefined;
    if (typeof raw.color === "number" && Number.isInteger(raw.color) && raw.color >= 0 && raw.color <= 0xffffff)
        color = raw.color;
    else if (typeof raw.color === "string")
        color = hexToInt(raw.color);

    let author: WebhookAuthor | undefined;
    if (isObject(raw.author)) {
        const a = raw.author as Record<string, unknown>;
        const name = str(a.name);
        if (name) author = { name, url: str(a.url), icon_url: str(a.icon_url) ?? str(a.iconURL) };
    }

    let footer: WebhookFooter | undefined;
    if (isObject(raw.footer)) {
        const f = raw.footer as Record<string, unknown>;
        const text = str(f.text);
        if (text) footer = { text, icon_url: str(f.icon_url) ?? str(f.iconURL) };
    }

    const mediaUrl = (value: unknown) => {
        if (typeof value === "string") return str(value);
        if (isObject(value)) return str((value as Record<string, unknown>).url);
        return undefined;
    };
    const thumbnailUrl = mediaUrl(raw.thumbnail);
    const imageUrl = mediaUrl(raw.image);

    const fields: WebhookField[] = [];
    if (Array.isArray(raw.fields)) {
        for (const field of raw.fields) {
            if (!isObject(field)) continue;
            const f = field as Record<string, unknown>;
            fields.push({
                key: newFieldKey(),
                name: str(f.name) ?? str(f.rawName) ?? "",
                value: str(f.value) ?? str(f.rawValue) ?? "",
                inline: f.inline === true
            });
        }
    }

    return {
        title: str(raw.title) ?? str(raw.rawTitle),
        description: str(raw.description) ?? str(raw.rawDescription),
        url: str(raw.url),
        color,
        timestamp: str(raw.timestamp),
        author,
        thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
        image: imageUrl ? { url: imageUrl } : undefined,
        footer,
        fields
    };
}

export function parseEmbedJson(text: string): { embed: WebhookEmbed; discardedEmbeds: number; } | { error: string; } {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }

    if (!isObject(raw)) return { error: "JSON must be an object." };

    let obj = raw as Record<string, unknown>;
    let discardedEmbeds = 0;
    if (Array.isArray(obj.embeds)) {
        const [first, ...rest] = obj.embeds;
        if (!isObject(first)) return { error: "The embeds array does not contain an embed object." };
        discardedEmbeds = rest.length;
        obj = first as Record<string, unknown>;
    }

    return { embed: coerceEmbed(obj), discardedEmbeds };
}

function jsString(value: string) {
    return JSON.stringify(value);
}

export function generateJavaScript(embed: WebhookEmbed, typescript: boolean): string {
    const calls: string[] = [];
    if (embed.title) calls.push(`.setTitle(${jsString(embed.title)})`);
    if (embed.description) calls.push(`.setDescription(${jsString(embed.description)})`);
    if (embed.url) calls.push(`.setURL(${jsString(embed.url)})`);
    if (embed.color !== undefined) calls.push(`.setColor(0x${embed.color.toString(16).padStart(6, "0")})`);
    if (embed.author?.name) {
        const parts = [`name: ${jsString(embed.author.name)}`];
        if (embed.author.url) parts.push(`url: ${jsString(embed.author.url)}`);
        if (embed.author.icon_url) parts.push(`iconURL: ${jsString(embed.author.icon_url)}`);
        calls.push(`.setAuthor({ ${parts.join(", ")} })`);
    }
    if (embed.thumbnail?.url) calls.push(`.setThumbnail(${jsString(embed.thumbnail.url)})`);
    if (embed.image?.url) calls.push(`.setImage(${jsString(embed.image.url)})`);
    if (embed.footer?.text) {
        const parts = [`text: ${jsString(embed.footer.text)}`];
        if (embed.footer.icon_url) parts.push(`iconURL: ${jsString(embed.footer.icon_url)}`);
        calls.push(`.setFooter({ ${parts.join(", ")} })`);
    }
    if (embed.timestamp) calls.push(`.setTimestamp(new Date(${jsString(embed.timestamp)}))`);
    if (embed.fields.length) {
        const fields = embed.fields.map(f => `{ name: ${jsString(f.name)}, value: ${jsString(f.value)}, inline: ${f.inline} }`);
        calls.push(`.addFields(\n        ${fields.join(",\n        ")}\n    )`);
    }

    const header = typescript
        ? "import { EmbedBuilder } from \"discord.js\";"
        : "const { EmbedBuilder } = require(\"discord.js\");";
    const builder = calls.length
        ? `new EmbedBuilder()\n    ${calls.join("\n    ")};`
        : "new EmbedBuilder();";

    return `${header}\n\nconst embed = ${builder}\n\n// channel.send({ embeds: [embed] });\n`;
}

export function generatePython(embed: WebhookEmbed): string {
    const ctorArgs: string[] = [];
    if (embed.title) ctorArgs.push(`title=${jsString(embed.title)}`);
    if (embed.description) ctorArgs.push(`description=${jsString(embed.description)}`);
    if (embed.url) ctorArgs.push(`url=${jsString(embed.url)}`);
    if (embed.color !== undefined) ctorArgs.push(`colour=0x${embed.color.toString(16).padStart(6, "0")}`);
    if (embed.timestamp) ctorArgs.push(`timestamp=datetime.fromisoformat(${jsString(embed.timestamp.replace("Z", "+00:00"))})`);

    const calls: string[] = [];
    if (embed.author?.name) {
        const parts = [`name=${jsString(embed.author.name)}`];
        if (embed.author.url) parts.push(`url=${jsString(embed.author.url)}`);
        if (embed.author.icon_url) parts.push(`icon_url=${jsString(embed.author.icon_url)}`);
        calls.push(`embed.set_author(${parts.join(", ")})`);
    }
    if (embed.thumbnail?.url) calls.push(`embed.set_thumbnail(url=${jsString(embed.thumbnail.url)})`);
    if (embed.image?.url) calls.push(`embed.set_image(url=${jsString(embed.image.url)})`);
    if (embed.footer?.text) {
        const parts = [`text=${jsString(embed.footer.text)}`];
        if (embed.footer.icon_url) parts.push(`icon_url=${jsString(embed.footer.icon_url)}`);
        calls.push(`embed.set_footer(${parts.join(", ")})`);
    }
    for (const field of embed.fields)
        calls.push(`embed.add_field(name=${jsString(field.name)}, value=${jsString(field.value)}, inline=${field.inline ? "True" : "False"})`);

    const header = embed.timestamp ? "import discord\nfrom datetime import datetime" : "import discord";
    const ctor = ctorArgs.length ? `discord.Embed(\n    ${ctorArgs.join(",\n    ")}\n)` : "discord.Embed()";

    return `${header}\n\nembed = ${ctor}\n${calls.length ? `${calls.join("\n")}\n` : ""}\n# await channel.send(embed=embed)\n`;
}

export function getAssets(embed: Embed): EmbedAsset[] {
    const assets: EmbedAsset[] = [];
    const push = (label: string, url?: string, proxyURL?: string) => {
        const primary = url || proxyURL;
        if (primary) assets.push({ label, url: primary, proxyURL });
    };
    const pushMedia = (label: string, media?: EmbedMedia) => push(label, media?.url, media?.proxyURL);

    pushMedia("Main image", embed.image);
    embed.images?.forEach((image, i) => pushMedia(`Image ${i + 1}`, image));
    pushMedia("Thumbnail", embed.thumbnail);
    pushMedia("Video", embed.video);
    push("Author icon", embed.author?.iconURL, embed.author?.iconProxyURL);
    push("Footer icon", embed.footer?.iconURL, embed.footer?.iconProxyURL);

    return assets;
}

export function assetFileName(asset: EmbedAsset) {
    const parsed = parseUrl(asset.url);
    const segment = parsed?.pathname.split("/").filter(Boolean).pop();
    if (segment?.includes(".")) return segment;
    return `${asset.label.toLowerCase().replace(/\s+/g, "-")}${segment ? `-${segment}` : ""}.png`;
}

function withDownloadConfirm(description: string, download: () => void) {
    if (!settings.store.confirmBeforeDownload) return download();
    Alerts.show({
        title: "Embed Studio",
        body: `Download ${description}?`,
        confirmText: "Download",
        cancelText: "Cancel",
        onConfirm: download
    });
}

export function downloadTextFile(filename: string, content: string) {
    withDownloadConfirm(filename, () => {
        saveFile(new File([content], filename, { type: "application/json" }));
        if (settings.store.autoCopyAfterExport) {
            copyToClipboard(content);
            showToast(`Downloaded ${filename} and copied its content`, Toasts.Type.SUCCESS);
        } else {
            showToast(`Downloaded ${filename}`, Toasts.Type.SUCCESS);
        }
    });
}

async function fetchAsset(asset: EmbedAsset) {
    try {
        const res = await fetch(asset.proxyURL || asset.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        saveFile(new File([blob], assetFileName(asset), { type: blob.type || "application/octet-stream" }));
    } catch (e) {
        logger.error(`Failed to download ${asset.url}`, e);
        showToast(`Failed to download ${asset.label.toLowerCase()}`, Toasts.Type.FAILURE);
    }
}

export function downloadAsset(asset: EmbedAsset) {
    withDownloadConfirm(asset.label.toLowerCase(), () => { fetchAsset(asset); });
}

export function downloadAllAssets(assets: EmbedAsset[]) {
    withDownloadConfirm(`all ${assets.length} assets`, () => {
        for (const asset of assets) fetchAsset(asset);
    });
}

const TEMPLATE_KEY = "EmbedStudio_templates";

export async function getTemplates(): Promise<Record<string, WebhookEmbed>> {
    return await DataStore.get(TEMPLATE_KEY) ?? {};
}

export async function saveTemplate(name: string, embed: WebhookEmbed) {
    await DataStore.update<Record<string, WebhookEmbed>>(TEMPLATE_KEY, (templates = {}) => ({ ...templates, [name]: embed }));
}

export async function deleteTemplate(name: string) {
    await DataStore.update<Record<string, WebhookEmbed>>(TEMPLATE_KEY, (templates = {}) => {
        const { [name]: _, ...rest } = templates;
        return rest;
    });
}

export function withFreshFieldKeys(embed: WebhookEmbed): WebhookEmbed {
    return { ...embed, fields: (embed.fields ?? []).map(f => ({ ...f, key: newFieldKey() })) };
}

export const CV2 = {
    ActionRow: 1,
    Section: 9,
    TextDisplay: 10,
    Thumbnail: 11,
    MediaGallery: 12,
    Separator: 14,
    Container: 17
} as const;

function prop(value: unknown, ...keys: string[]): unknown {
    if (!isObject(value)) return undefined;
    for (const key of keys) {
        const found = (value as Record<string, unknown>)[key];
        if (found !== undefined) return found;
    }
    return undefined;
}

function cv2Media(value: unknown): EmbedMedia | undefined {
    const url = prop(value, "url");
    if (typeof url !== "string" || !url) return undefined;
    const proxy = prop(value, "proxy_url", "proxyUrl", "proxyURL");
    const width = prop(value, "width");
    const height = prop(value, "height");
    return {
        url,
        proxyURL: typeof proxy === "string" && proxy ? proxy : url,
        width: typeof width === "number" ? width : 0,
        height: typeof height === "number" ? height : 0,
        placeholder: "",
        placeholderVersion: 0,
        srcIsAnimated: false,
        flags: 0,
        contentType: ""
    };
}

export function cv2ToEmbed(components: MessageComponent[], accentColor: number | undefined, id: string): Embed {
    const textParts: string[] = [];
    const media: EmbedMedia[] = [];
    let thumbnail: EmbedMedia | undefined;

    const walk = (list: MessageComponent[]) => {
        for (const component of list) {
            const type = component.type as number;
            if (type === CV2.TextDisplay) {
                const content = prop(component, "content");
                if (typeof content === "string" && content.trim()) textParts.push(content);
            } else if (type === CV2.Section) {
                walk(component.components ?? []);
                const accessory = prop(component, "accessory");
                if (prop(accessory, "type") === CV2.Thumbnail) {
                    const accessoryMedia = cv2Media(prop(accessory, "media"));
                    if (accessoryMedia && !thumbnail) thumbnail = accessoryMedia;
                }
            } else if (type === CV2.Thumbnail) {
                const thumbnailMedia = cv2Media(prop(component, "media"));
                if (thumbnailMedia && !thumbnail) thumbnail = thumbnailMedia;
            } else if (type === CV2.MediaGallery) {
                const items = prop(component, "items");
                if (Array.isArray(items)) {
                    for (const item of items) {
                        const itemMedia = cv2Media(prop(item, "media"));
                        if (itemMedia) media.push(itemMedia);
                    }
                }
            } else if (type === CV2.Container || type === CV2.ActionRow) {
                walk(component.components ?? []);
            }
        }
    };
    walk(components);

    let rawTitle = "";
    let rawDescription = textParts.join("\n\n");
    const heading = rawDescription.match(/^#{1,3}\s+(.+)\n?/);
    if (heading) {
        rawTitle = heading[1].trim();
        rawDescription = rawDescription.slice(heading[0].length).trimStart();
    }

    const [image, ...extraImages] = media;

    return {
        id,
        type: "rich",
        url: "",
        rawTitle,
        rawDescription,
        referenceId: undefined,
        flags: 0,
        contentScanVersion: 0,
        color: accentColor !== undefined ? intToHex(accentColor) : "",
        fields: [],
        image,
        images: extraImages.length ? extraImages : undefined,
        thumbnail
    };
}

export function getCv2Containers(components: MessageComponent[]): { components: MessageComponent[]; accentColor: number | undefined; raw: MessageComponent | MessageComponent[]; }[] {
    const looseTypes: number[] = [CV2.Section, CV2.TextDisplay, CV2.Thumbnail, CV2.MediaGallery];
    const containers = components.filter(c => (c.type as number) === CV2.Container);
    const loose = components.filter(c => looseTypes.includes(c.type as number));

    const sources = containers.map(container => ({
        components: container.components ?? [],
        accentColor: parseDiscordColor(prop(container, "accentColor", "accent_color")),
        raw: container as MessageComponent | MessageComponent[]
    }));
    if (loose.length) sources.push({ components: loose, accentColor: undefined, raw: loose });

    return sources;
}
