/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import ErrorBoundary from "@components/ErrorBoundary";
import { CloudUploadIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { Menu } from "@webpack/common";

import { abortActiveClipUploads, type ClipMetadata } from "./upload";
import { openUploadClipFileModal } from "./UploadClipFileModal";

const ActionBarIcon = findComponentByCodeLazy("Children.map", "isValidElement", "dangerous:");

interface ClipUploadActionProps {
    channelId: string;
    clip?: ClipMetadata | null;
}

const ctxMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props.channel) return;

    children.push(
        <Menu.MenuItem
            id="vc-upload-clip-file"
            iconLeft={CloudUploadIcon}
            label="Upload Clip File"
            action={() => openUploadClipFileModal(props.channel.id)}
        />
    );
};

export default definePlugin({
    name: "ClipUpload",
    description: "Adds a button to upload a local video file as a Discord clip.",
    authors: [EquicordDevs.qdnx, EquicordDevs.BachLe2000],
    tags: ["Media", "Utility"],

    patches: [
        {
            find: '"ChannelAttachmentUpload"',
            replacement: {
                match: /(,\{children:\[)(?=.{0,80}#{intl::CLIPS_ATTACHMENT_UTILITIES_SPOILER})/,
                replace: "$&$self.UploadClipFileButton(arguments[0]),"
            }
        }
    ],

    contextMenus: {
        "channel-attach": ctxMenuPatch
    },

    stop: abortActiveClipUploads,

    UploadClipFileButton: ErrorBoundary.wrap(({ channelId, clip }: ClipUploadActionProps) => {
        if (!clip) return null;

        return (
            <ActionBarIcon
                tooltip="Upload clip file"
                onClick={() => openUploadClipFileModal(channelId, clip)}
            >
                <CloudUploadIcon width={20} height={20} />
            </ActionBarIcon>
        );
    }, { noop: true })
});
