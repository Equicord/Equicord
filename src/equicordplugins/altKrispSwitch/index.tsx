/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "AltKrispSwitch",
    description: t("altKrispSwitch.description"),
    authors: [Devs.newwares],
    patches: [
        {
            find: ",setNoiseCancellation(",
            replacement: {
                match: /(}\),)(.{1,2}\.\i\.dispatch\({type:"AUDIO_SET_NOISE_SUPPRESSION",)/,
                replace: "$1!$self.shouldCancelSuppression(arguments)&&$2"
            }
        }
    ],
    shouldCancelSuppression([enableKrisp, options]) {
        if (options?.section === "Noise Cancellation Popout") {
            if (enableKrisp) {
                return false;
            } else {
                return true;
            }
        }
    }
});
