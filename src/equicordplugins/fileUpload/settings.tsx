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
    const isS3 = store.serviceType === ServiceType.S3;
    const isZipline = store.serviceType === ServiceType.ZIPLINE;
    const isLitterbox = store.serviceType === ServiceType.LITTERBOX;

    const serviceOptions = [
        { label: "Zipline", value: ServiceType.ZIPLINE },
        { label: "E-Z Host", value: ServiceType.EZHOST },
        { label: "Nest", value: ServiceType.NEST },
        { label: "S3-Compatible", value: ServiceType.S3 },
        { label: "Catbox.moe", value: ServiceType.CATBOX },
        ...(IS_DISCORD_DESKTOP ? [{ label: "0x0.st", value: ServiceType.ZEROX0 }] : []),
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

            {isS3 && (
                <SettingsSection name="S3 Endpoint URL" description="S3-compatible endpoint (e.g. https://<accountid>.r2.cloudflarestorage.com)">
                    <TextInput
                        value={(store as { s3Endpoint?: string; }).s3Endpoint || ""}
                        onChange={v => (store as { s3Endpoint?: string; }).s3Endpoint = v}
                        placeholder="https://your-endpoint.example.com"
                    />
                </SettingsSection>
            )}

            {isS3 && (
                <SettingsSection name="Bucket Name" description="Bucket to upload into">
                    <TextInput
                        value={(store as { s3Bucket?: string; }).s3Bucket || ""}
                        onChange={v => (store as { s3Bucket?: string; }).s3Bucket = v}
                        placeholder="my-bucket"
                    />
                </SettingsSection>
            )}

            {isS3 && (
                <SettingsSection name="Region" description="AWS region or auto for Cloudflare R2">
                    <TextInput
                        value={(store as { s3Region?: string; }).s3Region || "auto"}
                        onChange={v => (store as { s3Region?: string; }).s3Region = v}
                        placeholder="auto"
                    />
                </SettingsSection>
            )}

            {isS3 && (
                <SettingsSection name="Access Key ID" description="S3-compatible access key">
                    <TextInput
                        value={(store as { s3AccessKeyId?: string; }).s3AccessKeyId || ""}
                        onChange={v => (store as { s3AccessKeyId?: string; }).s3AccessKeyId = v}
                        placeholder="Your access key ID"
                    />
                </SettingsSection>
            )}

            {isS3 && (
                <SettingsSection name="Secret Access Key" description="S3-compatible secret key">
                    <TextInput
                        value={(store as { s3SecretAccessKey?: string; }).s3SecretAccessKey || ""}
                        onChange={v => (store as { s3SecretAccessKey?: string; }).s3SecretAccessKey = v}
                        placeholder="Your secret access key"
                    />
                </SettingsSection>
            )}

            {isS3 && (
                <SettingsSection name="Session Token" description="Optional temporary credential token">
                    <TextInput
                        value={(store as { s3SessionToken?: string; }).s3SessionToken || ""}
                        onChange={v => (store as { s3SessionToken?: string; }).s3SessionToken = v}
                        placeholder="Optional session token"
                    />
                </SettingsSection>
            )}

            {isS3 && (
                <SettingsSection name="Public Base URL" description="Optional public URL base to use for returned links">
                    <TextInput
                        value={(store as { s3PublicUrl?: string; }).s3PublicUrl || ""}
                        onChange={v => (store as { s3PublicUrl?: string; }).s3PublicUrl = v}
                        placeholder="https://cdn.example.com"
                    />
                </SettingsSection>
            )}

            {isS3 && (
                <SettingsSection name="Object Key Prefix" description="Optional folder/prefix inside the bucket">
                    <TextInput
                        value={(store as { s3Prefix?: string; }).s3Prefix || ""}
                        onChange={v => (store as { s3Prefix?: string; }).s3Prefix = v}
                        placeholder="uploads/discord"
                    />
                </SettingsSection>
            )}

            {isS3 && (
                <SettingsSection tag="label" name="Use Path-Style Endpoint" description="Use endpoint/bucket/key format (recommended for R2)" inlineSetting>
                    <Switch
                        checked={(store as { s3ForcePathStyle?: boolean; }).s3ForcePathStyle ?? true}
                        onChange={v => (store as { s3ForcePathStyle?: boolean; }).s3ForcePathStyle = v}
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
