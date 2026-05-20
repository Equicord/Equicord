/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { TextButton } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { t } from "@utils/translation";
import { OptionType } from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import DecorPlugin from ".";
import DecorSection from "./ui/components/DecorSection";

export const settings = definePluginSettings({
    changeDecoration: {
        type: OptionType.COMPONENT,
        component({ closePluginSettings }) {
            if (!DecorPlugin.started) return <Paragraph>
                {t("vencord.decor.enableAndRestart")}
            </Paragraph>;

            return <div>
                <DecorSection hideTitle hideDivider noMargin />
                <Paragraph className={classes(Margins.top8, Margins.bottom8)}>
                    {t("vencord.decor.accessFromProfiles", {
                        link: <TextButton
                            variant="link"
                            onClick={async () => {
                                closePluginSettings();
                                SettingsRouter.openUserSettings("profile_panel");
                            }}
                        >{t("vencord.decor.profilesLink")}</TextButton>
                    })}
                </Paragraph>
            </div>;
        }
    },
    baseUrl: {
        type: OptionType.STRING,
        hidden: true,
        description: t("vencord.decor.baseUrl"),
        default: "https://decor.fieryflames.dev"
    },
    agreedToGuidelines: {
        type: OptionType.BOOLEAN,
        description: t("vencord.decor.agreedToGuidelines"),
        hidden: true,
        default: false
    }
});
