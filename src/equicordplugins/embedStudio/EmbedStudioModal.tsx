/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { CodeBlock } from "@components/CodeBlock";
import ErrorBoundary from "@components/ErrorBoundary";
import { CloudDownloadIcon, CopyIcon, OpenExternalIcon, WarningIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { copyWithToast } from "@utils/discord";
import { Embed, EmbedMedia, RenderModalProps } from "@vencord/discord-types";
import { findComponentLazy } from "@webpack";
import { MaskedLink, Modal, Parser, TabBar, useEffect, useState } from "@webpack/common";
import type { ReactNode } from "react";

import { IconButton, InfoRow, Section } from "./components";
import { EmbedEditor } from "./EmbedEditor";
import { EmbedJsonTab } from "./EmbedJSON";
import { settings } from "./settings";
import { PreviewEmbed, PreviewMedia, WebhookEmbed } from "./types";
import { cl, cleanForWebhook, downloadAllAssets, downloadAsset, getAssets, toPreviewEmbed, toWebhookEmbed } from "./utils";

interface EmbedLinkProps {
    href: string;
    className?: string;
    tabIndex?: number;
    children?: ReactNode;
    target?: string;
    rel?: string;
    messageId?: string;
    channelId?: string;
}

interface EmbedImageProps {
    containerClassName?: string;
    src?: string;
    original?: string;
    width?: number;
    height?: number;
    maxWidth?: number;
    maxHeight?: number;
    alt?: string;
}

interface DiscordEmbedProps {
    embed: PreviewEmbed;
    renderTitle: (embed: PreviewEmbed, title: string) => ReactNode;
    renderDescription: (embed: PreviewEmbed, description: string, fromField: boolean) => ReactNode;
    renderLinkComponent: (props: EmbedLinkProps) => ReactNode;
    renderImageComponent: (props: EmbedImageProps) => ReactNode;
}

const DiscordEmbed = findComponentLazy<DiscordEmbedProps>(m => m.prototype?.renderSuppressButton);

function PreviewImage({ containerClassName, src, original, width, height, maxWidth, maxHeight, alt }: EmbedImageProps) {
    const hasDims = !!width && !!height;
    const scale = hasDims ? Math.min((maxWidth ?? Infinity) / width || 1, (maxHeight ?? Infinity) / height || 1, 1) : 1;
    const url = src || original;

    if (!url) return null;

    return (
        <div className={containerClassName}>
            <img
                className={cl("preview-image")}
                src={url}
                alt={alt || ""}
                style={hasDims
                    ? { width: Math.round(width * scale), height: Math.round(height * scale) }
                    : { maxWidth: "100%" }
                }
            />
        </div>
    );
}

const embedRenderProps: Omit<DiscordEmbedProps, "embed"> = {
    renderTitle: (_embed, title) => <>{Parser.parseEmbedTitle(title)}</>,
    renderDescription: (_embed, description) => <>{Parser.parse(description)}</>,
    renderLinkComponent: linkProps => <MaskedLink {...linkProps} />,
    renderImageComponent: imageProps => <PreviewImage {...imageProps} />
};

const TAB_IDS = ["preview", "editor", "json", "assets", "advanced"] as const;
type TabId = typeof TAB_IDS[number];

function isTabId(value: string): value is TabId {
    return (TAB_IDS as readonly string[]).includes(value);
}

const TAB_LABELS: Record<TabId, string> = {
    preview: "Preview",
    editor: "Editor",
    json: "JSON",
    assets: "Assets",
    advanced: "Advanced"
};

const SETTINGS_KEYS: "showAdvancedTab"[] = ["showAdvancedTab"];

function getInitialTab(): TabId {
    const { lastTab, rememberLastTab, showAdvancedTab } = settings.store;
    if (!rememberLastTab || !lastTab || !isTabId(lastTab)) return "preview";
    if (lastTab === "advanced" && !showAdvancedTab) return "preview";
    return lastTab;
}

export function EmbedStudioModal({ embed: original, raw = original, ...props }: RenderModalProps & { embed: Embed; raw?: unknown; }) {
    const [embed, setEmbed] = useState(() => toWebhookEmbed(original));
    const [tab, setTab] = useState<TabId>(getInitialTab);
    const { showAdvancedTab } = settings.use(SETTINGS_KEYS);

    const tabs: TabId[] = showAdvancedTab ? [...TAB_IDS] : TAB_IDS.filter(t => t !== "advanced");
    const activeTab = tabs.includes(tab) ? tab : "preview";

    return (
        <Modal {...props} size="lg" title="Embed Studio" subtitle={original.rawTitle || undefined}>
            <TabBar
                type="top"
                look="brand"
                className={cl("tab-bar")}
                selectedItem={activeTab}
                onItemSelect={(id: string) => {
                    if (!isTabId(id)) return;
                    setTab(id);
                    settings.store.lastTab = id;
                }}
            >
                {tabs.map(id => (
                    <TabBar.Item className={cl("tab")} id={id} key={id}>
                        {TAB_LABELS[id]}
                    </TabBar.Item>
                ))}
            </TabBar>

            <div className={cl("content")}>
                {activeTab === "preview" && <PreviewTab embed={embed} original={original} converted={raw !== original} />}
                {activeTab === "editor" && <EmbedEditor embed={embed} onChange={setEmbed} />}
                {activeTab === "json" && <EmbedJsonTab embed={embed} raw={raw} onChange={setEmbed} />}
                {activeTab === "assets" && <AssetsTab original={original} />}
                {activeTab === "advanced" && <AdvancedTab original={original} raw={raw} />}
            </div>
        </Modal>
    );
}

function PreviewTab({ embed, original, converted }: { embed: WebhookEmbed; original: Embed; converted: boolean; }) {
    const [media, setMedia] = useState<Record<string, PreviewMedia | null>>({});

    const imageUrl = embed.image?.url;
    const thumbnailUrl = embed.thumbnail?.url;

    const resolveMedia = (url: string | undefined, originalMedia: EmbedMedia | undefined): PreviewMedia | null => {
        if (!url) return null;
        if (originalMedia && (originalMedia.url === url || originalMedia.proxyURL === url)) {
            return {
                url,
                proxyURL: originalMedia.proxyURL ?? url,
                width: originalMedia.width,
                height: originalMedia.height
            };
        }
        return media[url] ?? null;
    };

    const originalImage = original.image ?? original.images?.[0];
    const resolvedImage = resolveMedia(imageUrl, originalImage);
    const resolvedThumbnail = resolveMedia(thumbnailUrl, original.thumbnail);

    useEffect(() => {
        for (const [url, resolved] of [[imageUrl, resolvedImage], [thumbnailUrl, resolvedThumbnail]] as const) {
            if (!url || resolved || url in media) continue;
            const img = new Image();
            img.onload = () => setMedia(m => ({
                ...m,
                [url]: { url, proxyURL: url, width: img.naturalWidth, height: img.naturalHeight }
            }));
            img.onerror = () => setMedia(m => ({ ...m, [url]: null }));
            img.src = url;
        }
    }, [imageUrl, thumbnailUrl, media]);

    const failedUrls = [imageUrl, thumbnailUrl].filter((url): url is string => typeof url === "string" && media[url] === null);
    const preview = toPreviewEmbed(embed, { image: resolvedImage, thumbnail: resolvedThumbnail });
    const isEmpty = !Object.keys(cleanForWebhook(embed)).length;

    return (
        <div className={cl("preview")}>
            {converted && (
                <div className={cl("notice")}>
                    <WarningIcon width={16} height={16} />
                    Converted from a Components V2 message. Buttons, selects and other layout components are not part of webhook embeds, so only the text and media were carried over.
                </div>
            )}
            {!converted && original.type !== "rich" && (
                <div className={cl("notice")}>
                    <WarningIcon width={16} height={16} />
                    This is a "{original.type}" embed generated by Discord. A webhook cannot fully recreate it, so the preview only shows webhook supported fields. See the Advanced tab for the rest.
                </div>
            )}
            {isEmpty
                ? <Paragraph className={cl("empty")}>This embed has no webhook supported content.</Paragraph>
                : (
                    <ErrorBoundary message="Failed to render the embed preview.">
                        <DiscordEmbed embed={preview} {...embedRenderProps} />
                    </ErrorBoundary>
                )
            }
            {failedUrls.map(url => (
                <div className={cl("warning")} key={url}>
                    <WarningIcon width={16} height={16} />
                    Failed to load image: {url}
                </div>
            ))}
        </div>
    );
}

function AssetsTab({ original }: { original: Embed; }) {
    const assets = getAssets(original);

    if (!assets.length) return <Paragraph className={cl("empty")}>This embed has no assets.</Paragraph>;

    return (
        <div>
            <div className={cl("row")}>
                <Button size="small" onClick={() => downloadAllAssets(assets)}>Download All</Button>
            </div>
            {assets.map(asset => (
                <div className={cl("asset")} key={`${asset.label}-${asset.url}`}>
                    <img className={cl("asset-thumb")} src={asset.proxyURL || asset.url} alt="" />
                    <div className={cl("asset-info")}>
                        <BaseText size="md" weight="medium">{asset.label}</BaseText>
                        <div className={cl("asset-url")}>{asset.url}</div>
                    </div>
                    <div className={cl("row")}>
                        <IconButton tooltip="Open in browser" icon={OpenExternalIcon} onClick={() => VencordNative.native.openExternal(asset.url)} />
                        <IconButton tooltip="Copy URL" icon={CopyIcon} onClick={() => copyWithToast(asset.url, "Asset URL copied to clipboard")} />
                        <IconButton tooltip="Download" icon={CloudDownloadIcon} onClick={() => downloadAsset(asset)} />
                    </div>
                </div>
            ))}
        </div>
    );
}

const KNOWN_EMBED_KEYS = [
    "id", "url", "type", "rawTitle", "rawDescription", "referenceId", "flags", "contentScanVersion",
    "author", "footer", "provider", "timestamp", "color", "thumbnail", "image", "images", "video", "fields"
];

function AdvancedTab({ original, raw }: { original: Embed; raw: unknown; }) {
    const converted = raw !== original;
    const unknownKeys = converted ? [] : Object.keys(original).filter(key => !KNOWN_EMBED_KEYS.includes(key));

    const mediaEntries: [string, EmbedMedia][] = [];
    if (original.image) mediaEntries.push(["Main image", original.image]);
    original.images?.forEach((image, i) => mediaEntries.push([`Image ${i + 1}`, image]));
    if (original.thumbnail) mediaEntries.push(["Thumbnail", original.thumbnail]);
    if (original.video) mediaEntries.push(["Video", original.video]);

    return (
        <div>
            <Section title="Discord Only Data">
                <InfoRow label="Source" value={converted ? "Components V2 message" : undefined} />
                <InfoRow label="Type" value={converted ? undefined : original.type} />
                <InfoRow label="Provider" value={original.provider && `${original.provider.name}${original.provider.url ? ` (${original.provider.url})` : ""}`} />
                <InfoRow label="Reference ID" value={original.referenceId} />
                <InfoRow label="Flags" value={original.flags} />
                <InfoRow label="Content scan version" value={original.contentScanVersion} />
                <InfoRow label="Unknown properties" value={unknownKeys.length ? unknownKeys.join(", ") : undefined} />
            </Section>

            {mediaEntries.length > 0 && (
                <Section title="Media">
                    {mediaEntries.map(([label, embedMedia]) => (
                        <div className={cl("media-info")} key={`${label}-${embedMedia.url}`}>
                            <BaseText size="sm" weight="medium">{label}</BaseText>
                            <InfoRow label="Dimensions" value={embedMedia.width && embedMedia.height ? `${embedMedia.width} × ${embedMedia.height}` : undefined} />
                            <InfoRow label="URL" value={embedMedia.url} />
                            <InfoRow label="Proxy URL" value={embedMedia.proxyURL} />
                            <InfoRow label="Content type" value={embedMedia.contentType} />
                            <InfoRow label="Flags" value={embedMedia.flags} />
                        </div>
                    ))}
                </Section>
            )}

            <Section title={converted ? "Raw Components" : "Raw Embed"}>
                <CodeBlock lang="json" content={JSON.stringify(raw, null, 2)} />
            </Section>
        </div>
    );
}
