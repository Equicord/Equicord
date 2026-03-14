/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { OpenExternalIcon } from "@components/Icons";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Menu, PermissionsBits, PermissionStore } from "@webpack/common";

import { settings } from "./settings";
import { serviceLabels, ServiceType } from "./types";
import { getMediaUrl } from "./utils/getMediaUrl";
import { uploadFile, uploadPickedFile } from "./utils/upload";

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

const ExternalIcon = () => <OpenExternalIcon height={24} width={24} />;

const channelAttachMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const channel = props?.channel;
    if (!channel) return;
    if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;
    if (children.some(child => child?.props?.id === "file-upload-manual")) return;

    children.splice(1, 0,
        <Menu.MenuItem
            id="file-upload-manual"
            key="file-upload-manual"
            label="Upload to Host"
            iconLeft={ExternalIcon}
            leadingAccessory={{
                type: "icon",
                icon: ExternalIcon
            }}
            action={() => uploadPickedFile()}
        />
    );
};

export default definePlugin({
    name: "FileUpload",
    description: "Upload images and videos to file hosting services like Zipline and Nest",
    authors: [EquicordDevs.creations, EquicordDevs.keircn, Devs.ScattrdBlade],
    settings,
    contextMenus: {
        "message": messageContextMenuPatch,
        "image-context": imageContextMenuPatch,
        "channel-attach": channelAttachMenuPatch
    }
});
