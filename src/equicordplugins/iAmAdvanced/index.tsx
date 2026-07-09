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

const AdvancedClasses = findCssClassesLazy(
    "trigger",
    "advancedTitle",
    "titleCaret",
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

const CollapsibleCard = ErrorBoundary.wrap(
    ({ children }: { children: ReactNode }) => {
        const [open, setOpen] = useState(!settings.store.collapsedByDefault);

        return (
            <div className={Margins.top16}>
                <Clickable
                    className={AdvancedClasses.trigger}
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
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

export default definePlugin({
    name: "IAmAdvanced",
    description:
        "Hide Discord's simplified permissions card and make the advanced permissions the primary view.",
    authors: [EquicordDevs.bastih18],
    settings,

    patches: [
        {
            find: 'id:"PrivateChannelSettingCard"',
            replacement: [
                {
                    // simplified card renderer
                    match: /\(0,\i\.jsx\)\(\i,\{channel:\i,guild:\i,isPrivateGuildChannel:\i,roles:\i,members:\i\}\)/,
                    replace: "$self.renderCard($&)",
                },
                {
                    // always force advanced open
                    match: /isExpanded:\i(?=,onExpandedChange:)/,
                    replace: "isExpanded:!0",
                },
                {
                    // drop advanced header
                    match: /component:(?=\(0,\i\.jsx\)\(\i\.\i,\{children:\(0,\i\.jsx\)\(\i\.\i,\{slot:"trigger")/,
                    replace: "component:null&&",
                },
                {
                    // hide divider when card hidden, else tighten it
                    match: /(?<=children:\[)(\(0,\i\.jsx\)\(\i\.\i,\{className:)(\i\.\i)(\}\))(?=,\(0,\i\.jsx\)\(\i\.\i,\{isExpanded:)/,
                    replace:
                        '$self.cardHidden()?null:$1$2+" vc-iamadvanced-divider"$3',
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
