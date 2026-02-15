/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph, ProgressBar, useEffect, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const PROGRESSBAR_PROPS: PropDef[] = [
    { name: "progress", type: "number", required: true, description: "Current progress value." },
    { name: "minimum", type: "number", default: "0", description: "Minimum range value." },
    { name: "maximum", type: "number", default: "100", description: "Maximum range value." },
    { name: "variant", type: '"blue" | "orange" | "unset"', default: '"blue"', description: 'Color variant. Use "unset" with override for custom colors.' },
    { name: "override", type: "{ default?: { background, gradientStart, gradientEnd } }", description: 'Custom colors when variant is "unset".' },
    { name: "weight", type: '"light" | "medium"', default: '"light"', description: "Visual weight of the progress bar." },
    { name: "glowing", type: "boolean", default: "true", description: "Whether the progress bar has a glow effect." },
    { name: "labelledBy", type: "string", internal: true, description: "ID of the labelling element for accessibility." },
];

function AnimatedDemo() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => (prev >= 100 ? 0 : prev + 5));
        }, 200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Progress: {progress}%</Paragraph>
            <ProgressBar progress={progress} variant="blue" />
        </div>
    );
}

export default function ProgressBarTab() {
    return (
        <DocPage
            overview="ProgressBar displays a horizontal progress indicator with support for blue and orange color variants, light and medium weights, a glow effect, custom color overrides via gradients, and configurable min/max ranges."
            importPath={'import { ProgressBar } from "../components";'}
            sections={[
                {
                    title: "Variants",
                    description: "Blue (default) and orange color variants.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Blue:</Paragraph>
                                <ProgressBar progress={60} variant="blue" />
                            </div>
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Orange:</Paragraph>
                                <ProgressBar progress={60} variant="orange" />
                            </div>
                        </div>
                    ),
                    code: '<ProgressBar progress={60} variant="blue" />',
                    relevantProps: ["variant"],
                },
                {
                    title: "Progress Values",
                    description: "Various progress levels from 0% to 100%.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            {[0, 25, 50, 75, 100].map(v => (
                                <div key={v}>
                                    <Paragraph color="text-muted" style={{ marginBottom: 4 }}>{v}%:</Paragraph>
                                    <ProgressBar progress={v} variant="blue" />
                                </div>
                            ))}
                        </div>
                    ),
                    relevantProps: ["progress"],
                },
                {
                    title: "Animated",
                    description: "Progress bar that increments automatically.",
                    children: <AnimatedDemo />,
                },
                {
                    title: "Weight",
                    description: "Light (default) and medium weight variants.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Light (default):</Paragraph>
                                <ProgressBar progress={60} weight="light" />
                            </div>
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Medium:</Paragraph>
                                <ProgressBar progress={60} weight="medium" />
                            </div>
                        </div>
                    ),
                    code: '<ProgressBar progress={60} weight="medium" />',
                    relevantProps: ["weight"],
                },
                {
                    title: "Glowing",
                    description: "Glow effect is enabled by default. Set glowing={false} to disable.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Glowing (default):</Paragraph>
                                <ProgressBar progress={60} glowing={true} />
                            </div>
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>No glow:</Paragraph>
                                <ProgressBar progress={60} glowing={false} />
                            </div>
                        </div>
                    ),
                    code: "<ProgressBar progress={60} glowing={false} />",
                    relevantProps: ["glowing"],
                },
                {
                    title: "Custom Range",
                    description: "Using minimum=0 and maximum=200 with progress=150 (75% filled).",
                    children: <ProgressBar progress={150} minimum={0} maximum={200} variant="orange" />,
                    code: '<ProgressBar progress={150} minimum={0} maximum={200} variant="orange" />',
                    relevantProps: ["minimum", "maximum"],
                },
                {
                    title: "Custom Override",
                    description: 'Using variant="unset" with custom gradient colors.',
                    children: (
                        <ProgressBar
                            progress={70}
                            variant="unset"
                            override={{
                                default: {
                                    background: "rgba(88, 101, 242, 0.3)",
                                    gradientStart: "#5865F2",
                                    gradientEnd: "#EB459E",
                                },
                            }}
                        />
                    ),
                    code: `<ProgressBar
  progress={70}
  variant="unset"
  override={{
    default: {
      background: "rgba(88, 101, 242, 0.3)",
      gradientStart: "#5865F2",
      gradientEnd: "#EB459E",
    },
  }}
/>`,
                    relevantProps: ["override"],
                },
            ]}
            props={PROGRESSBAR_PROPS}
        />
    );
}
