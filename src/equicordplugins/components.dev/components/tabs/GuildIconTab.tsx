/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildIcon, GuildIconSizes, GuildStore, ManaButton, Paragraph, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const GUILDICON_PROPS: PropDef[] = [
    { name: "guildId", type: "string", required: true, description: "The guild's snowflake ID." },
    { name: "guildName", type: "string", required: true, description: "Guild name, used for the acronym fallback when no icon is available." },
    { name: "guildIcon", type: "string | null", required: true, description: "Icon hash from the guild object, or null for acronym fallback." },
    { name: "iconSize", type: "number", required: true, description: "Size in pixels. Common values: 16, 20, 24, 32, 40, 48, 56, 80, 96." },
    { name: "animate", type: "boolean", description: "Enable animated icons (animated GIF guild icons)." },
    { name: "className", type: "string", description: "CSS class for the icon container." },
    { name: "acronymClassName", type: "string", description: "CSS class for the acronym text fallback." },
];

function SizesDemo() {
    const [animate, setAnimate] = useState(true);
    const guilds = Object.values(GuildStore.getGuilds()).slice(0, 6);
    const guildWithIcon = guilds.find(g => g.icon);

    if (!guildWithIcon) {
        return <Paragraph color="text-muted">No guilds with icons found.</Paragraph>;
    }

    return (
        <div>
            <ManaButton
                variant="secondary"
                text={`Animate: ${animate}`}
                onClick={() => setAnimate(a => !a)}
                style={{ marginBottom: 12 }}
            />
            <div className="vc-compfinder-grid" style={{ alignItems: "flex-end" }}>
                {GuildIconSizes.map(size => (
                    <div key={size} style={{ textAlign: "center" }}>
                        <GuildIcon
                            guildId={guildWithIcon.id}
                            guildName={guildWithIcon.name}
                            guildIcon={guildWithIcon.icon ?? null}
                            iconSize={size}
                            animate={animate}
                        />
                        <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                            {size}px
                        </Paragraph>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AcronymDemo() {
    const guilds = Object.values(GuildStore.getGuilds()).slice(0, 6);
    const guildWithoutIcon = guilds.find(g => !g.icon);

    return (
        <div className="vc-compfinder-grid" style={{ alignItems: "flex-end" }}>
            {[32, 48, 80].map(size => (
                <div key={size} style={{ textAlign: "center" }}>
                    <GuildIcon
                        guildId={guildWithoutIcon?.id ?? "0"}
                        guildName={guildWithoutIcon?.name ?? "Test Guild"}
                        guildIcon={null}
                        iconSize={size}
                    />
                    <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                        {size}px (no icon)
                    </Paragraph>
                </div>
            ))}
        </div>
    );
}

function YourGuildsDemo() {
    const [animate, setAnimate] = useState(true);
    const guilds = Object.values(GuildStore.getGuilds()).slice(0, 8);

    return (
        <div>
            <ManaButton
                variant="secondary"
                text={`Animate: ${animate}`}
                onClick={() => setAnimate(a => !a)}
                style={{ marginBottom: 12 }}
            />
            <div className="vc-compfinder-grid">
                {guilds.map(guild => (
                    <div key={guild.id} style={{ textAlign: "center", maxWidth: 80 }}>
                        <GuildIcon
                            guildId={guild.id}
                            guildName={guild.name}
                            guildIcon={guild.icon ?? null}
                            iconSize={48}
                            animate={animate}
                        />
                        <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {guild.name.slice(0, 12)}
                        </Paragraph>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function GuildIconTab() {
    return (
        <DocPage
            componentName="GuildIcon"
            overview="GuildIcon renders a server icon from its hash, or falls back to an acronym derived from the guild name. Supports all standard Discord icon sizes and animated GIF icons."
            importPath={'import { GuildIcon, GuildIconSizes } from "../components";'}
            sections={[
                {
                    title: "Icon Sizes",
                    description: "All available GuildIconSizes from 16px to 96px.",
                    children: <SizesDemo />,
                    code: `<GuildIcon
  guildId={guild.id}
  guildName={guild.name}
  guildIcon={guild.icon}
  iconSize={48}
  animate={true}
/>`,
                    relevantProps: ["iconSize", "animate"],
                },
                {
                    title: "Acronym Fallback",
                    description: "When guildIcon is null, the component renders an acronym based on the guild name.",
                    children: <AcronymDemo />,
                    relevantProps: ["guildName", "guildIcon"],
                },
                {
                    title: "Your Guilds",
                    description: "Live preview using guilds you're currently in.",
                    children: <YourGuildsDemo />,
                },
            ]}
            props={GUILDICON_PROPS}
        />
    );
}
