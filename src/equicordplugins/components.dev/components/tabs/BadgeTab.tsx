/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgeShapes, CircleBadge, IconBadge, NumberBadge, PremiumBadge, TextBadge } from "..";
import { DocPage, type PropDef } from "../DocPage";
import { EquicordIcon } from "../icons/EquicordIcon";

const SHARED_PROPS: PropDef[] = [
    { name: "color", type: "string", default: "BADGE_NOTIFICATION_BACKGROUND", description: "Background color. Defaults to the notification red for most badges. CircleBadge defaults to INTERACTIVE_TEXT_ACTIVE instead." },
    { name: "disableColor", type: "boolean", default: "false", description: "Removes the background color entirely when true." },
    { name: "shape", type: "BadgeShapes", default: "ROUND", description: "Controls border radius. ROUND (pill), ROUND_LEFT, ROUND_RIGHT, or SQUARE." },
    { name: "className", type: "string", description: "Additional CSS class name." },
    { name: "style", type: "CSSProperties", description: "Inline styles." },
];

const ALL_PROPS: PropDef[] = [
    { name: "count", type: "number", required: true, description: "NumberBadge only. The count to display. Auto-abbreviates large values (1000+ becomes \"1k+\", capped at \"9k+\")." },
    { name: "renderBadgeCount", type: "(count: number) => string", description: "NumberBadge only. Custom formatter for the count display. Defaults to the built-in abbreviation." },
    { name: "text", type: "string", required: true, description: "TextBadge and PremiumBadge. The text content to display." },
    { name: "icon", type: "ComponentType<{ className?: string; color?: string; }>", required: true, description: "IconBadge only. Icon component to render inside the badge." },
    ...SHARED_PROPS,
];

export default function BadgeTab() {
    return (
        <DocPage
            componentName="Badge"
            overview="Discord's badge system provides four visual badge components (NumberBadge, TextBadge, IconBadge, CircleBadge) plus a PremiumBadge variant. All share a common set of styling props for color, shape, and disabled state. NumberBadge auto-sizes its width based on digit count and abbreviates large numbers."
            importPath={'import { NumberBadge, TextBadge, IconBadge, CircleBadge, PremiumBadge, BadgeShapes } from "../components";'}
            sections={[
                {
                    title: "NumberBadge",
                    description: "Displays a count. Auto-abbreviates at 1000+ and auto-sizes width based on digit count (16px for <10, 22px for <100, 30px otherwise).",
                    code: "<NumberBadge count={unreadCount} />",
                    relevantProps: ["count", "renderBadgeCount"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <NumberBadge count={1} />
                            <NumberBadge count={9} />
                            <NumberBadge count={99} />
                            <NumberBadge count={999} />
                            <NumberBadge count={9999} />
                        </div>
                    )
                },
                {
                    title: "TextBadge",
                    description: "Displays text content inside a badge.",
                    relevantProps: ["text"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <TextBadge text="NEW" />
                            <TextBadge text="BETA" />
                            <TextBadge text="PRO" />
                        </div>
                    )
                },
                {
                    title: "PremiumBadge",
                    description: "A TextBadge variant with an additional premium styling class applied.",
                    relevantProps: ["text"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <PremiumBadge text="PREMIUM" />
                            <PremiumBadge text="NITRO" />
                            <PremiumBadge text="BOOST" />
                        </div>
                    )
                },
                {
                    title: "IconBadge",
                    description: "Renders an icon component inside a badge. The icon receives color=\"currentColor\".",
                    code: '<IconBadge icon={StarIcon} color="var(--status-warning)" />',
                    relevantProps: ["icon"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <IconBadge icon={EquicordIcon} />
                            <IconBadge icon={EquicordIcon} color="var(--status-positive)" />
                            <IconBadge icon={EquicordIcon} color="var(--status-warning)" />
                        </div>
                    )
                },
                {
                    title: "CircleBadge",
                    description: "A simple circular dot indicator. Defaults to INTERACTIVE_TEXT_ACTIVE color unlike other badges.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <CircleBadge />
                            <CircleBadge color="var(--status-positive)" />
                            <CircleBadge color="var(--status-warning)" />
                            <CircleBadge color="var(--status-danger)" />
                        </div>
                    )
                },
                {
                    title: "Shapes",
                    description: "All four shape variants. SQUARE removes border radius entirely.",
                    code: '<TextBadge text="NEW" shape={BadgeShapes.ROUND_LEFT} color="var(--brand-500)" />',
                    relevantProps: ["shape"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <TextBadge text="ROUND" shape={BadgeShapes.ROUND} />
                            <TextBadge text="LEFT" shape={BadgeShapes.ROUND_LEFT} />
                            <TextBadge text="RIGHT" shape={BadgeShapes.ROUND_RIGHT} />
                            <TextBadge text="SQUARE" shape={BadgeShapes.SQUARE} />
                        </div>
                    )
                },
                {
                    title: "Custom Colors",
                    description: "Any CSS color value works. Use disableColor to remove the background entirely.",
                    relevantProps: ["color", "disableColor"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <NumberBadge count={5} color="var(--status-danger)" />
                            <NumberBadge count={5} color="var(--status-positive)" />
                            <NumberBadge count={5} color="var(--status-warning)" />
                            <NumberBadge count={5} color="var(--brand-500)" />
                            <NumberBadge count={5} disableColor />
                        </div>
                    )
                },
                {
                    title: "Custom Render",
                    description: "NumberBadge accepts a custom renderBadgeCount function to format the display.",
                    code: '<NumberBadge\n  count={messageCount}\n  renderBadgeCount={n => n > 99 ? "99+" : String(n)}\n/>',
                    children: (
                        <div className="vc-compfinder-grid">
                            <NumberBadge count={42} renderBadgeCount={n => `#${n}`} />
                            <NumberBadge count={100} renderBadgeCount={n => `${n}%`} />
                            <NumberBadge count={5} renderBadgeCount={() => "!"} />
                        </div>
                    )
                },
            ]}
            props={ALL_PROPS}
        />
    );
}
