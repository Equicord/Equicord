/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { PencilIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Embed, Message } from "@vencord/discord-types";
import { Menu, openModal } from "@webpack/common";

import { EmbedStudioModal } from "./EmbedStudioModal";
import { settings } from "./settings";
import { cv2ToEmbed, getCv2Containers } from "./utils";

interface StudioSource {
    label: string;
    embed: Embed;
    raw: unknown;
}

function truncate(text: string, max = 30) {
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function sourceLabel(embed: Embed, prefix: string) {
    const title = embed.rawTitle || embed.author?.name || embed.provider?.name || embed.rawDescription?.split("\n")[0] || "";
    return title ? `${prefix}: ${truncate(title)}` : prefix;
}

function getSources(message: Message): StudioSource[] {
    const sources: StudioSource[] = (message.embeds ?? []).map((embed, i) => ({
        label: sourceLabel(embed, `Embed ${i + 1}`),
        embed,
        raw: embed
    }));

    getCv2Containers(message.components ?? []).forEach((container, i) => {
        const embed = cv2ToEmbed(container.components, container.accentColor, `${message.id}-cv2-${i}`);
        if (!embed.rawTitle && !embed.rawDescription && !embed.image && !embed.thumbnail) return;
        sources.push({
            label: sourceLabel(embed, `Container ${i + 1}`),
            embed,
            raw: container.raw
        });
    });

    return sources;
}

function openEmbedStudio(source: StudioSource) {
    openModal(props => <EmbedStudioModal {...props} embed={source.embed} raw={source.raw} />);
}

export default definePlugin({
    name: "EmbedStudio",
    description: "Inspect, edit, clone and export any embed from the message context menu.",
    authors: [EquicordDevs.Drxzzle],
    tags: ["Chat"],
    settings,

    contextMenus: {
        "message": (children, { message }: { message: Message; }) => {
            if (!message) return;

            const sources = getSources(message);
            if (!sources.length) return;

            if (sources.length === 1) {
                children.push(
                    <Menu.MenuItem
                        id="vc-embed-studio"
                        label="Embed Studio"
                        icon={PencilIcon}
                        action={() => openEmbedStudio(sources[0])}
                    />
                );
                return;
            }

            children.push(
                <Menu.MenuItem id="vc-embed-studio" label="Embed Studio" icon={PencilIcon}>
                    {sources.map((source, i) => (
                        <Menu.MenuItem
                            id={`vc-embed-studio-${i}`}
                            key={`${message.id}-${i}`}
                            label={source.label}
                            action={() => openEmbedStudio(source)}
                        />
                    ))}
                </Menu.MenuItem>
            );
        }
    }
});
