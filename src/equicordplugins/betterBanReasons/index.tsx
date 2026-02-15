/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { Heading } from "@components/Heading";
import { DeleteIcon, PlusIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { Button, TextInput } from "@webpack/common";

const cl = classNameFactory("vc-bbr-");

function ReasonsComponent() {
    const { reasons } = settings.store;

    return (
        <section>
            <Heading>{t("betterBanReasons.ui.reasons")}</Heading>
            {reasons.map((r, i) => (
                <div
                    key={i}
                    className={cl("reason-wrapper")}
                >
                    <TextInput
                        value={r}
                        onChange={v => {
                            reasons[i] = v;
                            settings.store.reasons = reasons;
                        }}
                        placeholder={t("betterBanReasons.ui.reasonPlaceholder")}
                    />
                    <Button
                        className={cl("remove-button")}
                        color={Button.Colors.TRANSPARENT}
                        onClick={() => {
                            reasons.splice(i, 1);
                            settings.store.reasons = reasons;
                        }}
                        look={Button.Looks.FILLED}
                        size={Button.Sizes.MIN}
                    >
                        <DeleteIcon />
                    </Button>
                </div>
            ))}
            <div className={cl("reason-wrapper")}>
                <Button onClick={() => settings.store.reasons.push("")} className={cl("add-button")} size={Button.Sizes.LARGE} color={Button.Colors.TRANSPARENT}>
                    <PlusIcon /> {t("betterBanReasons.ui.addAnotherReason")}
                </Button>
            </div>
        </section>
    );
}

const settings = definePluginSettings({
    reasons: {
        description: t("betterBanReasons.settings.reasons"),
        type: OptionType.COMPONENT,
        default: [] as string[],
        component: ReasonsComponent,
    },
    isTextInputDefault: {
        type: OptionType.BOOLEAN,
        description: t("betterBanReasons.settings.isTextInputDefault")
    }
});

export default definePlugin({
    name: "BetterBanReasons",
    description: t("betterBanReasons.description"),
    authors: [Devs.Inbestigator],
    patches: [
        {
            find: "#{intl::BAN_REASON_OPTION_SPAM_ACCOUNT}",
            replacement: [{
                match: /(\[\{name:\i\.\i\.\i\(\i\.\i\.\i\),.+?"other"\}\])/,
                replace: "$self.getReasons($1)"
            },
            {
                match: /useState\(null\)(?=.{0,300}targetUserId:)/,
                replace: "useState($self.getDefaultState())"
            }]
        }
    ],
    getReasons(defaults) {
        const storedReasons = settings.store.reasons.filter((r: string) => r.trim());
        const reasons: string[] = storedReasons.length
            ? storedReasons
            : [];
        return [
            ...reasons.map(s => ({ name: s, value: s })),
            ...defaults
        ];
    },
    getDefaultState: () => settings.store.isTextInputDefault ? 1 : 0,
    settings,
});
