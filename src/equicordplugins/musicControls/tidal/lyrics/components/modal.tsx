/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Text } from "@components/Text";
import { TidalStore, Track } from "@equicordplugins/musicControls/tidal/TidalStore";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal,React } from "@webpack/common";

import { cl, NoteSvg, scrollClasses, useLyrics } from "./util";

const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

function getTitleNode(track: Track | null) {
    if (!track) return null;
    return (
        <div className={cl("header-content")}>
            {track?.imageSrc && (
                <img
                    src={track.imageSrc}
                    alt={track.album || track.name}
                    className={cl("album-image")}
                />
            )}
            <div>
                <Text size="sm" weight="semibold">{track.name}</Text>
                <Text size="sm">by {track.artist}</Text>
                {track.album && <Text size="sm">on {track.album}</Text>}
            </div>
        </div>
    );
}

export function LyricsModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const { track, lyrics, currLrcIndex } = useLyrics({ scroll: false });
    const currentLyrics = lyrics || null;

    return (
        <Modal {...rootProps} size="md" title={getTitleNode(track)}>
            <div className={cl("lyrics-modal-container") + ` ${scrollClasses.auto}`}>
                {currentLyrics ? (
                    currentLyrics.map((line, i) => (
                        <Text
                            key={i}
                            size={currLrcIndex === i ? "md" : "sm"}
                            weight={currLrcIndex === i ? "semibold" : "normal"}
                            className={currLrcIndex === i ? cl("modal-line-current") : cl("modal-line")}
                        >
                            <span className={cl("modal-timestamp")}
                                onClick={() => TidalStore.seek(line.time * 1000)}
                            >
                                {formatTime(line.time)}
                            </span>
                            {line.text || NoteSvg(cl("modal-note"))}
                        </Text>
                    ))
                ) : (
                    <Text size="sm" className={cl("modal-no-lyrics")}>No lyrics available :(</Text>
                )}
            </div>
        </Modal>
    );
}
