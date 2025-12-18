/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Logger } from "@utils/Logger";
import { OptionType } from "@utils/types";
import { findByCodeLazy, findByPropsLazy } from "@webpack";
import { MediaEngineStore, React, SearchableSelect, Text, useEffect, useState } from "@webpack/common";

interface PickerProps {
    streamMediaSelection: any[];
    streamMedia: any[];
}

const getDesktopSources = findByCodeLazy("desktop sources");
const configModule = findByPropsLazy("getOutputVolume");
const log = new Logger("InstantScreenShare");

export const settings = definePluginSettings({
    streamMedia: {
        type: OptionType.COMPONENT,
        component: SettingSection,
    },
    includeVideoDevices: {
        type: OptionType.BOOLEAN,
        description: "Include video input devices (cameras, capture cards) in the source list",
        default: false,
    },
    autoMute: {
        type: OptionType.BOOLEAN,
        description: "Automatically mute your microphone when joining a voice channel",
        default: false,
    },
    autoDeafen: {
        type: OptionType.BOOLEAN,
        description: "Automatically deafen when joining a voice channel (also mutes you)",
        default: false,
    },
    keybindInfo: {
        description: "",
        type: OptionType.COMPONENT,
        component: KeybindDescription,
        default: {},
    },
    keybind: {
        description: "Keybind to toggle screenshare (set via recorder below)",
        type: OptionType.STRING,
        default: "CTRL+SHIFT+S",
        hidden: true,
    },
    keybindRecorder: {
        description: "Click then press a key combination for screenshare toggle (works independently of auto-join)",
        type: OptionType.COMPONENT,
        component: KeybindRecorder,
        default: {},
    },
    autoOnJoin: {
        type: OptionType.BOOLEAN,
        description: "Automatically screenshare when joining a voice channel",
        default: true,
    },
    toolboxManagement: {
        type: OptionType.BOOLEAN,
        description: "Enable/Disable Instant Screenshare",
        default: true,
        hidden: true,
    }
});

export async function getCurrentMedia() {
    const media = MediaEngineStore.getMediaEngine();
    const sources = await getDesktopSources(media, ["screen", "window"], null) ?? [];

    if (settings.store.includeVideoDevices) {
        try {
            const videoDevices = Object.values(configModule.getVideoDevices() || {});
            const videoSources = videoDevices.map((device: any) => ({
                id: device.id,
                name: device.name,
                type: "video_device"
            }));
            sources.push(...videoSources);
        } catch (e) {
            new log.warn("Failed to get video devices:", e);
        }
    }

    const streamMedia = sources.find(screen => screen.id === settings.store.streamMedia);
    if (streamMedia) return streamMedia;

    log.error(`Stream Media "${settings.store.streamMedia}" not found. Resetting to default.`);

    settings.store.streamMedia = sources[0];
    return sources[0];
}

function StreamSimplePicker({ streamMediaSelection, streamMedia }: PickerProps) {
    const options = streamMediaSelection.map(screen => ({
        label: screen.name,
        value: screen.id,
        default: streamMediaSelection[0],
    }));

    return (
        <SearchableSelect
            placeholder="Select a media source to stream "
            maxVisibleItems={5}
            options={options}
            value={options.find(o => o.value === streamMedia)}
            onChange={v => settings.store.streamMedia = v}
            closeOnSelect
        />
    );
}

function normalizeKeybind(kb: string) {
    return kb.toUpperCase().split("+").map(p => p.trim()).filter(Boolean).join("+");
}

function buildKeybindFromEvent(e: KeyboardEvent) {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("CTRL");
    if (e.shiftKey) parts.push("SHIFT");
    if (e.altKey) parts.push("ALT");
    if (e.metaKey) parts.push("META");

    let main = e.key?.toUpperCase?.() ?? "";
    if (["SHIFT", "CONTROL", "CONTROLLEFT", "CONTROLRIGHT", "ALT", "META"].includes(main)) main = "";
    if (main === " ") main = "SPACE";
    if (main === "ESCAPE") main = "ESC";
    if (e.code?.startsWith("Key")) main = e.code.replace("Key", "");
    if (main) parts.push(main);

    return parts.join("+");
}

export function matchesKeybind(e: KeyboardEvent, kb: string) {
    const eventBind = normalizeKeybind(buildKeybindFromEvent(e));
    const target = normalizeKeybind(kb);
    return !!target && eventBind === target;
}

function KeybindRecorder() {
    const [listening, setListening] = useState(false);
    const { keybind } = settings.use(["keybind"]);
    const [displayBind, setDisplayBind] = useState(keybind);

    useEffect(() => {
        if (!listening) return;
        const handler = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
            const recorded = buildKeybindFromEvent(e);
            if (!recorded) {
                setListening(false);
                return;
            }
            const normalized = normalizeKeybind(recorded);
            settings.store.keybind = normalized;
            setDisplayBind(normalized);
            setListening(false);
        };
        const blur = () => setListening(false);
        window.addEventListener("keydown", handler, true);
        window.addEventListener("blur", blur);
        return () => {
            window.removeEventListener("keydown", handler, true);
            window.removeEventListener("blur", blur);
        };
    }, [listening]);

    return (
        <button
            type="button"
            onClick={() => setListening(true)}
            style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid var(--background-modifier-accent)",
                background: listening ? "var(--background-secondary)" : "var(--background-tertiary)",
                color: "var(--text-normal)",
                cursor: "pointer",
                textAlign: "left"
            }}
        >
            {listening ? "Press any key combination..." : `Current: ${displayBind || "Not set"}`}
        </button>
    );
}

function KeybindDescription() {
    return (
        <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
            Click below to set a two key screenshare binding.
        </Text>
    );
}

function ScreenSetting() {
    const { streamMedia, includeVideoDevices } = settings.use(["streamMedia", "includeVideoDevices"]);
    const media = MediaEngineStore.getMediaEngine();
    const [streamMediaSelection, setStreamMediaSelection] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        async function fetchMedia() {
            setLoading(true);
            const sources = await getDesktopSources(media, ["screen", "window"], null) ?? [];

            if (includeVideoDevices) {
                try {
                    const videoDevices = Object.values(configModule.getVideoDevices() || {});
                    const videoSources = videoDevices.map((device: any) => ({
                        id: device.id,
                        name: device.name,
                        type: "video_device"
                    }));
                    sources.push(...videoSources);
                } catch (e) {
                    log.warn("Failed to get video devices:", e);
                }
            }

            if (active) {
                setStreamMediaSelection(sources);
                setLoading(false);
            }
        }
        fetchMedia();
        return () => { active = false; };
    }, [includeVideoDevices]);

    if (loading) return <Paragraph>Loading media sources...</Paragraph>;
    if (!streamMediaSelection.length) return <Paragraph>No Media found.</Paragraph>;

    return <StreamSimplePicker streamMediaSelection={streamMediaSelection} streamMedia={streamMedia} />;
}

function SettingSection() {
    return (
        <section>
            <Heading>Media source to stream</Heading>
            <Paragraph>Resets to main screen if not found</Paragraph>
            <ScreenSetting />
        </section>
    );
}
