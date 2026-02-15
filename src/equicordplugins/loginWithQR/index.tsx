/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { Paragraph } from "@components/Paragraph";
import SettingsPlugin, { settingsSectionMap } from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import { getIntlMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { Button } from "@webpack/common";

import { preload, unload } from "./images";
import { QrCodeIcon } from "./ui";
import openQrModal from "./ui/modals/QrModal";

const settings = definePluginSettings({
    scanQr: {
        type: OptionType.COMPONENT,
        description: "Scan a QR code",
        component() {
            if (!plugins.LoginWithQR.started)
                return (
                    <Paragraph>
                        Enable the plugin and restart your client to scan a login QR code
                    </Paragraph>
                );

            return (
                <Button size={Button.Sizes.SMALL} onClick={openQrModal}>
                    {getIntlMessage("USER_SETTINGS_SCAN_QR_CODE")}
                </Button>
            );
        },
    },
});

export default definePlugin({
    name: "LoginWithQR",
    description: "Allows you to login to another device by scanning a login QR code, just like on mobile!",
    authors: [EquicordDevs.nexpid],

    settings,

    patches: [
        // Prevent paste event from firing when the QRModal is open
        {
            find: ".clipboardData&&(",
            replacement: {
                match: /handleGlobalPaste:(\i)/,
                replace: "handleGlobalPaste:(...args)=>!$self.qrModalOpen&&$1(...args)",
            },
        },
    ],

    qrModalOpen: false,

    start() {
        const { customEntries, customSections } = SettingsPlugin;

        customEntries.push({
            key: "equicord_login_with_qr",
            title: getIntlMessage("USER_SETTINGS_SCAN_QR_CODE"),
            Component: openQrModal,
            Icon: QrCodeIcon
        });

        customSections.push(() => ({
            section: "EquicordLoginWithQR",
            label: getIntlMessage("USER_SETTINGS_SCAN_QR_CODE"),
            searchableTitles: [getIntlMessage("USER_SETTINGS_SCAN_QR_CODE")],
            element: openQrModal,
            id: "EquicordLoginWithQR",
        }));

        settingsSectionMap.push(["EquicordLoginWithQR", "equicord_login_with_qr"]);

        preload();
    },

    stop() {
        const { customEntries, customSections } = SettingsPlugin;
        const entry = customEntries.findIndex(entry => entry.key === "equicord_login_with_qr");
        if (entry !== -1) customEntries.splice(entry, 1);
        const section = customSections.findIndex(section => section({} as any).id === "EquicordLoginWithQR");
        if (section !== -1) customSections.splice(section, 1);
        const map = settingsSectionMap.findIndex(entry => entry[1] === "equicord_login_with_qr");
        if (map !== -1) settingsSectionMap.splice(map, 1);

        unload();
    },
});
