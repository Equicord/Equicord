/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaButton, ManaRichTooltip } from "..";
import { DocPage, type PropDef } from "../DocPage";

const RICHTOOLTIP_PROPS: PropDef[] = [
    { name: "body", type: "string", required: true, description: "Tooltip body text." },
    { name: "children", type: "ReactNode | ((props) => ReactNode)", required: true, description: "Trigger element or render function." },
    { name: "title", type: "string", description: "Bold title text above the body." },
    { name: "position", type: '"top" | "bottom" | "left" | "right"', description: "Position relative to the trigger." },
    { name: "align", type: '"start" | "center" | "end"', description: "Alignment along the position axis." },
    { name: "spacing", type: "number", description: "Distance in pixels from the trigger element." },
    { name: "asContainer", type: "boolean", description: "Wrap children in a container element for hover detection." },
    { name: "element", type: '"span" | "div"', description: "HTML element type for the container when asContainer is true." },
    { name: "asset", type: "ReactNode | { src: string; alt?: string }", description: "Image or element displayed in the tooltip." },
    { name: "assetSize", type: "number", description: "Size of the asset in pixels." },
    { name: "targetElementRef", type: "RefObject<HTMLElement>", description: "Ref to an external trigger element instead of wrapping children." },
    { name: "anchorRef", type: "RefObject<HTMLElement>", description: "Ref to an anchor element for positioning." },
    { name: "positionKey", type: "string", internal: true, description: "Unique key for position caching." },
    { name: "caretConfig", type: '{ align?: "start" | "center" | "end" }', description: "Configuration for the caret arrow." },
    { name: "layerContext", type: "any", internal: true, description: "Layer context for stacking." },
    { name: "ariaHidden", type: "boolean", default: "false", description: "Hide the tooltip from screen readers." },
    { name: "shouldShow", type: "boolean", default: "true", description: "Externally control whether the tooltip is shown." },
    { name: "delay", type: "number", description: "Delay in milliseconds before the tooltip appears." },
    { name: "forceOpen", type: "boolean", default: "false", description: "Force the tooltip to stay open." },
    { name: "overflowOnly", type: "boolean", default: "false", description: "Only show when the trigger text is overflowing." },
    { name: "hideOnClick", type: "boolean", default: "true", description: "Hide when the trigger is clicked." },
    { name: "onTooltipShow", type: "() => void", description: "Callback when the tooltip becomes visible." },
    { name: "onTooltipHide", type: "() => void", description: "Callback when the tooltip is hidden." },
];

export default function RichTooltipTab() {
    return (
        <DocPage
            componentName="ManaRichTooltip"
            overview="ManaRichTooltip is Discord's rich tooltip component that displays a title, body text, and optional assets on hover. Unlike ManaTooltip which is text-only, RichTooltip supports structured content with headings and descriptions."
            notices={[
                { type: "info", children: "Use asContainer when wrapping components that don't forward refs or hover props. Without it, the tooltip may not detect hover events on the trigger element." },
            ]}
            importPath={'import { ManaRichTooltip } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Rich tooltip with title and body text. Hover to preview.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <ManaRichTooltip title="Tooltip Title" body="This is the body text with more detailed information." asContainer>
                                <ManaButton variant="secondary" text="Hover me" />
                            </ManaRichTooltip>
                            <ManaRichTooltip body="This tooltip only has body text, no title." asContainer>
                                <ManaButton variant="secondary" text="Body Only" />
                            </ManaRichTooltip>
                        </div>
                    ),
                    code: `<ManaRichTooltip title="Title" body="Body text here." asContainer>
  <Button>Hover me</Button>
</ManaRichTooltip>`,
                    relevantProps: ["title", "body", "asContainer"],
                },
                {
                    title: "Positions",
                    description: "Tooltip can appear on any side of the trigger element.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {(["top", "bottom", "left", "right"] as const).map(pos => (
                                <ManaRichTooltip key={pos} title={pos} body={`Positioned at ${pos}`} position={pos} asContainer>
                                    <ManaButton variant="secondary" text={pos} />
                                </ManaRichTooltip>
                            ))}
                        </div>
                    ),
                    relevantProps: ["position"],
                },
                {
                    title: "Alignment",
                    description: "Align the tooltip along the position axis.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {(["start", "center", "end"] as const).map(align => (
                                <ManaRichTooltip key={align} title={`${align} aligned`} body={`Tooltip aligned to ${align}`} align={align} asContainer>
                                    <ManaButton variant="secondary" text={align} />
                                </ManaRichTooltip>
                            ))}
                        </div>
                    ),
                    relevantProps: ["align"],
                },
                {
                    title: "Custom Spacing",
                    description: "Control the distance between tooltip and trigger.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <ManaRichTooltip title="4px spacing" body="Minimal spacing." spacing={4} asContainer>
                                <ManaButton variant="secondary" text="4px" />
                            </ManaRichTooltip>
                            <ManaRichTooltip title="16px spacing" body="Increased spacing." spacing={16} asContainer>
                                <ManaButton variant="secondary" text="16px" />
                            </ManaRichTooltip>
                        </div>
                    ),
                    relevantProps: ["spacing"],
                },
                {
                    title: "Container Element",
                    description: "Choose the wrapper element type for the trigger.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <ManaRichTooltip title="Span" body="Uses span container (default)" element="span" asContainer>
                                <ManaButton variant="secondary" text="Span" />
                            </ManaRichTooltip>
                            <ManaRichTooltip title="Div" body="Uses div container" element="div" asContainer>
                                <ManaButton variant="secondary" text="Div" />
                            </ManaRichTooltip>
                        </div>
                    ),
                    relevantProps: ["element"],
                },
            ]}
            props={RICHTOOLTIP_PROPS}
        />
    );
}
