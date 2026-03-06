/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import doomZipBase64 from "file://./assets/DOOM-@evilution.zip?base64";
import jsDosApiSource from "file://./assets/js-dos-api.js";
import jsDosV3Base64 from "file://./assets/js-dos-v3.js?base64";

const sanitizedJsDosApiSource = jsDosApiSource.replace(
    'oncontextmenu="event.preventDefault()"',
    ""
);

export { doomZipBase64, jsDosV3Base64, sanitizedJsDosApiSource as jsDosApiSource };
