/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./VencordTab.css";

import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { plugins } from "@api/PluginManager";
import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { FolderIcon, GithubIcon, LogIcon, PaintbrushIcon, RestartIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { openContributorModal, openPluginModal, SettingsTab, wrapTab } from "@components/settings";
import { QuickAction, QuickActionCard } from "@components/settings/QuickAction";
import { SpecialCard } from "@components/settings/SpecialCard";
import BadgeAPI from "@plugins/_api/badges";
import { gitRemote } from "@shared/vencordUserAgent";
import { DONOR_ROLE_ID, GUILD_ID, IS_WINDOWS, VC_DONOR_ROLE_ID, VC_GUILD_ID } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { isAnyPluginDev } from "@utils/misc";
import { relaunch } from "@utils/native";
import { t } from "@utils/translation";
import { Alerts, GuildMemberStore, React, useMemo, UserStore } from "@webpack/common";

import { DonateButtonComponent } from "./DonateButton";
import { MacOSVibrancySettings } from "./MacVibrancySettings";
import { NotificationSection } from "./NotificationSettings";
import { WindowsMaterialSettings } from "./WindowsMaterialSettings";

const DEFAULT_DONATE_IMAGE = "https://cdn.discordapp.com/emojis/1026533090627174460.png";
const SHIGGY_DONATE_IMAGE = "https://equicord.org/assets/favicon.png";

const VENNIE_DONATOR_IMAGE = "https://cdn.discordapp.com/emojis/1238120638020063377.png";
const COZY_CONTRIB_IMAGE = "https://cdn.discordapp.com/emojis/1026533070955872337.png";

const DONOR_BACKGROUND_IMAGE = "https://media.discordapp.net/stickers/1311070116305436712.png?size=2048";
const CONTRIB_BACKGROUND_IMAGE = "https://media.discordapp.net/stickers/1311070166481895484.png?size=2048";

const cl = classNameFactory("vc-vencord-tab-");

type KeysOfType<Object, Type> = {
    [K in keyof Object]: Object[K] extends Type ? K : never;
}[keyof Object];

function Switches() {
    const settings = useSettings(["useQuickCss", "enableReactDevtools", "mainWindowFrameless", "frameless", "winNativeTitleBar", "transparent", "winCtrlQ", "disableMinSize"]);

    const Switches = [
        {
            key: "useQuickCss",
            title: t("vencord.settings.useQuickCss.title"),
            description: t("vencord.settings.useQuickCss.description"),
        },
        !IS_WEB && {
            key: "enableReactDevtools",
            title: t("vencord.settings.enableReactDevtools.title"),
            description: t("vencord.settings.enableReactDevtools.description"),
            restartRequired: true,
        },
        (!IS_WEB && !IS_DISCORD_DESKTOP || !IS_WINDOWS) && {
            key: "mainWindowFrameless",
            title: t("equicord.mainWindowFrameless.title"),
            description: t("equicord.mainWindowFrameless.description"),
            restartRequired: true,
        },
        !IS_WEB && (!IS_DISCORD_DESKTOP || !IS_WINDOWS
            ? {
                key: "frameless",
                title: t("vencord.settings.frameless.title"),
                description: t("vencord.settings.frameless.description"),
                restartRequired: true,
            }
            : {
                key: "winNativeTitleBar",
                title: t("vencord.settings.winNativeTitleBar.title"),
                description: t("vencord.settings.winNativeTitleBar.description"),
                restartRequired: true,
            }
        ),
        !IS_WEB && {
            key: "transparent",
            title: t("vencord.settings.transparent.title"),
            description: t("vencord.settings.transparent.description"),
            restartRequired: true,
            warning: IS_WINDOWS
                ? t("vencord.settings.transparent.noteWindows")
                : t("vencord.settings.transparent.note"),
        },
        IS_DISCORD_DESKTOP && {
            key: "disableMinSize",
            title: t("vencord.settings.disableMinSize.title"),
            description: t("vencord.settings.disableMinSize.description"),
            restartRequired: true,
        },
        !IS_WEB &&
        IS_WINDOWS && {
            key: "winCtrlQ",
            title: t("vencord.settings.winCtrlQ.title"),
            description: t("vencord.settings.winCtrlQ.description"),
            restartRequired: true,
        }
    ] satisfies Array<false | {
        key: KeysOfType<typeof settings, boolean>;
        title: string;
        description?: string;
        restartRequired?: boolean;
        warning?: string;
    }>;

    return Switches.map(setting => {
        if (!setting) {
            return null;
        }

        const { key, title, description, restartRequired, warning } = setting;

        return (
            <FormSwitch
                key={key}
                title={title}
                description={
                    warning ? (
                        <>
                            {description}
                            <Notice.Warning className={Margins.top8} style={{ width: "100%" }}>
                                {warning}
                            </Notice.Warning>
                        </>
                    ) : (
                        description
                    )
                }
                value={settings[key]}
                onChange={v => {
                    settings[key] = v;

                    if (restartRequired) {
                        Alerts.show({
                            title: t("vencord.settings.restartRequired.title"),
                            body: t("vencord.settings.restartRequired.body"),
                            confirmText: t("vencord.settings.restartRequired.confirm"),
                            cancelText: t("vencord.settings.restartRequired.cancel"),
                            onConfirm: relaunch
                        });
                    }
                }}
                hideBorder
            />
        );
    });
}

function EquicordSettings() {
    const donateImage = useMemo(() =>
        Math.random() > 0.5 ? DEFAULT_DONATE_IMAGE : SHIGGY_DONATE_IMAGE,
    []
    );

    const user = UserStore?.getCurrentUser();

    return (
        <SettingsTab>
            {(isEquicordDonor(user?.id) || isVencordDonor(user?.id)) ? (
                <SpecialCard
                    title={t("vencord.donorCard.donated.title")}
                    subtitle={t("vencord.donorCard.donated.subtitle")}
                    description={
                        isEquicordDonor(user?.id) && isVencordDonor(user?.id)
                            ? t("vencord.donorCard.donated.description")
                            : isVencordDonor(user?.id)
                                ? t("vencord.donorCard.donated.vencordDescription", { v: "vending.machine" })
                                : t("vencord.donorCard.donated.equicordDescription")
                    }
                    cardImage={VENNIE_DONATOR_IMAGE}
                    backgroundImage={DONOR_BACKGROUND_IMAGE}
                    backgroundColor="#ED87A9"
                >
                    <DonateButtonComponent donated={true} />
                </SpecialCard>
            ) : (
                <SpecialCard
                    title={t("vencord.donorCard.notDonated.title")}
                    description={t("vencord.donorCard.notDonated.description")}
                    cardImage={donateImage}
                    backgroundImage={DONOR_BACKGROUND_IMAGE}
                    backgroundColor="#c3a3ce"
                >
                    <DonateButtonComponent />
                </SpecialCard>
            )}
            {isAnyPluginDev(user?.id) && (
                <SpecialCard
                    title={t("vencord.contributorCard.title")}
                    subtitle={t("vencord.contributorCard.subtitle")}
                    description={t("vencord.contributorCard.description")}
                    cardImage={COZY_CONTRIB_IMAGE}
                    backgroundImage={CONTRIB_BACKGROUND_IMAGE}
                    backgroundColor="#EDCC87"
                >
                    <Button
                        variant="none"
                        size="medium"
                        type="button"
                        onClick={() => openContributorModal(user)}
                        className="vc-contrib-button"
                    >
                        <GithubIcon aria-hidden fill={"#000000"} className={"vc-contrib-github"} />
                        {t("vencord.contributorCard.contributionsButton")}
                    </Button>
                </SpecialCard>
            )}

            <Heading className={Margins.top16}>Quick Actions</Heading>
            <Paragraph className={Margins.bottom16}>
                Common actions you might want to perform. These shortcuts give you quick access to frequently used features without navigating through menus.
            </Paragraph>

            <QuickActionCard>
                <QuickAction
                    Icon={LogIcon}
                    text="Notification Log"
                    action={openNotificationLogModal}
                />
                <QuickAction
                    Icon={PaintbrushIcon}
                    text="Edit QuickCSS"
                    action={() => VencordNative.quickCss.openEditor()}
                />
                {!IS_WEB && (
                    <QuickAction
                        Icon={RestartIcon}
                        text="Relaunch Discord"
                        action={relaunch}
                    />
                )}
                {!IS_WEB && (
                    <QuickAction
                        Icon={FolderIcon}
                        text="Open Settings Folder"
                        action={() => VencordNative.settings.openFolder()}
                    />
                )}
                <QuickAction
                    Icon={GithubIcon}
                    text="View Source Code"
                    action={() =>
                        VencordNative.native.openExternal(
                            "https://github.com/" + gitRemote,
                        )
                    }
                />
            </QuickActionCard>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Client Settings</Heading>
            <Paragraph className={Margins.bottom16}>
                Configure how Equicord behaves and integrates with Discord. These settings affect the Discord client's appearance and behavior.
            </Paragraph>
            <Notice.Info className={Margins.bottom20} style={{ width: "100%" }}>
                You can customize where this settings section appears in Discord's settings menu by configuring the{" "}
                <a
                    role="button"
                    onClick={() => openPluginModal(plugins.Settings)}
                    style={{ cursor: "pointer", color: "var(--text-link)" }}
                >
                    Settings Plugin
                </a>.
            </Notice.Info>

            <Switches />

            <MacOSVibrancySettings />
            <WindowsMaterialSettings />

            <NotificationSection />
        </SettingsTab >
    );
}

export default wrapTab(EquicordSettings, t("vencord.tabs.settings"));

export function isEquicordDonor(userId: string): boolean {
    const donorBadges = BadgeAPI.getEquicordDonorBadges(userId);
    return GuildMemberStore.getMember(GUILD_ID, userId)?.roles.includes(DONOR_ROLE_ID) || !!donorBadges;
}

export function isVencordDonor(userId: string): boolean {
    const donorBadges = BadgeAPI.getDonorBadges(userId);
    return GuildMemberStore.getMember(VC_GUILD_ID, userId)?.roles.includes(VC_DONOR_ROLE_ID) || !!donorBadges;
}
