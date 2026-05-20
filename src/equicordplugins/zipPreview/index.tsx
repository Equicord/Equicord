/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";

import { cl, SafeZipPreviewInline } from "./components";
import managedStyle from "./style.css?managed";
import { clearZipPreviewCache, getAttachmentFileName, isZipFile, ZipPreviewAttachmentProps } from "./utils";

export default definePlugin({
    name: "ZipPreview",
    description: "Previews ZIP contents inside file attachments.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.justjxke],
    managedStyle,

    patches: [
        {
            find: "#{intl::IMG_ALT_ATTACHMENT_FILE_TYPE}",
            replacement: {
                match: /(?<=renderAdjacentContent:\i}=(\i);.{0,120}className:)(\i\.\i)(,children:\[)/,
                replace: "$self.fileClassName($2)$3$self.renderZipPreview($1),"
            }
        }
    ],

    stop() {
        clearZipPreviewCache();
    },

    renderZipPreview(props: ZipPreviewAttachmentProps) {
        if (!isZipFile(getAttachmentFileName(props))) return null;
        return <SafeZipPreviewInline {...props} />;
    },

    fileClassName(className: string) {
        return classes(className, cl("file"));
    }
});
