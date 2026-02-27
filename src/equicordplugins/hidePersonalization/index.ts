/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/index";
import definePlugin, { OptionType } from "@utils/types";

export const settings = definePluginSettings({
  avatarDecoration: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Hide avatar decorations.",
    restartNeeded: true,
  },
  nameplate: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Hide nameplates.",
    restartNeeded: true,
  },
  profileEffect: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Hide profile animation effects on open.",
    restartNeeded: true,
  },
  clanTag: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Hide clan tags.",
    restartNeeded: true,
  },
});

export default definePlugin({
  name: "HidePersonalization",
  description: "Hides personalization features.",
  authors: [EquicordDevs.Leon135],
  settings,

  patches: [
    {
      // Avatar decoration
      find: "getAvatarDecorationURL:w",
      replacement: {
        match: /function w\(e\)\{let\{avatarDecoration:(\w+),/,
        replace: "function w(e){return null;let{avatarDecoration:$1,"
      },
      predicate: () => settings.store.avatarDecoration,
    },
    {
      // Nameplate
      find: "WK:()=>l",
      replacement: {
        match: /function l\(e\)\{return null==e\?null:\{skuId/,
        replace: "function l(e){return null;return{skuId"
      },
      predicate: () => settings.store.nameplate,
    },
    {
      // Profile banner animation effect
      find: "profileEffectConfig:_,layerData:S",
      replacement: {
        match: /,T=e=>\{let t=\(0,\w+\.\w+\)\(\)/,
        replace: ",T=e=>{return null;let t=(0,d.j)()"
      },
      predicate: () => settings.store.profileEffect,
    },
    {
      // Clan tag
      find: "handleSetTypingRef:eD",
      replacement: [
        {
          match: /!\w+&&\(0,\w+\.jsx\)\(\w+\.Ay,\{primaryGuild:\w+\?\.primaryGuild/,
          replace: "false&&(0,r.jsx)(S.Ay,{primaryGuild:o?.primaryGuild",
          predicate: () => settings.store.clanTag
        }
      ]
    }

  ]

});
