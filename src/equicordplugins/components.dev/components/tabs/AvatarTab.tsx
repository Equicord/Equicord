/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Avatar, AvatarSizes, AvatarStatuses, Paragraph, UserStore } from "..";
import { DocPage, type PropDef } from "../DocPage";

const AVATAR_PROPS: PropDef[] = [
    { name: "src", type: "string", description: "Avatar image URL." },
    { name: "size", type: "AvatarSize", description: "Avatar size constant (SIZE_16 through SIZE_152). Controls the SVG viewBox dimensions." },
    { name: "status", type: "AvatarStatus", description: "User presence status. Renders a colored indicator dot." },
    { name: "statusColor", type: "string", description: "Override the status indicator color." },
    { name: "statusBackdropColor", type: "string", description: "Background color behind the status indicator." },
    { name: "isMobile", type: "boolean", default: "false", description: "Shows the mobile phone status indicator instead of a dot." },
    { name: "isVR", type: "boolean", default: "false", description: "Shows the VR headset status indicator." },
    { name: "isTyping", type: "boolean", default: "false", description: "Shows a typing animation in the status area." },
    { name: "isSpeaking", type: "boolean", default: "false", description: "Renders an animated speaking ring around the avatar." },
    { name: "isLatched", type: "boolean", default: "false", description: "Latched speaking state for voice activity." },
    { name: "voiceDb", type: "number", description: "Voice volume level in dB for speaking animation intensity." },
    { name: "speakingStylesConfig", type: "Record<string, any>", description: "Custom styles config for the speaking ring animation." },
    { name: "statusTooltip", type: "boolean", default: "false", description: "Shows a tooltip with the status text on hover." },
    { name: "statusTooltipDelay", type: "number", description: "Delay in ms before the status tooltip appears." },
    { name: "typingIndicatorRef", type: "Ref<any>", description: "Ref for the typing indicator element." },
    { name: "avatarContentRef", type: "Ref<any>", description: "Ref for the avatar image foreignObject content." },
    { name: "CutoutIcon", type: "ComponentType<any>", description: "Custom icon component rendered as a cutout overlay on the avatar." },
    { name: "avatarTooltipAsset", type: "ReactNode", description: "Custom tooltip asset displayed on the avatar." },
    { name: "avatarTooltipText", type: "string", description: "Tooltip text for the avatar overlay." },
    { name: "avatarTooltipTitle", type: "string", description: "Tooltip title for the avatar overlay." },
    { name: "avatarDecoration", type: "string", description: "URL for the avatar decoration overlay image." },
    { name: "aria-hidden", type: "boolean", default: "false", description: "Hides the avatar from screen readers." },
    { name: "aria-label", type: "string", description: "Accessibility label for the avatar." },
    { name: "imageClassName", type: "string", description: "CSS class applied to the avatar image element." },
    { name: "className", type: "string", description: "CSS class applied to the root wrapper." },
    { name: "onClick", type: "MouseEventHandler", description: "Click handler on the avatar wrapper. Makes the avatar interactive." },
    { name: "onMouseDown", type: "MouseEventHandler", description: "Mouse down handler on the avatar wrapper." },
    { name: "onKeyDown", type: "KeyboardEventHandler", description: "Key down handler on the avatar wrapper." },
    { name: "onContextMenu", type: "MouseEventHandler", description: "Context menu handler on the avatar wrapper." },
    { name: "onMouseEnter", type: "MouseEventHandler", description: "Mouse enter handler on the avatar wrapper." },
    { name: "onMouseLeave", type: "MouseEventHandler", description: "Mouse leave handler on the avatar wrapper." },
    { name: "tabIndex", type: "number", description: "Tab index for keyboard navigation on the avatar wrapper." },
    { name: "ref", type: "Ref<SVGSVGElement>", description: "Ref to the root SVG element." },
];

export default function AvatarTab() {
    const currentUser = UserStore.getCurrentUser();
    const avatarUrl = currentUser?.getAvatarURL?.(undefined, 128);

    return (
        <DocPage
            componentName="Avatar"
            overview="Avatar renders a user's profile picture as an SVG with optional status indicators, speaking rings, typing animations, and tooltip overlays. It handles all the visual states used throughout Discord's UI including mobile, VR, and voice activity indicators."
            importPath={'import { Avatar } from "../components";'}
            sections={[
                {
                    title: "Sizes",
                    description: "All 13 available sizes from 16px to 152px.",
                    relevantProps: ["size", "src"],
                    children: (
                        <div className="vc-compfinder-grid" style={{ alignItems: "flex-end" }}>
                            {AvatarSizes.map(size => (
                                <div key={size} style={{ textAlign: "center" }}>
                                    <Avatar src={avatarUrl} size={size} />
                                    <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                        {size.replace("SIZE_", "")}
                                    </Paragraph>
                                </div>
                            ))}
                        </div>
                    )
                },
                {
                    title: "Statuses",
                    description: "All status indicator variants.",
                    code: '<Avatar src={user.getAvatarURL()} size="SIZE_40" status="online" />',
                    relevantProps: ["status", "statusColor", "statusBackdropColor"],
                    children: (
                        <div className="vc-compfinder-grid">
                            {AvatarStatuses.map(status => (
                                <div key={status} style={{ textAlign: "center" }}>
                                    <Avatar src={avatarUrl} size="SIZE_40" status={status} />
                                    <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                        {status}
                                    </Paragraph>
                                </div>
                            ))}
                        </div>
                    )
                },
                {
                    title: "Mobile Status",
                    description: "Shows the mobile phone icon instead of a status dot when isMobile is true.",
                    code: '<Avatar src={avatarUrl} size="SIZE_32" status="online" isMobile statusTooltip />',
                    relevantProps: ["isMobile", "isVR"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <div style={{ textAlign: "center" }}>
                                <Avatar src={avatarUrl} size="SIZE_40" status="online" isMobile />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>Mobile</Paragraph>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <Avatar src={avatarUrl} size="SIZE_40" status="online" isVR />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>VR</Paragraph>
                            </div>
                        </div>
                    )
                },
                {
                    title: "Speaking State",
                    description: "Animated ring indicator for voice activity.",
                    code: '<Avatar src={avatarUrl} size="SIZE_80" isSpeaking voiceDb={voiceLevel} />',
                    relevantProps: ["isSpeaking", "isLatched", "voiceDb"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <div style={{ textAlign: "center" }}>
                                <Avatar src={avatarUrl} size="SIZE_40" isSpeaking />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>Speaking</Paragraph>
                            </div>
                        </div>
                    )
                },
                {
                    title: "Typing Indicator",
                    description: "Shows a typing animation in the status area.",
                    relevantProps: ["isTyping"],
                    children: (
                        <div className="vc-compfinder-grid">
                            <div style={{ textAlign: "center" }}>
                                <Avatar src={avatarUrl} size="SIZE_40" status="online" isTyping />
                                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>Typing</Paragraph>
                            </div>
                        </div>
                    )
                },
                {
                    title: "Status Tooltip",
                    description: "Hover to see the status text tooltip.",
                    relevantProps: ["statusTooltip", "statusTooltipDelay"],
                    children: (
                        <div className="vc-compfinder-grid">
                            {AvatarStatuses.map(status => (
                                <div key={status} style={{ textAlign: "center" }}>
                                    <Avatar src={avatarUrl} size="SIZE_40" status={status} statusTooltip />
                                    <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
                                        {status}
                                    </Paragraph>
                                </div>
                            ))}
                        </div>
                    )
                },
            ]}
            props={AVATAR_PROPS}
        />
    );
}
