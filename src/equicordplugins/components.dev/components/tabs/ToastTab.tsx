/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaButton, Paragraph, showToast, Toasts, ToastType, type ToastTypeValue } from "..";
import { DocPage, type PropGroup } from "../DocPage";

const TOAST_TYPES: { type: ToastTypeValue; label: string; description: string; }[] = [
    { type: ToastType.MESSAGE, label: "MESSAGE", description: "Default message toast." },
    { type: ToastType.SUCCESS, label: "SUCCESS", description: "Green success toast." },
    { type: ToastType.FAILURE, label: "FAILURE", description: "Red failure/error toast." },
    { type: ToastType.CLIP, label: "CLIP", description: "Clip/copy toast." },
    { type: ToastType.LINK, label: "LINK", description: "Link copied toast." },
    { type: ToastType.FORWARD, label: "FORWARD", description: "Forward action toast." },
    { type: ToastType.BOOKMARK, label: "BOOKMARK", description: "Bookmark action toast." },
    { type: ToastType.CLOCK, label: "CLOCK", description: "Clock/timer toast." },
];

const PROP_GROUPS: PropGroup[] = [
    {
        title: "showToast(message, type)",
        props: [
            { name: "message", type: "string", required: true, description: "Toast message text." },
            { name: "type", type: "ToastTypeValue", default: '"message"', description: "Toast type from ToastType." },
        ],
    },
    {
        title: "Toasts.create(message, type, options)",
        props: [
            { name: "message", type: "string", required: true, description: "Toast message text." },
            { name: "type", type: "ToastTypeValue", required: true, description: "Toast type from ToastType." },
            { name: "options.duration", type: "number", description: "Display time in milliseconds." },
            { name: "options.position", type: "0 | 1", description: "Toast position. 0 = TOP, 1 = BOTTOM." },
            { name: "options.component", type: "ReactNode", description: "Custom React content for CUSTOM type toasts." },
        ],
    },
    {
        title: "ToastType",
        props: [
            { name: "MESSAGE", type: '"message"', description: "Default message style." },
            { name: "SUCCESS", type: '"success"', description: "Green checkmark icon." },
            { name: "FAILURE", type: '"failure"', description: "Red X icon." },
            { name: "CUSTOM", type: '"custom"', description: "Custom component content." },
            { name: "CLIP", type: '"clip"', description: "Clip/scissors icon." },
            { name: "LINK", type: '"link"', description: "Link icon." },
            { name: "FORWARD", type: '"forward"', description: "Forward arrow icon." },
            { name: "BOOKMARK", type: '"bookmark"', description: "Bookmark icon." },
            { name: "CLOCK", type: '"clock"', description: "Clock icon." },
        ],
    },
];

export default function ToastTab() {
    return (
        <DocPage
            componentName="Toasts"
            overview="Toasts are brief notification messages that appear at screen edges. Use showToast for quick one-liners, or Toasts.create + Toasts.show for full control over duration, position, and custom content. Toasts.pop removes the most recent toast."
            notices={[
                { type: "info", children: "Use showToast() for quick one-liners. Use Toasts.create() + Toasts.show() when you need custom duration, position, or component content." },
            ]}
            importPath={'import { showToast, Toasts, ToastType } from "../components";'}
            sections={[
                {
                    title: "All Types",
                    description: "Click any button to show that toast type.",
                    children: (
                        <div className="vc-compfinder-grid" style={{ gap: 8 }}>
                            {TOAST_TYPES.map(({ type, label, description }) => (
                                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <ManaButton
                                        variant="secondary"
                                        text={label}
                                        onClick={() => showToast(`This is a ${label} toast!`, type)}
                                    />
                                    <Paragraph color="text-muted" style={{ fontSize: 10 }}>
                                        {description}
                                    </Paragraph>
                                </div>
                            ))}
                        </div>
                    ),
                    code: 'showToast("Copied to clipboard!", ToastType.SUCCESS);',
                },
                {
                    title: "Simple Usage",
                    description: "showToast is the quickest way to show a toast. It creates and shows a toast in one call.",
                    children: (
                        <ManaButton
                            variant="primary"
                            text="Show Simple Toast"
                            onClick={() => showToast("Hello from showToast!", ToastType.SUCCESS)}
                        />
                    ),
                    code: 'showToast("Hello from showToast!", ToastType.SUCCESS);',
                },
                {
                    title: "Advanced Usage",
                    description: "Use Toasts.create to build a toast with custom duration, position, or component content, then Toasts.show to display it.",
                    children: (
                        <div className="vc-compfinder-grid" style={{ gap: 8 }}>
                            <ManaButton
                                variant="secondary"
                                text="5s Duration Toast"
                                onClick={() => {
                                    const toast = Toasts.create("This lasts 5 seconds", ToastType.SUCCESS, { duration: 5000 });
                                    Toasts.show(toast);
                                }}
                            />
                            <ManaButton
                                variant="secondary"
                                text="Bottom Position Toast"
                                onClick={() => {
                                    const toast = Toasts.create("Bottom toast", ToastType.MESSAGE, { position: Toasts.Position.BOTTOM });
                                    Toasts.show(toast);
                                }}
                            />
                            <ManaButton
                                variant="secondary"
                                text="Custom Component Toast"
                                onClick={() => {
                                    const toast = Toasts.create("Custom", ToastType.CUSTOM, {
                                        component: <span style={{ color: "var(--text-brand)" }}>Custom JSX content!</span>,
                                    });
                                    Toasts.show(toast);
                                }}
                            />
                        </div>
                    ),
                    code: `const toast = Toasts.create("Done!", ToastType.SUCCESS, {
    duration: 5000,
    position: Toasts.Position.BOTTOM,
});
Toasts.show(toast);`,
                },
                {
                    title: "Pop Toast",
                    description: "Toasts.pop removes the most recent toast from the stack.",
                    children: (
                        <ManaButton
                            variant="critical-secondary"
                            text="Pop Last Toast"
                            onClick={() => Toasts.pop()}
                        />
                    ),
                    code: "Toasts.pop();",
                },
            ]}
            props={PROP_GROUPS}
        />
    );
}
