/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { React, useEffect, useState } from "@webpack/common";

import { settings } from "../settings";
import { CONTAINER_ID, VIDEO_ID } from "../utils/constants";
import { getVideoSource } from "../utils/video";

const logger = new Logger("VideoThemeEngine");

export function VideoLayer() {
    const { localVideoPath, videoReloadToken } = settings.use(["localVideoPath", "videoReloadToken"]);
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void getVideoSource().then(source => {
            if (!cancelled) setSrc(source);
        });
        return () => { cancelled = true; };
    }, [localVideoPath, videoReloadToken]);

    if (!src) return null;

    return (
        <div id={CONTAINER_ID} className="vc-videothemeengine-container">
            <video
                id={VIDEO_ID}
                className="vc-videothemeengine-video"
                src={src}
                muted
                loop
                autoPlay
                playsInline
                preload="auto"
                onLoadedData={e => {
                    void (e.currentTarget as HTMLVideoElement).play()
                        .catch(err => logger.warn("Video autoplay failed.", err));
                }}
            />
        </div>
    );
}
