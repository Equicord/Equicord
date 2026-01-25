/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Menu } from "@webpack/common";

import { serviceLabels, ServiceType } from "./types";
import { getMediaUrl } from "./utils/getMediaUrl";
import { uploadFile } from "./utils/upload";

export const settings = definePluginSettings({
    serviceType: {
        type: OptionType.SELECT,
        description: "The upload service to use",
        options: [
            { label: "Zipline", value: ServiceType.ZIPLINE, default: true },
            { label: "Nest", value: ServiceType.NEST }
        ]
    },
    serviceUrl: {
        type: OptionType.STRING,
        description: "The URL of your upload service (Zipline only, e.g., https://your-zipline-instance.com)",
        default: ""
    },
    authToken: {
        type: OptionType.STRING,
        description: "Your API authorization token",
        default: ""
    },
    folderId: {
        type: OptionType.STRING,
        description: "Folder ID for uploads (leave empty for no folder)",
        default: ""
    },
    stripQueryParams: {
        type: OptionType.BOOLEAN,
        description: "Strip query parameters from the uploaded file URL",
        default: false
    },
    apngToGif: {
        type: OptionType.BOOLEAN,
        description: "Use .gif extension for APNG files",
        default: false
    },
    autoCopy: {
        type: OptionType.BOOLEAN,
        description: "Automatically copy the uploaded file URL to clipboard",
        default: true
    }
});

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props) return;

    const { itemSrc, itemHref, target } = props;
    const url = getMediaUrl({ src: itemSrc, href: itemHref, target });

    if (!url) return;

    const group = findGroupChildrenByChildId("open-native-link", children)
        ?? findGroupChildrenByChildId("copy-link", children);

    if (group && !group.some(child => child?.props?.id === "file-upload")) {
        const serviceType = settings.store.serviceType as ServiceType;
        const serviceName = serviceLabels[serviceType];

        group.push(
            <Menu.MenuItem
                label={`Upload to ${serviceName}`}
                key="file-upload"
                id="file-upload"
                action={() => uploadFile(url)}
            />
        );
    }
};

const imageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props) return;

    if ("href" in props && !props.src) return;

    const url = getMediaUrl(props);
    if (!url) return;

    if (children.some(child => child?.props?.id === "file-upload-group")) return;

    const serviceType = settings.store.serviceType as ServiceType;
    const serviceName = serviceLabels[serviceType];

    children.push(
        <Menu.MenuGroup id="file-upload-group">
            <Menu.MenuItem
                label={`Upload to ${serviceName}`}
                key="file-upload"
                id="file-upload"
                action={() => uploadFile(url)}
            />
        </Menu.MenuGroup>
    );
};

export default definePlugin({
    name: "FileUpload",
    description: "Upload images and videos to file hosting services like Zipline and Nest",
    authors: [EquicordDevs.creations],
    settings,
    contextMenus: {
        "message": messageContextMenuPatch,
        "image-context": imageContextMenuPatch
    }
});
