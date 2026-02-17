/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaTextButton, ManaTextButtonTextVariants, ManaTextButtonVariants } from "..";
import { DocPage, type PropDef } from "../DocPage";

const TEXTBUTTON_PROPS: PropDef[] = [
    { name: "text", type: "string", required: true, description: "Button label text." },
    { name: "variant", type: '"primary" | "secondary" | "always-white" | "critical"', description: "Color variant." },
    { name: "textVariant", type: "string", description: 'Typography variant, e.g. "text-sm/medium", "text-lg/medium".' },
    { name: "lineClamp", type: "number", description: "Max lines before truncation with ellipsis." },
    { name: "disabled", type: "boolean", default: "false", description: "Disable the button." },
    { name: "onClick", type: "(e: MouseEvent) => void", description: "Click handler." },
    { name: "role", type: "string", description: "ARIA role attribute." },
    { name: "type", type: '"button" | "submit" | "reset"', description: "HTML button type." },
    { name: "buttonRef", type: "Ref<HTMLButtonElement>", internal: true, description: "Ref to the underlying button element." },
    { name: "className", type: "string", description: "Custom CSS class." },
    { name: "style", type: "CSSProperties", description: "Inline styles." },
];

export default function TextButtonTab() {
    return (
        <DocPage
            overview="ManaTextButton is Discord's text-only button component (no background or border). Supports four color variants, typography sizing via textVariant, line clamping, and disabled state."
            importPath={'import { ManaTextButton, ManaTextButtonVariants, ManaTextButtonTextVariants } from "../components";'}
            sections={[
                {
                    title: "Variants",
                    description: "All four color variants.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {ManaTextButtonVariants.map(variant => (
                                <ManaTextButton key={variant} text={variant} variant={variant} />
                            ))}
                        </div>
                    ),
                    code: '<ManaTextButton text="Click me" variant="primary" />',
                    relevantProps: ["variant"],
                },
                {
                    title: "Text Variants",
                    description: "Different typography sizes and weights.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            {ManaTextButtonTextVariants.map(textVariant => (
                                <ManaTextButton key={textVariant} text={textVariant} textVariant={textVariant} />
                            ))}
                        </div>
                    ),
                    relevantProps: ["textVariant"],
                },
                {
                    title: "States",
                    description: "Normal and disabled states.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <ManaTextButton text="Normal" />
                            <ManaTextButton text="Disabled" disabled />
                        </div>
                    ),
                    relevantProps: ["disabled"],
                },
                {
                    title: "Line Clamp",
                    description: "Truncate long text to a single line.",
                    children: (
                        <div style={{ maxWidth: 200 }}>
                            <ManaTextButton text="This is a very long text that should be clamped to one line" lineClamp={1} />
                        </div>
                    ),
                    relevantProps: ["lineClamp"],
                },
            ]}
            props={TEXTBUTTON_PROPS}
        />
    );
}
