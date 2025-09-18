/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AudioPlayerInterface, createAudioPlayer } from "@api/AudioPlayer";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { ModalProps, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { React } from "@webpack/common";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '.iconBadge,"top"');
let boopSound: AudioPlayerInterface;
let song: AudioPlayerInterface;

function SoggyModal(props: ModalProps) {
    if (settings.store.songVolume !== 0) {
        React.useEffect(() => {
            song?.loop();

            return () => {
                song?.stop();
            };
        }, []);
    }

    const boop = (e: React.MouseEvent<HTMLImageElement>) => {
        const { offsetX, offsetY } = e.nativeEvent;

        const region = { x: 155, y: 220, width: 70, height: 70 };

        if (
            settings.store.boopVolume !== 0 &&
            offsetX >= region.x &&
            offsetX <= region.x + region.width &&
            offsetY >= region.y &&
            offsetY <= region.y + region.height
        ) {
            boopSound?.play();
        }
    };

    return (
        <ModalRoot {...props}>
            <img
                src={settings.store.imageLink}
                onClick={boop}
                style={{ display: "block" }}

            />
        </ModalRoot >
    );
}

function buildSoggyModal(): any {
    openModal(props => <SoggyModal {...props} />);
}

function SoggyButton() {
    return (
        <HeaderBarIcon
            className="soggy-button"
            tooltip={settings.store.tooltipText}
            icon={() => (
                <img
                    alt=""
                    src={settings.store.imageLink}
                    width={24}
                    height={24}
                    draggable={false}
                    style={{ pointerEvents: "none" }}
                />
            )}
            onClick={() => buildSoggyModal()}
            selected={false}
        />
    );
}

const settings = definePluginSettings({
    songVolume: {
        description: "Volume of the song. 0 to disable",
        type: OptionType.SLIDER,
        default: 0.25,
        markers: [0, 0.25, 0.5, 0.75, 1],
        stickToMarkers: false,

    },
    boopVolume: {
        description: "Volume of the boop sound",
        type: OptionType.SLIDER,
        default: 0.2,
        markers: [0, 0.25, 0.5, 0.75, 1],
        stickToMarkers: false,
    },
    tooltipText: {
        description: "The text shown when hovering over the button",
        type: OptionType.STRING,
        default: "the soggy",
    },
    imageLink: {
        description: "URL for the image (button and modal)",
        type: OptionType.STRING,
        default: "https://cdn.nest.rip/uploads/a0df62f0-39ee-4d2d-86a9-033ede2156f0.webp",
    },
    songLink: {
        description: "URL for the song to play",
        type: OptionType.STRING,
        default: "https://github.com/Equicord/Equibored/raw/main/sounds/soggy/song.mp3?raw=true",
        onChange(newValue) {
            song?.stop();
            song = createAudioPlayer(newValue, { volume: settings.store.songVolume * 100, persistent: true });
            song.load();
        },
    },
    boopLink: {
        description: "URL for the boop sound",
        type: OptionType.STRING,
        default: "https://github.com/Equicord/Equibored/raw/main/sounds/soggy/honk.wav?raw=true",
        onChange(newValue) {
            boopSound?.stop();
            boopSound = createAudioPlayer(newValue, { volume: settings.store.boopVolume * 100, persistent: true });
            boopSound.load();
        }
    }
});

export default definePlugin({
    name: "Soggy",
    description: "Adds a soggy button to the toolbox",
    authors: [EquicordDevs.sliwka],
    settings,
    dependencies: ["AudioPlayerAPI"],
    patches: [
        {
            find: ".controlButtonWrapper,",
            replacement: {
                match: /(function \i\(\i\){)(.{1,200}toolbar.{1,450}mobileToolbar)/,
                replace: "$1$self.addIconToToolBar(arguments[0]);$2"
            }
        }
    ],

    start() {
        boopSound = createAudioPlayer(settings.store.boopLink, { volume: settings.store.boopVolume * 100, persistent: true });
        song = createAudioPlayer(settings.store.songLink, { volume: settings.store.songVolume * 100, persistent: true });
    },

    stop() {
        boopSound?.delete();
        song?.delete();
    },

    // taken from message logger lol
    addIconToToolBar(e: { toolbar: React.ReactNode[] | React.ReactNode; }) {
        if (Array.isArray(e.toolbar))
            return e.toolbar.unshift(
                <ErrorBoundary noop={true}>
                    <SoggyButton />
                </ErrorBoundary>
            );

        e.toolbar = [
            <ErrorBoundary noop={true} key={"MessageLoggerEnhanced"} >
                <SoggyButton />
            </ErrorBoundary>,
            e.toolbar,
        ];
    },
});
