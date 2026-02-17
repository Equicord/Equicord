/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph, Timestamp, TimestampDisplayFormats, TooltipPositions } from "..";
import { DocPage, type PropDef } from "../DocPage";

const TIMESTAMP_PROPS: PropDef[] = [
    { name: "timestamp", type: "Date | Moment", required: true, description: "The date or moment object to display." },
    { name: "timestampFormat", type: "TimestampDisplayFormat", description: 'Moment.js format string. One of: "LT", "LTS", "L", "LL", "LLL", "LLLL", "l", "ll", "lll", "llll".' },
    { name: "compact", type: "boolean", default: "false", description: "Use a shorter display style." },
    { name: "cozyAlt", type: "boolean", default: "false", description: "Use the cozy alternative layout." },
    { name: "isInline", type: "boolean", default: "false", description: "Render the timestamp inline." },
    { name: "isVisibleOnlyOnHover", type: "boolean", default: "false", description: "Hide the timestamp until the parent is hovered." },
    { name: "isEdited", type: "boolean", default: "false", description: 'Show an "(edited)" indicator after the timestamp.' },
    { name: "tooltipPosition", type: '"top" | "bottom" | "left" | "right"', description: "Position of the full-date tooltip." },
    { name: "id", type: "string", description: "HTML id attribute." },
    { name: "className", type: "string", description: "Additional CSS class." },
    { name: "children", type: "ReactNode", description: "Custom content to render instead of the formatted timestamp." },
];

export default function TimestampTab() {
    const now = new Date();

    return (
        <DocPage
            componentName="Timestamp"
            overview="Timestamp renders a formatted date with a tooltip showing the full date. Supports moment.js format strings, compact mode, inline rendering, edited indicators, and hover-only visibility."
            importPath={'import { Timestamp, TimestampDisplayFormats } from "../components";'}
            sections={[
                {
                    title: "Formats",
                    description: "All available timestamp display formats using moment.js format strings.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {TimestampDisplayFormats.map(({ format, description }) => (
                                <div key={format} style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                                    <Timestamp timestamp={now} timestampFormat={format} />
                                    <Paragraph color="text-muted" style={{ fontSize: 10 }}>
                                        {format}: {description}
                                    </Paragraph>
                                </div>
                            ))}
                        </div>
                    ),
                    code: '<Timestamp timestamp={new Date()} timestampFormat="LLL" />',
                    relevantProps: ["timestamp", "timestampFormat"],
                },
                {
                    title: "Compact Mode",
                    description: "Compact mode shows a shorter version of the timestamp.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <div style={{ padding: 12 }}>
                                <Timestamp timestamp={now} compact={false} />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    compact=false (default)
                                </Paragraph>
                            </div>
                            <div style={{ padding: 12 }}>
                                <Timestamp timestamp={now} compact={true} />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    compact=true
                                </Paragraph>
                            </div>
                        </div>
                    ),
                    relevantProps: ["compact"],
                },
                {
                    title: "Display Variants",
                    description: "Inline and cozy alternative display modes.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <div style={{ padding: 12 }}>
                                <Timestamp timestamp={now} isInline={false} />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    isInline=false (default)
                                </Paragraph>
                            </div>
                            <div style={{ padding: 12 }}>
                                <Timestamp timestamp={now} isInline={true} />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    isInline=true
                                </Paragraph>
                            </div>
                            <div style={{ padding: 12 }}>
                                <Timestamp timestamp={now} cozyAlt={true} />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    cozyAlt=true
                                </Paragraph>
                            </div>
                        </div>
                    ),
                    relevantProps: ["isInline", "cozyAlt"],
                },
                {
                    title: "Edited Indicator",
                    description: 'Shows an "(edited)" indicator after the timestamp.',
                    children: (
                        <div className="vc-compfinder-grid">
                            <div style={{ padding: 12 }}>
                                <Timestamp timestamp={now} isEdited={false} />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    isEdited=false (default)
                                </Paragraph>
                            </div>
                            <div style={{ padding: 12 }}>
                                <Timestamp timestamp={now} isEdited={true} />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    isEdited=true
                                </Paragraph>
                            </div>
                        </div>
                    ),
                    relevantProps: ["isEdited"],
                },
                {
                    title: "Visibility on Hover",
                    description: "Timestamp can be hidden until the parent element is hovered.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <div style={{ padding: 12 }}>
                                <span style={{ padding: 8, background: "var(--background-secondary)", borderRadius: 4 }}>
                                    Hover me: <Timestamp timestamp={now} isVisibleOnlyOnHover={true} />
                                </span>
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                    isVisibleOnlyOnHover=true
                                </Paragraph>
                            </div>
                        </div>
                    ),
                    relevantProps: ["isVisibleOnlyOnHover"],
                },
                {
                    title: "Tooltip Positions",
                    description: "The tooltip showing the full date can be positioned on any side.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {TooltipPositions.map(position => (
                                <div key={position} style={{ padding: 12 }}>
                                    <Timestamp timestamp={now} tooltipPosition={position} />
                                    <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                        tooltipPosition="{position}"
                                    </Paragraph>
                                </div>
                            ))}
                        </div>
                    ),
                    relevantProps: ["tooltipPosition"],
                },
            ]}
            props={TIMESTAMP_PROPS}
        />
    );
}
