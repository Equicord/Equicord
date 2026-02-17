/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import { ProfileRecentsRuntime } from "./components/recentsManager";
import managedStyle from "./style.css?managed";

const settings = definePluginSettings({
    avatarSlots: {
        type: OptionType.SLIDER,
        description: "How many avatar slots to keep.",
        default: 12,
        markers: [6, 12, 24, 36, 48, 60],
        minValue: 6,
        maxValue: 60,
        stickToMarkers: true
    },
    bannerSlots: {
        type: OptionType.SLIDER,
        description: "How many banner slots to keep.",
        default: 12,
        markers: [6, 12, 24, 36, 48, 60],
        minValue: 6,
        maxValue: 60,
        stickToMarkers: true
    }
});

const runtime = new ProfileRecentsRuntime(() => settings.store);

export default definePlugin({
    name: "ProfileRecents",
    description: "Allows more saved avatars in Avatar Recents and adds a Banner Recents section.",
    authors: [EquicordDevs.omaw],
    settings,
    managedStyle,
    patches: [
        {
            find: "UPLOAD_FILE_OR_CHOOSE_GIF_MODAL,location_stack:",
            replacement: [
                {
                    match: /,(\i)=(\i)&&(\i)===(\i\.\i)\.AVATAR;/,
                    replace: ",$1=$2&&($3===$4.AVATAR||($3===$4.BANNER&&$self.hasSlots(!0)));$self.setModalKind($3===$4.BANNER);"
                },
                {
                    match: /uploadType:(\i),guild:(\i),handleOpenImageEditingModal:(\i),maxFileSizeBytes:(\i),filters:(\i),handleFileSizeError:(\i)/,
                    replace: "uploadType:$1,guild:$2,handleOpenImageEditingModal:($self.setBannerEditor($3),$3),maxFileSizeBytes:$4,filters:$5,handleFileSizeError:$6"
                },
                {
                    match: /onComplete:(\i)(?=\}\),\i&&\(0,\i\.jsx\)\(\i\.\i,\{uploadType:\i)/,
                    replace: "onComplete:$self.handleRecentComplete($1),isBanner:$self.isBannerMode()"
                }
            ]
        },
        {
            find: "recentAvatarsLimit:6",
            replacement: [
                {
                    match: /\{avatars:(\i),loading:(\i),error:(\i)\}=\(0,(\i)\.(\i)\)\(\)/,
                    replace: "{avatars:$1,loading:$2,error:$3}=$self.mergeRecentData((0,$4.$5)())"
                },
                {
                    match: /label:\i\.intl\.\i\(\i\.\i\.\i\)/,
                    replace: "label:$self.getRecentTitle()"
                },
                {
                    match: /description:\i\.intl\.\i\([^)]*recentAvatarsLimit:6\}\)/,
                    replace: "description:$self.getRecentDescription()"
                },
                {
                    match: /className:(\i)\(\)\((\i\.\i),(\i)\)(?=,children:\(0,\i\.jsx\)\(\i\.\i,\{label:)/,
                    replace: "className:$1()($2,$3,$self.getRecentRootClass())"
                },
                {
                    match: /onSelectRecentAvatar:(\i),onDeleteRecentAvatar:(\i),avatarButtonRef:(\i)=>\{(\i)\.current\[(\i)\]=\i\}/,
                    replace: "onSelectRecentAvatar:$1,onDeleteRecentAvatar:$self.wrapRecentDelete($2),avatarButtonRef:$3=>{$4.current[$5]=$3}"
                },
                {
                    match: /onClick:\(\)=>(\i)\((\i)\),onMouseEnter:(\i),onMouseLeave:(\i)/,
                    replace: "onClick:()=>$self.onRecentSelect($1,$2),onMouseEnter:$3,onMouseLeave:$4"
                },
                {
                    match: /text:(\i\.intl\.\i\(\i\.\i\.\i\)),anchorRef:(\i)/,
                    replace: "text:\"Remove\",anchorRef:$2"
                },
                {
                    match: /className:(\i\.\i),children:\(0,\i\.jsx\)\((\i\.\i),\{size:"xs",color:"currentColor",className:(\i\.\i)\}\)/,
                    replace: "className:$1,children:$self.renderTrashIcon()"
                },
                {
                    match: /onMouseLeave:(\i),className:(\i\.\i),"aria-label":(\i),innerRef:(\i),children:\(0,\i\.jsx\)\("img",\{src:(\i),alt:(\i),className:(\i\.\i)\}\)/,
                    replace: "onMouseLeave:$1,className:$2,style:$self.getRecentButtonStyle(arguments[0]?.avatar),\"aria-label\":$3,innerRef:$4,children:(0,a.jsx)(\"img\",{src:$self.getRecentMediaSrc(arguments[0]?.avatar,$5),alt:$6,className:$7,style:$self.getRecentMediaStyle(arguments[0]?.avatar)})"
                },
                {
                    match: /,(\i)>0&&/,
                    replace: ",!1&&"
                }
            ]
        }
    ],
    start: runtime.start.bind(runtime),
    stop: runtime.stop.bind(runtime),
    setModalKind: runtime.setModalKind.bind(runtime),
    isBannerMode: runtime.isBannerMode.bind(runtime),
    setBannerEditor: runtime.setBannerEditor.bind(runtime),
    hasSlots: runtime.hasSlots.bind(runtime),
    getRecentTitle: runtime.getRecentTitle.bind(runtime),
    getRecentDescription: runtime.getRecentDescription.bind(runtime),
    getRecentRootClass: runtime.getRecentRootClass.bind(runtime),
    getRecentButtonStyle: runtime.getRecentButtonStyle.bind(runtime),
    getRecentMediaStyle: runtime.getRecentMediaStyle.bind(runtime),
    getRecentMediaSrc: runtime.getRecentMediaSrc.bind(runtime),
    mergeRecentData: runtime.mergeRecentData.bind(runtime),
    wrapRecentDelete: runtime.wrapRecentDelete.bind(runtime),
    onRecentSelect: runtime.onRecentSelect.bind(runtime),
    handleRecentComplete: runtime.handleRecentComplete.bind(runtime),

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
