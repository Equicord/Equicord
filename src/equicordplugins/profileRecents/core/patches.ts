/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const patches = [
    {
        find: "UPLOAD_FILE_OR_CHOOSE_GIF_MODAL,location_stack:X",
        replacement: [
            {
                match: /let (\i)=(\i)&&(\i),(\i)=(\i)&&(\i)===S\.HL\.AVATAR;/,
                replace: "let $1=$2&&$3;$self.setModalKind($6===S.HL.BANNER);let $4=$5&&($6===S.HL.AVATAR||($6===S.HL.BANNER&&$self.hasSlots(!0)));"
            },
            {
                match: /let\{assetOrigin:(\i)=\i\.\i\.\i,imageUri:(\i),file:(\i),originalAsset:(\i),isFromTenor:(\i)=!1\}=(\i);(\i)\(\),(\i)\(/,
                replace: "let{assetOrigin:$1=m.E.NEW_ASSET,imageUri:$2,file:$3,originalAsset:$4,isFromTenor:$5=!1}=$6;$self.captureSlot($2,$3,$1,$4),$7(),$8("
            },
            {
                match: /onComplete:(\i)(?=\}\),Q&&\(0,\i\.jsx\)\(\i\.\i,\{uploadType:(\i))/,
                replace: "onComplete:$self.handleRecentComplete($1,Z),isBanner:$2===S.HL.BANNER"
            },
            {
                match: /N\.default\.track\(v\.HAw\.OPEN_MODAL,\{(?=[\s\S]{0,120}upload_type:(\i)\})/,
                replace: "$self.beginModalSession($1===S.HL.BANNER),$&"
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
                match: /text:\i\.intl\.\i\(\i\.\i\.\i\),anchorRef:(\i)/,
                replace: "text:\"Remove\",anchorRef:$1"
            },
            {
                match: /className:x\.G5,children:\(0,a\.jsx\)\(o\.ucK,\{size:"xs",color:"currentColor",className:x\.fy\}\)/,
                replace: "className:x.G5,children:$self.renderTrashIcon()"
            },
            {
                match: /className:(\i\.\i),"aria-label":(\i)/,
                replace: "className:$1,style:$self.getRecentButtonStyle(),\"aria-label\":$2"
            },
            {
                match: /src:(\i),alt:(\i),className:(\i\.\i)/,
                replace: "src:$self.getRecentMediaSrc(t,$1),alt:$2,className:$3,style:$self.getRecentMediaStyle()"
            },
            {
                match: /,(\i)>0&&/,
                replace: ",!1&&"
            }
        ]
    }
];
