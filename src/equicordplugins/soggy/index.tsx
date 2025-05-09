/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { ModalProps, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { React } from "@webpack/common";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '.iconBadge,"top"');

function SoggyModal(props: ModalProps) {

    if (settings.store.songVolume !== 0) {
        React.useEffect(() => {
            const song = new Audio(settings.store.songLink);
            song.volume = settings.store.songVolume;
            song.play();

            return () => {
                song.pause();
                song.remove();
            };
        }, []);
    }

    const boop = (e: React.MouseEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const { offsetX, offsetY } = e.nativeEvent;

        const region = { x: 155, y: 220, width: 70, height: 70 };

        if (
            settings.store.boopVolume !== 0 &&
            offsetX >= region.x &&
            offsetX <= region.x + region.width &&
            offsetY >= region.y &&
            offsetY <= region.y + region.height
        ) {
            const boopSound = new Audio(settings.store.boopLink);
            boopSound.volume = settings.store.boopVolume;
            boopSound.play();
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
        default: 0.75,
        markers: [0, 0.25, 0.5, 0.75, 1],
        stickToMarkers: false,

    },
    boopVolume: {
        description: "Volume of the boop sound",
        type: OptionType.SLIDER,
        default: 0.3,
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
        default: "https://soggy.cat/img/soggycat.webp",
    },
    songLink: {
        description: "URL for the song to play",
        type: OptionType.STRING,
        default: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3",
    },
    boopLink: {
        description: "URL for the boop sound",
        type: OptionType.STRING,
        default: "https://github.com/Capeling/soggy-mod/raw/refs/heads/main/resources/honk.wav",
    }

        
});

export default definePlugin({
    name: "Soggy",
    description: "Adds a soggy button to the toolbox",
    authors: [EquicordDevs.sliwka],
    settings,

    patches: [
        {
            find: "toolbar:function",
            replacement: {
                match: /(function \i\(\i\){)(.{1,200}toolbar.{1,450}mobileToolbar)/,
                replace: "$1$self.addIconToToolBar(arguments[0]);$2"
            }
        }
    ],

    // taken from message logger lol
    addIconToToolBar(e: { toolbar: React.ReactNode[] | React.ReactNode; }) {
        if (Array.isArray(e.toolbar))
            return e.toolbar.push(
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
