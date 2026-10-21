/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { SpotifyStore, Track } from "@equicordplugins/musicControls/spotify/SpotifyStore";
import { openImageModal } from "@utils/discord";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal,React } from "@webpack/common";

import { cl, NoteSvg, scrollClasses, useLyrics } from "./util";

const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

function getTitleNode(track: Track | null) {
    if (!track) {
        return <BaseText size="sm" weight="semibold">No track playing</BaseText>;
    }
    return (
        <div className={cl("header-content")}>
            {track?.album?.image?.url && (
                <img
                    src={track.album.image.url}
                    alt={track.album.name}
                    className={cl("album-image")}
                    onClick={() => openImageModal({
                        url: track.album.image.url,
                        width: track.album.image.width,
                        height: track.album.image.height,
                    })}
                />
            )}
            <div>
                <BaseText size="sm" weight="semibold">{track.name}</BaseText>
                <BaseText size="sm">by {track.artists.map(a => a.name).join(", ")}</BaseText>
                <BaseText size="sm">on {track.album.name}</BaseText>
            </div>
        </div>
    );
}

const modalCurrentLine = cl("modal-line-current");
const modalLine = cl("modal-line");

export function LyricsModal({ props }: { props: RenderModalProps; }) {
    const { track, lyricsInfo, currLrcIndex } = useLyrics({ scroll: false });
    const currentLyrics = lyricsInfo?.lyricsVersions[lyricsInfo.useLyric];

    return (
        <Modal {...props} size="md" title={getTitleNode(track)}>
            <div className={`${cl("lyrics-modal-container")} ${scrollClasses.auto}`}>
                {currentLyrics ? (
                    currentLyrics.map((line, i) => (
                        <BaseText
                            key={i}
                            size={currLrcIndex === i ? "md" : "sm"}
                            weight={currLrcIndex === i ? "semibold" : "normal"}
                            className={currLrcIndex === i ? modalCurrentLine : modalLine}
                        >
                            <span className={cl("modal-timestamp")} onClick={() => SpotifyStore.seek(line.time * 1000)}>
                                {formatTime(line.time)}
                            </span>
                            {line.text || NoteSvg()}
                        </BaseText>
                    ))
                ) : (
                    <BaseText size="sm" className={cl("modal-no-lyrics")}>
                        No lyrics available :(
                    </BaseText>
                )}
            </div>
        </Modal>
    );
}
