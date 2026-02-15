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

import { SettingsComponent } from "./settings";
import { serviceLabels, ServiceType } from "./types";
import { getMediaUrl } from "./utils/getMediaUrl";
import { uploadFile } from "./utils/upload";

export const settings = definePluginSettings({
    serviceType: {
        type: OptionType.SELECT,
        description: "",
        options: [
            { label: "Zipline", value: ServiceType.ZIPLINE, default: true },
            { label: "E-Z Host", value: ServiceType.EZHOST },
            { label: "Nest", value: ServiceType.NEST },
            { label: "Catbox.moe", value: ServiceType.CATBOX },
            { label: "0x0.st", value: ServiceType.ZEROX0 },
            { label: "Litterbox", value: ServiceType.LITTERBOX }
        ],
        hidden: true
    },
    serviceUrl: {
        type: OptionType.STRING,
        description: "",
        default: "",
        hidden: true
    },
    ezHostKey: {
        type: OptionType.STRING,
        description: "E-Z Host API key",
        default: "",
        hidden: true
    },
    ziplineToken: {
        type: OptionType.STRING,
        description: "",
        default: "",
        hidden: true
    },
    nestToken: {
        type: OptionType.STRING,
        description: "",
        default: "",
        hidden: true
    },
    litterboxExpiry: {
        type: OptionType.SELECT,
        description: "",
        options: [
            { label: "1 hour", value: "1h" },
            { label: "12 hours", value: "12h" },
            { label: "24 hours", value: "24h", default: true },
            { label: "72 hours", value: "72h" }
        ],
        default: "24h",
        hidden: true
    },
    folderId: {
        type: OptionType.STRING,
        description: "",
        default: "",
        hidden: true
    },
    stripQueryParams: {
        type: OptionType.BOOLEAN,
        description: "",
        default: false,
        hidden: true
    },
    apngToGif: {
        type: OptionType.BOOLEAN,
        description: "",
        default: false,
        hidden: true
    },
    autoCopy: {
        type: OptionType.BOOLEAN,
        description: "",
        default: true,
        hidden: true
    },
    settingsComponent: {
        type: OptionType.COMPONENT,
        description: "Settings",
        component: SettingsComponent
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
    authors: [EquicordDevs.creations, EquicordDevs.keircn],
    settings,
    contextMenus: {
        "message": messageContextMenuPatch,
        "image-context": imageContextMenuPatch
    }
});
