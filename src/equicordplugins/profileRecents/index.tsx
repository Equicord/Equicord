/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import { patches } from "./core/patches";
import { runtime } from "./core/runtime";
import { settings } from "./settings";
import managedStyle from "./style.css?managed";

export default definePlugin({
    name: "ProfileRecents",
    description: "Allows more saved avatars in Avatar Recents and adds a Banner Recents section.",
    authors: [EquicordDevs.omaw],
    settings,
    managedStyle,
    patches,
    start: runtime.start.bind(runtime),
    setModalKind: runtime.setModalKind.bind(runtime),
    beginModalSession: runtime.beginModalSession.bind(runtime),
    hasSlots: runtime.hasSlots.bind(runtime),
    shouldRenderRecents: runtime.shouldRenderRecents.bind(runtime),
    getRecentTitle: runtime.getRecentTitle.bind(runtime),
    getRecentDescription: runtime.getRecentDescription.bind(runtime),
    getRecentRootClass: runtime.getRecentRootClass.bind(runtime),
    getRecentListStyle: runtime.getRecentListStyle.bind(runtime),
    getRecentItemStyle: runtime.getRecentItemStyle.bind(runtime),
    getRecentRowStyle: runtime.getRecentRowStyle.bind(runtime),
    getRecentButtonClass: runtime.getRecentButtonClass.bind(runtime),
    getRecentButtonStyle: runtime.getRecentButtonStyle.bind(runtime),
    getRecentMediaClass: runtime.getRecentMediaClass.bind(runtime),
    getRecentMediaStyle: runtime.getRecentMediaStyle.bind(runtime),
    getRecentMediaSrc: runtime.getRecentMediaSrc.bind(runtime),
    mergeRecentData: runtime.mergeRecentData.bind(runtime),
    wrapRecentDelete: runtime.wrapRecentDelete.bind(runtime),
    onRecentSelect: runtime.onRecentSelect.bind(runtime),
    handleRecentComplete: runtime.handleRecentComplete.bind(runtime),
    captureSlot: runtime.captureSlot.bind(runtime),

    renderTrashIcon() {
        return (
            <svg
                className="deleteIcon__1df30"
                aria-hidden="true"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
            >
                <path
                    fill="currentColor"
                    d="M14.25 1c.41 0 .75.34.75.75V3h5.25c.41 0 .75.34.75.75v.5c0 .41-.34.75-.75.75H3.75A.75.75 0 0 1 3 4.25v-.5c0-.41.34-.75.75-.75H9V1.75c0-.41.34-.75.75-.75h4.5Z"
                />
                <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M5.06 7a1 1 0 0 0-1 1.06l.76 12.13a3 3 0 0 0 3 2.81h8.36a3 3 0 0 0 3-2.81l.75-12.13a1 1 0 0 0-1-1.06H5.07ZM11 12a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Zm3-1a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"
                    clipRule="evenodd"
                />
            </svg>
        );
    }
});
