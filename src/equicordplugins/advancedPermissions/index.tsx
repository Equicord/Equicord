/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { Margins } from "@utils/margins";
import definePlugin, { OptionType } from "@utils/types";
import { findCssClassesLazy } from "@webpack";
import { Clickable, useState } from "@webpack/common";
import type { ReactNode } from "react";

const AdvancedClasses = findCssClassesLazy("trigger", "advancedTitle", "titleCaret");
const CollapsibleCard = ErrorBoundary.wrap(
    ({ children }: { children: ReactNode; }) => {
        const [open, setOpen] = useState(!settings.store.collapsedByDefault);

        return (
            <div className={Margins.top16}>
                <Clickable
                    className={AdvancedClasses.trigger}
                    aria-expanded={open}
                    onClick={() => setOpen(v => !v)}
                >
                    <BaseText
                        size="lg"
                        weight="semibold"
                        className={AdvancedClasses.advancedTitle}
                    >
                        Simplified permissions
                        <svg
                            className={AdvancedClasses.titleCaret}
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            style={{
                                transform: open
                                    ? "rotate(0deg)"
                                    : "rotate(-90deg)",
                                transition: "transform .2s",
                            }}
                        >
                            <path
                                fill="currentColor"
                                d="M5.3 9.3a1 1 0 0 1 1.4 0l5.3 5.29 5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.42Z"
                            />
                        </svg>
                    </BaseText>
                </Clickable>
                {open ? children : null}
            </div>
        );
    },
    { noop: true },
);

const settings = definePluginSettings({
    simplifiedCard: {
        type: OptionType.SELECT,
        description: "What to do with Discord's simplified permissions card",
        options: [
            { label: "Hide it", value: "hide", default: true },
            { label: "Make it collapsible", value: "collapse" },
            { label: "Leave it visible", value: "show" },
        ],
    },
    collapsedByDefault: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Start the simplified permissions collapsed.",
        disabled: () => settings.store.simplifiedCard !== "collapse",
    },
});

export default definePlugin({
    name: "AdvancedPermissions",
    description: "Show advanced permissions card by default.",
    authors: [EquicordDevs.bastih18],
    settings,

    patches: [
        {
            find: 'id:"PrivateChannelSettingCard"',
            replacement: [
                {
                    // simplified card renderer
                    match: /(?<=permissionUpdates:\i\}\):null,).{0,100}roles:\i,members:\i\}\)/,
                    replace: "$self.renderCard($&)",
                },
                {
                    // hide divider when card hidden, else tighten it
                    match: /(?<=advancedMode\);.{0,30}children:\[)/,
                    replace: "$self.cardHidden()?null:",
                },
                {
                    // hide divider when card hidden, else tighten it
                    match: /className:\i\.\i(?=.{0,50}onExpandedChange)/,
                    replace: '$&+" vc-iamadvanced-divider"',
                },
                {
                    // always force advanced open
                    match: /isExpanded:\i(?=,onExpandedChange:)/,
                    replace: "isExpanded:!0",
                },
                {
                    // drop advanced header
                    match: /component:(?=.{0,50}slot:"trigger")/,
                    replace: "component:null&&",
                },
            ],
        },
    ],

    cardHidden() {
        return settings.store.simplifiedCard === "hide";
    },

    renderCard(card: ReactNode) {
        switch (settings.store.simplifiedCard) {
            case "hide":
                return null;
            case "collapse":
                return <CollapsibleCard>{card}</CollapsibleCard>;
            default:
                return card;
        }
    },
});
