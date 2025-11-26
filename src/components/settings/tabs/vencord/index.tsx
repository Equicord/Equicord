/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./VencordTab.css";

import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { useSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { FolderIcon, GithubIcon, LogIcon, PaintbrushIcon, RestartIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { DonateButton, InviteButton, openContributorModal, openPluginModal, SettingsTab, wrapTab } from "@components/settings";
import { QuickAction, QuickActionCard } from "@components/settings/QuickAction";
import { SpecialCard } from "@components/settings/SpecialCard";
import { gitRemote } from "@shared/vencordUserAgent";
import { DONOR_ROLE_ID, GUILD_ID, VC_DONOR_ROLE_ID, VC_GUILD_ID } from "@utils/constants";
import { Margins } from "@utils/margins";
import { identity, isAnyPluginDev } from "@utils/misc";
import { relaunch } from "@utils/native";
import { t, Translate } from "@utils/translation";
import { Button, GuildMemberStore, React, Select, UserStore } from "@webpack/common";
import BadgeAPI from "plugins/_api/badges";

import { openNotificationSettingsModal } from "./NotificationSettings";

const DEFAULT_DONATE_IMAGE = "https://cdn.discordapp.com/emojis/1026533090627174460.png";
const SHIGGY_DONATE_IMAGE = "https://equicord.org/assets/favicon.png";

const VENNIE_DONATOR_IMAGE = "https://cdn.discordapp.com/emojis/1238120638020063377.png";
const COZY_CONTRIB_IMAGE = "https://cdn.discordapp.com/emojis/1026533070955872337.png";

const DONOR_BACKGROUND_IMAGE = "https://media.discordapp.net/stickers/1311070116305436712.png?size=2048";
const CONTRIB_BACKGROUND_IMAGE = "https://media.discordapp.net/stickers/1311070166481895484.png?size=2048";

type KeysOfType<Object, Type> = {
    [K in keyof Object]: Object[K] extends Type ? K : never;
}[keyof Object];

function EquicordSettings() {
    const settings = useSettings();

    const donateImage = React.useMemo(
        () => (Math.random() > 0.5 ? DEFAULT_DONATE_IMAGE : SHIGGY_DONATE_IMAGE),
        [],
    );

    const isWindows = navigator.platform.toLowerCase().startsWith("win");
    const isMac = navigator.platform.toLowerCase().startsWith("mac");
    const needsVibrancySettings = IS_DISCORD_DESKTOP && isMac;

    const user = UserStore?.getCurrentUser();

    const Switches: Array<false | {
        key: KeysOfType<typeof settings, boolean>;
        title: string;
        description?: string;
        restartRequired?: boolean;
        warning: { enabled: boolean; message?: string; };
    }
    > = [
            {
                key: "useQuickCss",
                title: t("vencord.settings.useQuickCss.title"),
                description: t("vencord.settings.useQuickCss.description"),
                restartRequired: true,
                warning: { enabled: false },
            },
            !IS_WEB && {
                key: "enableReactDevtools",
                title: t("vencord.settings.enableReactDevtools.title"),
                restartRequired: true,
                warning: { enabled: false },
            },
            !IS_WEB &&
            (!IS_DISCORD_DESKTOP || !isWindows
                ? {
                    key: "frameless",
                    title: t("vencord.settings.frameless.title"),
                    restartRequired: true,
                    warning: { enabled: false },
                }
                : {
                    key: "winNativeTitleBar",
                    title: t("vencord.settings.winNativeTitleBar.title"),
                    restartRequired: true,
                    warning: { enabled: false },
                }),
            !IS_WEB && {
                key: "transparent",
                title: t("vencord.settings.transparent.title"),
                description: t("vencord.settings.transparent.description"),
                restartRequired: true,
                warning: {
                    enabled: isWindows,
                    message: "Enabling this will prevent you from snapping this window.",
                },
            },
            IS_DISCORD_DESKTOP && {
                key: "disableMinSize",
                title: t("vencord.settings.disableMinSize.title"),
                restartRequired: true,
                warning: { enabled: false },
            },
            !IS_WEB &&
            isWindows && {
                key: "winCtrlQ",
                title: t("vencord.settings.winCtrlQ.title"),
                restartRequired: true,
                warning: { enabled: false },
            },
        ];

    return (
        <SettingsTab title={t("vencord.tabs.settings")}>
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
                    <DonateButtonComponent />
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
                    buttonTitle={t("vencord.contributorCard.contributionsButton")}
                    buttonOnClick={() => openContributorModal(user)}
                />
            )}

            <section>
                <Heading>Quick Actions</Heading>

                <QuickActionCard>
                    <QuickAction
                        Icon={LogIcon}
                        text={t("vencord.quickActions.notificationLog")}
                        action={openNotificationLogModal}
                    />
                    <QuickAction
                        Icon={PaintbrushIcon}
                        text={t("vencord.quickActions.editQuickCSS")}
                        action={() => VencordNative.quickCss.openEditor()}
                    />
                    {!IS_WEB && (
                        <QuickAction
                            Icon={RestartIcon}
                            text={t("vencord.quickActions.relaunchDiscord")}
                            action={relaunch}
                        />
                    )}
                    {!IS_WEB && (
                        <QuickAction
                            Icon={FolderIcon}
                            text={t("vencord.quickActions.openSettings")}
                            action={() => VencordNative.settings.openFolder()}
                        />
                    )}
                    <QuickAction
                        Icon={GithubIcon}
                        text={t("vencord.quickActions.viewSource")}
                        action={() =>
                            VencordNative.native.openExternal(
                                "https://github.com/" + gitRemote,
                            )
                        }
                    />
                </QuickActionCard>
            </section>

            <Divider />

            <section className={Margins.top16}>
                <Heading>{t("vencord.settings.title")}</Heading>
                <Paragraph className={Margins.bottom20} style={{ color: "var(--text-muted)" }}>
                    <Translate i18nKey="vencord.settings.hint">
                        Hint: You can change the position of this settings section in the
                        <Button
                            look={Button.Looks.LINK}
                            style={{ color: "var(--text-link)", display: "inline-block" }}
                            onClick={() => openPluginModal(Vencord.Plugins.plugins.Settings)}
                        >
                            settings of the Settings plugin
                        </Button>
                        !
                    </Translate>
                </Paragraph>

                {Switches.map(
                    s =>
                        s && (
                            <FormSwitch
                                key={s.key}
                                value={settings[s.key]}
                                onChange={v => (settings[s.key] = v)}
                                title={s.title}
                                description={
                                    s.warning.enabled ? (
                                        <>
                                            {s.description}
                                            <div className="form-switch-warning">
                                                {s.warning.message}
                                            </div>
                                        </>
                                    ) : (
                                        s.description
                                    )
                                }
                            />
                        ),
                )}
            </section>

            {needsVibrancySettings && (
                <>
                    <Heading>
                        Window vibrancy style (requires restart)
                    </Heading>
                    <Select
                        className={Margins.bottom20}
                        placeholder="Window vibrancy style"
                        options={[
                            // Sorted from most opaque to most transparent
                            {
                                label: "No vibrancy",
                                value: undefined,
                            },
                            {
                                label: "Under Page (window tinting)",
                                value: "under-page",
                            },
                            {
                                label: "Content",
                                value: "content",
                            },
                            {
                                label: "Window",
                                value: "window",
                            },
                            {
                                label: "Selection",
                                value: "selection",
                            },
                            {
                                label: "Titlebar",
                                value: "titlebar",
                            },
                            {
                                label: "Header",
                                value: "header",
                            },
                            {
                                label: "Sidebar",
                                value: "sidebar",
                            },
                            {
                                label: "Tooltip",
                                value: "tooltip",
                            },
                            {
                                label: "Menu",
                                value: "menu",
                            },
                            {
                                label: "Popover",
                                value: "popover",
                            },
                            {
                                label: "Fullscreen UI (transparent but slightly muted)",
                                value: "fullscreen-ui",
                            },
                            {
                                label: "HUD (Most transparent)",
                                value: "hud",
                            },
                        ]}
                        select={v => (settings.macosVibrancyStyle = v)}
                        isSelected={v => settings.macosVibrancyStyle === v}
                        serialize={identity}
                    />
                </>
            )}

            <section
                className={Margins.top16}
                title="Equicord Notifications"
            >
                <Flex>
                    <Button onClick={openNotificationSettingsModal}>
                        Notification Settings
                    </Button>
                    <Button onClick={openNotificationLogModal} style={{ marginLeft: 16 }}>
                        View Notification Log
                    </Button>
                </Flex>
            </section>
        </SettingsTab>
    );
}

function DonateButtonComponent() {
    return (
        <Flex>
            <DonateButton
                look={Button.Looks.FILLED}
                color={Button.Colors.TRANSPARENT}
                style={{ marginTop: "1em" }}
                link="https://github.com/sponsors/thororen1234"
            />
            <InviteButton
                look={Button.Looks.FILLED}
                color={Button.Colors.TRANSPARENT}
                style={{ marginTop: "1em" }}
            />
        </Flex>
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
