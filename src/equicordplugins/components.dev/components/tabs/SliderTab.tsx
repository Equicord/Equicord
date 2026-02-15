/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph, Slider, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const SLIDER_PROPS: PropDef[] = [
    { name: "initialValue", type: "number", description: "Initial slider value (uncontrolled)." },
    { name: "value", type: "number", description: "Current slider value (controlled)." },
    { name: "minValue", type: "number", description: "Minimum range value." },
    { name: "maxValue", type: "number", description: "Maximum range value." },
    { name: "onValueChange", type: "(value: number) => void", description: "Called when the value changes (on release)." },
    { name: "asValueChanges", type: "(value: number) => void", description: "Called continuously as the value changes (while dragging)." },
    { name: "onValueRender", type: "(value: number) => string | null", description: "Custom tooltip label for the current value." },
    { name: "markers", type: "number[]", description: "Array of values to show as tick marks." },
    { name: "stickToMarkers", type: "boolean", description: "Snap the slider value to the nearest marker." },
    { name: "equidistant", type: "boolean", description: "Space markers equally regardless of value." },
    { name: "onMarkerRender", type: "(value: number) => string | ReactNode", description: "Custom label for each marker tick." },
    { name: "keyboardStep", type: "number", description: "Step size for keyboard arrow key increments." },
    { name: "disabled", type: "boolean", default: "false", description: "Disable interaction." },
    { name: "mini", type: "boolean", description: "Use compact visual style." },
    { name: "hideBubble", type: "boolean", description: "Hide the value tooltip bubble." },
    { name: "orientation", type: '"horizontal" | "vertical"', default: '"horizontal"', description: "Slider orientation." },
    { name: "className", type: "string", description: "Custom CSS class." },
];

function BasicDemo() {
    const [value, setValue] = useState(50);
    return (
        <div>
            <Paragraph color="text-muted" style={{ marginBottom: 8 }}>Value: {value}</Paragraph>
            <Slider initialValue={value} minValue={0} maxValue={100} onValueChange={setValue} />
        </div>
    );
}

function MarkersDemo() {
    const [value, setValue] = useState(50);
    return (
        <div>
            <Paragraph color="text-muted" style={{ marginBottom: 8 }}>Value: {value}</Paragraph>
            <Slider
                initialValue={value}
                minValue={0}
                maxValue={100}
                markers={[0, 25, 50, 75, 100]}
                onValueChange={setValue}
                onMarkerRender={(v: number) => `${v}%`}
            />
        </div>
    );
}

function MiniDemo() {
    const [value, setValue] = useState(30);
    return (
        <div>
            <Paragraph color="text-muted" style={{ marginBottom: 8 }}>Value: {value}</Paragraph>
            <div style={{ width: 200 }}>
                <Slider initialValue={value} minValue={0} maxValue={100} mini onValueChange={setValue} />
            </div>
        </div>
    );
}

export default function SliderTab() {
    return (
        <DocPage
            componentName="Slider"
            overview="Slider is Discord's range input component with support for markers, snap-to-marker behavior, mini mode, value tooltips, and custom rendering. Supports both controlled and uncontrolled usage."
            notices={[
                { type: "info", children: "Slider has two change callbacks: onValueChange fires on release (final value), while asValueChanges fires continuously during dragging. Use onValueChange for state updates to avoid excessive re-renders." },
            ]}
            importPath={'import { Slider } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Simple slider with min/max range.",
                    children: <BasicDemo />,
                    code: `<Slider
  initialValue={50}
  minValue={0}
  maxValue={100}
  onValueChange={setValue}
/>`,
                    relevantProps: ["initialValue", "minValue", "maxValue", "onValueChange"],
                },
                {
                    title: "With Markers",
                    description: "Tick marks at specified values with custom labels.",
                    children: <MarkersDemo />,
                    code: `<Slider
  initialValue={50}
  minValue={0}
  maxValue={100}
  markers={[0, 25, 50, 75, 100]}
  onMarkerRender={v => \`\${v}%\`}
/>`,
                    relevantProps: ["markers", "onMarkerRender"],
                },
                {
                    title: "Stick to Markers",
                    description: "Value snaps to the nearest marker position.",
                    children: (
                        <Slider
                            initialValue={50}
                            minValue={0}
                            maxValue={100}
                            markers={[0, 25, 50, 75, 100]}
                            stickToMarkers
                            onMarkerRender={(v: number) => `${v}%`}
                        />
                    ),
                    relevantProps: ["stickToMarkers"],
                },
                {
                    title: "Mini",
                    description: "Compact visual style for tight layouts.",
                    children: <MiniDemo />,
                    relevantProps: ["mini"],
                },
                {
                    title: "Disabled",
                    description: "Non-interactive disabled state.",
                    children: <Slider initialValue={60} minValue={0} maxValue={100} disabled />,
                    relevantProps: ["disabled"],
                },
                {
                    title: "Custom Range",
                    description: "Slider with negative to positive range.",
                    children: (
                        <Slider
                            initialValue={0}
                            minValue={-50}
                            maxValue={50}
                            markers={[-50, -25, 0, 25, 50]}
                            onMarkerRender={(v: number) => v.toString()}
                        />
                    ),
                },
            ]}
            props={SLIDER_PROPS}
        />
    );
}
