/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, Notice, NoticeTypes, Paragraph } from "..";
import { DocPage, type PropDef } from "../DocPage";

const NOTICE_PROPS: PropDef[] = [
    { name: "children", type: "ReactNode", required: true, description: "Notice content text." },
    { name: "messageType", type: '"info" | "warn" | "danger" | "positive" | "preview"', required: true, description: "Visual severity level of the notice." },
    { name: "action", type: "ReactNode", description: "Action element (typically a button) displayed on the right side." },
    { name: "hidden", type: "boolean", default: "false", description: "Hides the notice without removing it from the DOM." },
    { name: "textColor", type: "string", description: "Custom text color override." },
    { name: "textVariant", type: "string", default: '"text-sm/medium"', description: 'Text size/weight variant, e.g. "text-md/normal".' },
    { name: "icon", type: "ComponentType<{ className?, color? }>", description: "Custom icon component to replace the default." },
    { name: "className", type: "string", description: "Additional CSS class." },
];

export default function NoticeTab() {
    return (
        <DocPage
            componentName="Notice"
            overview="Notice displays informational messages with different severity levels. Each type has a distinct color and icon. Supports action buttons, custom icons, text variants, and can be hidden without unmounting."
            importPath={'import { Notice, NoticeTypes } from "../components";'}
            sections={[
                {
                    title: "Message Types",
                    description: "All five severity levels with distinct colors and icons.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            {NoticeTypes.map(type => (
                                <Notice key={type} messageType={type}>
                                    This is a {type} notice message.
                                </Notice>
                            ))}
                        </div>
                    ),
                    code: '<Notice messageType="info">Informational message.</Notice>',
                    relevantProps: ["messageType"],
                },
                {
                    title: "With Action Button",
                    description: "Notices can include action buttons for user interaction.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <Notice
                                messageType="info"
                                action={<Button size="small" variant="secondary">Action</Button>}
                            >
                                Notice with an action button.
                            </Notice>
                            <Notice
                                messageType="warn"
                                action={<Button size="small" variant="primary">Fix Now</Button>}
                            >
                                Warning that requires attention.
                            </Notice>
                        </div>
                    ),
                    code: `<Notice
  messageType="warn"
  action={<Button size="small" variant="primary">Fix Now</Button>}
>
  Warning that requires attention.
</Notice>`,
                    relevantProps: ["action"],
                },
                {
                    title: "Hidden State",
                    description: "The hidden prop controls visibility without removing from the DOM.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>hidden=false:</Paragraph>
                                <Notice messageType="info" hidden={false}>
                                    This notice is visible.
                                </Notice>
                            </div>
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>hidden=true (invisible below):</Paragraph>
                                <Notice messageType="info" hidden={true}>
                                    This notice is hidden.
                                </Notice>
                            </div>
                        </div>
                    ),
                    relevantProps: ["hidden"],
                },
                {
                    title: "Text Variants",
                    description: "Customize text sizing with the textVariant prop.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Default (text-sm/medium):</Paragraph>
                                <Notice messageType="info">Default text variant.</Notice>
                            </div>
                            <div>
                                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>text-md/normal:</Paragraph>
                                <Notice messageType="info" textVariant="text-md/normal">Larger text variant.</Notice>
                            </div>
                        </div>
                    ),
                    relevantProps: ["textVariant"],
                },
            ]}
            props={NOTICE_PROPS}
        />
    );
}
