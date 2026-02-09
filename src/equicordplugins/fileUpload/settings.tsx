/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsSection } from "@components/settings/tabs/plugins/components/Common";
import { Switch } from "@components/Switch";
import { useForceUpdater } from "@utils/react";
import { Select, TextInput } from "@webpack/common";

import { settings } from "./index";
import { ServiceType } from "./types";

export function SettingsComponent() {
    const update = useForceUpdater();
    const { store } = settings;
    const isNest = store.serviceType === ServiceType.NEST;
    const isEzHost = store.serviceType === ServiceType.EZHOST;
    const isZipline = store.serviceType === ServiceType.ZIPLINE;
    const isLitterbox = store.serviceType === ServiceType.LITTERBOX;

    const serviceOptions = [
        { label: "Zipline", value: ServiceType.ZIPLINE },
        { label: "E-Z Host", value: ServiceType.EZHOST },
        { label: "Nest", value: ServiceType.NEST },
            { label: "Catbox.moe", value: ServiceType.CATBOX },
            { label: "0x0.st", value: ServiceType.ZEROX0 },
            { label: "Litterbox", value: ServiceType.LITTERBOX }
    ];

    return (
        <>
            <SettingsSection name="Service Type" description="The upload service to use">
                <Select
                    options={serviceOptions}
                    isSelected={v => v === store.serviceType}
                    select={v => {
                        store.serviceType = v;
                        update();
                    }}
                    serialize={v => v}
                    placeholder="Select a service"
                />
            </SettingsSection>

            {isZipline && (
                <SettingsSection name="Service URL" description="The URL of your Zipline instance">
                    <TextInput
                        value={store.serviceUrl}
                        onChange={v => store.serviceUrl = v}
                        placeholder="https://your-zipline-instance.com"
                    />
                </SettingsSection>
            )}

            {isZipline && (
                <SettingsSection name="Zipline Token" description="Your Zipline API authorization token">
                    <TextInput
                        value={store.ziplineToken}
                        onChange={v => store.ziplineToken = v}
                        placeholder="Your Zipline API token"
                    />
                </SettingsSection>
            )}

            {isEzHost && (
                <SettingsSection name="E-Z Host API Key" description="Your E-Z Host API key">
                    <TextInput
                        value={(store as { ezHostKey?: string }).ezHostKey || ""}
                        onChange={v => (store as { ezHostKey?: string }).ezHostKey = v}
                        placeholder="Your E-Z Host API key"
                    />
                </SettingsSection>
            )}

            {isNest && (
                <SettingsSection name="Nest Token" description="Your Nest API authorization token">
                    <TextInput
                        value={store.nestToken}
                        onChange={v => store.nestToken = v}
                        placeholder="Your Nest API token"
                    />
                </SettingsSection>
            )}

            {isZipline && (
                <SettingsSection name="Folder ID" description="Folder ID for uploads (leave empty for no folder)">
                    <TextInput
                        value={store.folderId}
                        onChange={v => store.folderId = v}
                        placeholder="Leave empty for no folder"
                    />
                </SettingsSection>
            )}

            {isLitterbox && (
                <SettingsSection name="Litterbox Expiry" description="How long uploads are retained">
                    <Select
                        options={[
                            { label: "1 hour", value: "1h" },
                            { label: "12 hours", value: "12h" },
                            { label: "24 hours", value: "24h" },
                            { label: "72 hours", value: "72h" }
                        ]}
                        isSelected={v => v === store.litterboxExpiry}
                        select={v => {
                            store.litterboxExpiry = v;
                            update();
                        }}
                        serialize={v => v}
                        placeholder="Select expiry"
                    />
                </SettingsSection>
            )}

            <SettingsSection tag="label" name="Strip Query Parameters" description="Strip query parameters from the uploaded file URL" inlineSetting>
                <Switch
                    checked={store.stripQueryParams}
                    onChange={v => store.stripQueryParams = v}
                />
            </SettingsSection>

            <SettingsSection tag="label" name="Convert APNG to GIF" description="Convert APNG files to GIF format" inlineSetting>
                <Switch
                    checked={store.apngToGif}
                    onChange={v => store.apngToGif = v}
                />
            </SettingsSection>

            <SettingsSection tag="label" name="Auto Copy URL" description="Automatically copy the uploaded file URL to clipboard" inlineSetting>
                <Switch
                    checked={store.autoCopy}
                    onChange={v => store.autoCopy = v}
                />
            </SettingsSection>
        </>
    );
}
