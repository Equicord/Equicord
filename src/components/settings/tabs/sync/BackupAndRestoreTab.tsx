/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { downloadSettingsBackup, uploadSettingsBackup } from "@api/SettingsSync/offline";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Margins } from "@utils/margins";
import { t } from "@api/I18n";

function BackupAndRestoreTab() {
    return (
        <SettingsTab>
            <Heading className={Margins.top16}>{t("equicord.ui.backupRestore.title", "Backup & Restore")}</Heading>
            <Paragraph className={Margins.bottom20}>
                {t("equicord.ui.backupRestore.description", "Import and export your Equicord settings as a JSON file. This allows you to easily transfer your settings to another device, or recover them after reinstalling Equicord or Discord.")}
            </Paragraph>

            <Notice.Warning className={Margins.bottom20}>
                {t("equicord.ui.backupRestore.warning", "Importing a settings file will overwrite your current settings. Make sure to export a backup first if you want to keep your current configuration.")}
            </Notice.Warning>

            <Heading>{t("equicord.ui.backupRestore.whatsIncluded", "What's included in a backup")}</Heading>
            <Paragraph className={Margins.bottom20}>
                {t("equicord.ui.backupRestore.includedItems", "• Custom QuickCSS\n• Theme Links\n• Plugin Settings\n• DataStore Data")}
            </Paragraph>

            <Divider className={Margins.bottom20} />

            <Heading>{t("equicord.ui.backupRestore.importSettings", "Import Settings")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("equicord.ui.backupRestore.importDescription", "Select a previously exported settings file to restore your configuration. This will replace all your current settings with the ones from the backup.")}
            </Paragraph>

            <Flex gap="8px" className={Margins.bottom20} style={{ flexWrap: "wrap" }}>
                <Button
                    onClick={() => uploadSettingsBackup("all")}
                    size="small"
                    variant="secondary"
                >
                    {t("equicord.ui.backupRestore.importAll", "Import All Settings")}
                </Button>
                <Button
                    onClick={() => uploadSettingsBackup("plugins")}
                    size="small"
                >
                    {t("equicord.ui.backupRestore.importPlugins", "Import Plugins")}
                </Button>
                <Button
                    onClick={() => uploadSettingsBackup("css")}
                    size="small"
                >
                    {t("equicord.ui.backupRestore.importQuickCSS", "Import QuickCSS")}
                </Button>
                <Button
                    onClick={() => uploadSettingsBackup("datastore")}
                    size="small"
                >
                    {t("equicord.ui.backupRestore.importDataStore", "Import DataStore")}
                </Button>
            </Flex>

            <Divider className={Margins.bottom20} />

            <Heading>{t("equicord.ui.backupRestore.exportSettings", "Export Settings")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("equicord.ui.backupRestore.exportDescription", "Download your current settings as a backup file. You can export everything at once, or choose to export only specific parts of your configuration.")}
            </Paragraph>

            <Flex gap="8px" style={{ flexWrap: "wrap" }}>
                <Button
                    onClick={() => downloadSettingsBackup("all")}
                    size="small"
                    variant="secondary"
                >
                    {t("equicord.ui.backupRestore.exportAll", "Export All Settings")}
                </Button>
                <Button
                    onClick={() => downloadSettingsBackup("plugins")}
                    size="small"
                >
                    {t("equicord.ui.backupRestore.exportPlugins", "Export Plugins")}
                </Button>
                <Button
                    onClick={() => downloadSettingsBackup("css")}
                    size="small"
                >
                    {t("equicord.ui.backupRestore.exportQuickCSS", "Export QuickCSS")}
                </Button>
                <Button
                    onClick={() => downloadSettingsBackup("datastore")}
                    size="small"
                >
                    {t("equicord.ui.backupRestore.exportDataStore", "Export DataStore")}
                </Button>
            </Flex>
        </SettingsTab>
    );
}

export default wrapTab(BackupAndRestoreTab, "Backup & Restore");
