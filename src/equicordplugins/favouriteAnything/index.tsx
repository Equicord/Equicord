/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Embed } from "@vencord/discord-types";
import { findComponentByCodeLazy, findCssClassesLazy, proxyLazyWebpack } from "@webpack";
import { React } from "@webpack/common";
import { Component, ReactNode } from "react";

enum Format {
    NONE = 0,
    IMAGE = 1,
    VIDEO = 2
}

interface FavoriteButtonProps {
    width: number;
    height: number;
    // Media URL
    src: string;
    // Provider source URL
    url: string;
    format: Format;
    className?: string;
}

interface AccessoryProps
    extends Pick<FavoriteButtonProps, "width" | "height" | "url"> {
    proxyUrl?: string;
    video?: boolean;
}

interface EmbedComponent extends Component<{ embed: Embed; }> {
    __render: () => ReactNode;
}

const FavoriteButton = findComponentByCodeLazy<FavoriteButtonProps>("#{intl::GIF_TOOLTIP_ADD_TO_FAVORITES}");
const Classes = findCssClassesLazy("gifFavoriteButton", "ctaButtonContainer");
const EmbedContext = proxyLazyWebpack(() => React.createContext<null | Embed>(null));

export default definePlugin({
    name: "FavouriteAnything",
    description: "Favourite any image",
    authors: [Devs.nin0dev, EquicordDevs.davri],
    patches: [
        {
            find: "static isAnimated",
            replacement: [
                // .isAnimated is checked in almost every media overlay event listener, so it's easier to patch the source.
                {
                    match: /static isAnimated\((\i)\)\{/,
                    replace:
                        "static isAnimated($1,override){if(!override)return true;"
                },
                // Always render the custom accessory if the prop wasn't provided. This mostly affects video attachments.
                // Url and proxyUrl are additionally set to the same value, since the original url property only stores the thumbnail.
                {
                    match: /(?<=this\.props\.renderAccessory\(\):)null/,
                    replace:
                        "$self.Accessory({...this.props,url:this.props.proxyUrl,video:true})"
                },
                // Always return static thumbnails for non gif media to prevent graphical glitches (side effect of the first patch).
                {
                    match: /getSrc\(\i\)\{.*?let \i=/,
                    replace: "$&!this.constructor.isAnimated(this.props,true)||"
                },
                // Hide the default "GIF" tag accessory that is visible when discord is unfocused.
                {
                    match: "return this.props.shouldRenderAccessory?",
                    replace: "$&!this.constructor.isAnimated(this.props,true)||"
                }
            ]
        },
        // Wrap the embed component with a custom context provider to avoid having to drill props.
        {
            find: "#{intl::SUPPRESS_ALL_EMBEDS}",
            replacement: {
                match: "render()",
                replace: "$&{return $self.renderEmbed.call(this)}__render()"
            }
        },
        // Replace the default gif accessory with a custom one that skips fileType checks. Mostly affects image attachments.
        {
            find: "renderComponentAccessories",
            replacement: {
                match: /\i=>\(\)=>\{.{200,300}?null\}/,
                replace: "props=>()=>$self.Accessory({...props,video:false})"
            }
        },
        // Add a proxyUrl prop alongside the src prop, which is used for video thumbnails.
        {
            find: /disableArrowKeySeek:\i\}\)\}/,
            replacement: {
                match: /src:\i(?=,\.\.\.\i)/,
                replace: "$&,proxyUrl:this.props.src"
            }
        }
    ],
    renderEmbed(this: EmbedComponent) {
        return (
            <EmbedContext.Provider value={this.props.embed}>
                {this.__render()}
            </EmbedContext.Provider>
        );
    },
    Accessory(props: AccessoryProps) {
        const embed = React.useContext(EmbedContext);
        const content = embed?.image ?? embed?.video;

        const { url, proxyUrl, width, height, video } =
            embed && content
                ? {
                    ...content,
                    url: (embed.type === "gifv" && embed.url) || content.url,
                    proxyUrl: content.proxyURL,
                    video: !!embed.video
                }
                : props;

        if (!width || !height || !url) return null;

        return (
            <FavoriteButton
                format={video ? Format.VIDEO : Format.IMAGE}
                className={Classes?.gifFavoriteButton}
                src={proxyUrl ?? url}
                url={url}
                width={width}
                height={height}
            />
        );
    }
});
