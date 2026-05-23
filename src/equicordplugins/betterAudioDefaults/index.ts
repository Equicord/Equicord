/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByProps } from "@webpack";

let unpatchVoiceConnect: (() => void) | undefined;
export default definePlugin({
  name: "BetterAudioDefaults",
  description:
    "Enables Studio Profile and QoS while disabling audio attenuation and VC-switching/mic silence warnings.",
  authors: [EquicordDevs.greyxp1],
  tags: ["Voice", "Utility"],

  start() {
    const mediaEngine = findByProps("setActiveInputProfile");
    if (mediaEngine) {
      mediaEngine.setActiveInputProfile("STUDIO");
      mediaEngine.setSilenceWarning(false);
      mediaEngine.setQoS(true);
      mediaEngine.setSidechainCompression(false);
      mediaEngine.setAttenuation(0, false, false);
    }

    const vcModule = findByProps("handleVoiceConnect");
    if (vcModule?.handleVoiceConnect) {
      const originalFn = vcModule.handleVoiceConnect;
      vcModule.handleVoiceConnect = Object.assign(
        (...args: unknown[]) =>
          originalFn.call(
            vcModule,
            {
              ...(args[0] as Record<string, unknown>),
              bypassChangeModal: true,
            },
            ...args.slice(1),
          ),
        originalFn,
      );

      unpatchVoiceConnect = () => {
        vcModule.handleVoiceConnect = originalFn;
      };
    }
  },

  stop() {
    unpatchVoiceConnect?.();
    unpatchVoiceConnect = undefined;
  },
});
