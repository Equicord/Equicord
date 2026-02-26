/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaButton, ManaButtonSizes, ManaButtonVariants, Paragraph, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const BUTTON_PROPS: PropDef[] = [
    { name: "text", type: "string", description: "Button label text." },
    { name: "variant", type: "ManaButtonVariant", default: '"primary"', description: "Visual style variant." },
    { name: "size", type: "ManaButtonSize", default: '"md"', description: "Button size. Also controls icon and text variant sizing internally." },
    { name: "disabled", type: "boolean", default: "false", description: "Disables the button. When true, all event handlers are suppressed." },
    { name: "loading", type: "boolean", default: "false", description: "Shows a loading spinner overlay and suppresses event handlers like disabled." },
    { name: "loadingStartedLabel", type: "string", description: "Accessibility label announced via live region when loading begins." },
    { name: "loadingFinishedLabel", type: "string", description: "Accessibility label announced via live region when loading ends." },
    { name: "fullWidth", type: "boolean", default: "false", description: "Expands the button to fill its container width. Can be overridden by a parent ButtonGroup context." },
    { name: "rounded", type: "boolean", default: "false", description: "Applies fully rounded pill-shaped corners." },
    { name: "icon", type: "ManaButtonIconType", description: "Icon to display. Accepts a component, or an object with type \"icon\", \"rive\", or \"sticker\"." },
    { name: "iconPosition", type: '"start" | "end"', default: '"start"', description: "Which side of the text the icon appears on." },
    { name: "iconOpticalOffsetMargin", type: "number", default: "0", description: "Pixel offset margin for optical icon alignment." },
    { name: "minWidth", type: "number | string", description: "Minimum button width. Numbers are converted to px." },
    { name: "role", type: "string", default: '"button"', description: "ARIA role attribute." },
    { name: "type", type: '"button" | "submit" | "reset"', default: '"button"', description: "HTML button type attribute." },
    { name: "rel", type: "string", description: "Relationship attribute for link-style buttons." },
    { name: "onClick", type: "(e: MouseEvent) => void", description: "Click handler. Suppressed when disabled or loading." },
    { name: "onDoubleClick", type: "(e: MouseEvent) => void", description: "Double-click handler. Suppressed when disabled or loading." },
    { name: "onMouseEnter", type: "(e: MouseEvent) => void", description: "Mouse enter handler. Suppressed when disabled or loading." },
    { name: "onMouseLeave", type: "(e: MouseEvent) => void", description: "Mouse leave handler. Suppressed when disabled or loading." },
    { name: "onMouseUp", type: "(e: MouseEvent) => void", description: "Mouse up handler. Suppressed when disabled or loading." },
    { name: "onMouseDown", type: "(e: MouseEvent) => void", description: "Mouse down handler. Suppressed when disabled or loading." },
    { name: "onKeyDown", type: "(e: KeyboardEvent) => void", description: "Keyboard handler. Suppressed when disabled or loading." },
    { name: "focusProps", type: "Record<string, any>", internal: true, description: "Props forwarded to the focus management wrapper." },
    { name: "buttonRef", type: "Ref<HTMLButtonElement>", internal: true, description: "Ref attached to the underlying button element." },
    { name: "className", type: "string", description: "Additional CSS class name." },
    { name: "style", type: "CSSProperties", description: "Inline styles applied to the button." },
];

function StatesDemo() {
    const [loading, setLoading] = useState(false);

    return (
        <div className="vc-compfinder-grid">
            <ManaButton variant="primary" size="md" text="Disabled" disabled />
            <ManaButton
                variant="primary"
                size="md"
                text={loading ? "Loading..." : "Click to Load"}
                loading={loading}
                onClick={() => {
                    setLoading(true);
                    setTimeout(() => setLoading(false), 2000);
                }}
            />
            <ManaButton variant="primary" size="md" text="Rounded" rounded />
            <ManaButton variant="primary" size="md" text="Full Width" fullWidth />
        </div>
    );
}

export default function ButtonsTab() {
    return (
        <DocPage
            overview="ManaButton is Discord's primary button component used for actions and form submissions. It supports eight visual variants, three sizes, loading states, icons, and full-width layouts. Renders a native button element wrapped in a focus management provider."
            importPath={'import { ManaButton } from "../components";'}
            sections={[
                {
                    title: "Variants",
                    description: "All eight visual styles at the default medium size. The expressive variant includes a Rive animation background on hover.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {ManaButtonVariants.map(variant => (
                                <ManaButton key={variant} variant={variant} size="md" text={variant} />
                            ))}
                        </div>
                    ),
                    code: '<ManaButton variant="primary" size="md" text="Save" onClick={() => save()} />',
                    relevantProps: ["variant"],
                },
                {
                    title: "Sizes",
                    description: "Each size maps to a specific text variant internally (xs to text-xs/medium, sm to text-sm/medium, md to text-md/medium) and a corresponding icon size.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {ManaButtonSizes.map(size => (
                                <ManaButton key={size} variant="primary" size={size} text={`Size: ${size}`} />
                            ))}
                        </div>
                    ),
                    code: '<ManaButton variant="primary" size="sm" text="Small" />',
                    relevantProps: ["size"],
                },
                {
                    title: "States",
                    description: "Disabled and loading both suppress all event handlers. Loading shows a spinner overlay with accessibility announcements.",
                    children: <StatesDemo />,
                    code: '<ManaButton\n  variant="primary"\n  text="Save"\n  loading={saving}\n  loadingStartedLabel="Saving..."\n  loadingFinishedLabel="Saved!"\n  onClick={handleSave}\n/>',
                    relevantProps: ["disabled", "loading", "loadingStartedLabel", "loadingFinishedLabel", "rounded", "fullWidth"],
                },
                {
                    title: "All Variants Disabled",
                    description: "How each variant looks in its disabled state.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {ManaButtonVariants.map(variant => (
                                <ManaButton key={variant} variant={variant} size="md" text={variant} disabled />
                            ))}
                        </div>
                    ),
                },
                {
                    title: "Size \u00d7 Variant Matrix",
                    description: "Every combination of size and variant for comparison.",
                    children: (
                        <>
                            {ManaButtonSizes.map(size => (
                                <div key={size} style={{ marginBottom: 8 }}>
                                    <Paragraph color="text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
                                        Size: {size}
                                    </Paragraph>
                                    <div className="vc-compfinder-grid">
                                        {ManaButtonVariants.map(variant => (
                                            <ManaButton key={`${size}-${variant}`} variant={variant} size={size} text={variant} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    ),
                },
            ]}
            props={BUTTON_PROPS}
            examples={[
                {
                    label: "Destructive action with critical variant:",
                    code: '<ManaButton variant="critical-primary" size="sm" text="Delete" onClick={handleDelete} />',
                },
            ]}
        />
    );
}
