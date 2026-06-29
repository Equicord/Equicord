/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Paragraph } from "@components/Paragraph";
import { ColorPicker, Forms, Slider, Toasts, useEffect, useState } from "@webpack/common";

import { settings } from "../settings";
import { hexToInt, intToHex } from "../utils/colors";
import {
    COLOR_SWATCHES,
    DEFAULT_UI_SETTINGS,
    formatSliderValue,
    getSliderMarkers,
    PRESET_IDS,
    PRESET_LABELS,
    PRESET_VALUES,
    SIZE_MODE_IDS,
    SIZE_MODE_LABELS,
    type SizeModeId,
    type SliderSettingKey,
    snapSliderValue,
    type UiSettings,
} from "../utils/constants";
import { basename, bumpVideoReloadToken, getVideoSource, pickLocalVideo, revokeActiveObjectUrl } from "../utils/video";

export function applyThemePreset(presetId: string): void {
    const meta = PRESET_LABELS[presetId as keyof typeof PRESET_LABELS];
    const values = PRESET_VALUES[presetId] ?? {};

    for (const [k, v] of Object.entries(DEFAULT_UI_SETTINGS)) {
        (settings.store as Record<string, unknown>)[k] = v;
    }
    for (const [k, v] of Object.entries(values)) {
        (settings.store as Record<string, unknown>)[k] = v;
    }

    Toasts.show({
        message: `Applied preset: ${meta?.name ?? presetId}`,
        type: Toasts.Type.SUCCESS,
        id: Toasts.genId(),
    });
}

export function resetUiDefaults(): void {
    for (const [k, v] of Object.entries(DEFAULT_UI_SETTINGS)) {
        (settings.store as Record<string, unknown>)[k] = v;
    }
    Toasts.show({
        message: "UI settings reset to defaults.",
        type: Toasts.Type.SUCCESS,
        id: Toasts.genId(),
    });
}

function LiveSlider({ label, settingKey }: {
    label: string;
    settingKey: SliderSettingKey;
}) {
    const markers = getSliderMarkers(settingKey);
    const store = settings.use([settingKey]);
    const rawValue = Number(store[settingKey]);
    const value = snapSliderValue(settingKey, rawValue);
    const displayValue = formatSliderValue(settingKey, value);

    return (
        <div style={{ marginBottom: "0.75em" }}>
            <Forms.FormText style={{ marginBottom: "0.35em" }}>{label}: <strong>{displayValue}</strong></Forms.FormText>
            <Slider
                markers={markers}
                minValue={markers[0]}
                maxValue={markers[markers.length - 1]}
                initialValue={value}
                stickToMarkers
                onValueChange={(v: number) => {
                    (settings.store as Record<string, unknown>)[settingKey] = snapSliderValue(settingKey, v);
                }}
                onValueRender={(v: number) => formatSliderValue(settingKey, v)}
            />
        </div>
    );
}

function LiveSwitch({ label, settingKey, description }: {
    label: string;
    settingKey: keyof UiSettings;
    description?: string;
}) {
    const store = settings.use([settingKey]);
    const value = Boolean(store[settingKey]);

    return (
        <FormSwitch
            title={label}
            description={description}
            value={value}
            onChange={(v: boolean) => {
                (settings.store as Record<string, unknown>)[settingKey] = v;
            }}
        />
    );
}

function SettingColorRow({ settingKey, label }: { settingKey: keyof UiSettings; label: string; }) {
    const store = settings.use([settingKey]);
    const hex = String(store[settingKey] ?? "#000000");

    return (
        <Flex style={{ alignItems: "center", justifyContent: "space-between", gap: "1em", marginBottom: "0.35em" }}>
            <Paragraph style={{ flex: 1, margin: 0 }}>{label}</Paragraph>
            <ColorPicker
                color={hexToInt(hex)}
                onChange={(c: number) => {
                    (settings.store as Record<string, unknown>)[settingKey] = intToHex(c);
                }}
                showEyeDropper
                suggestedColors={COLOR_SWATCHES}
            />
        </Flex>
    );
}

export function VideoFiltersPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Video Filters</Forms.FormTitle>
            <LiveSlider label="Brightness" settingKey="videoBrightness" />
            <LiveSlider label="Contrast" settingKey="videoContrast" />
            <LiveSlider label="Saturation" settingKey="videoSaturation" />
            <LiveSlider label="Opacity" settingKey="videoOpacity" />
            <LiveSlider label="Blur" settingKey="videoBlur" />
        </Flex>
    );
}

export function VideoSizeSlidersPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Video Size Sliders</Forms.FormTitle>
            <LiveSlider label="Zoom" settingKey="videoScale" />
            <LiveSlider label="Width %" settingKey="videoWidthPercent" />
            <LiveSlider label="Height %" settingKey="videoHeightPercent" />
            <LiveSlider label="Position X" settingKey="videoPositionX" />
            <LiveSlider label="Position Y" settingKey="videoPositionY" />
        </Flex>
    );
}

export function TypographyPanel() {
    const { messageFontWeight, headerFontWeight } = settings.use([
        "messageFontWeight", "headerFontWeight",
    ]);

    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Typography</Forms.FormTitle>
            <LiveSlider label="Message size" settingKey="messageFontSize" />
            <LiveSlider label="Header size" settingKey="headerFontSize" />
            <LiveSlider label="Channel size" settingKey="channelFontSize" />
            <LiveSlider label="Muted size" settingKey="mutedFontSize" />
            <LiveSlider label="Line height" settingKey="messageLineHeight" />
            <Forms.FormText>Message weight</Forms.FormText>
            <Flex gap="0.35em" style={{ flexWrap: "wrap", marginBottom: "0.5em" }}>
                {["400", "500", "600", "700"].map(w => (
                    <Button key={w} size="small" variant={messageFontWeight === w ? "primary" : "secondary"}
                        onClick={() => { settings.store.messageFontWeight = w; }}>
                        {w}
                    </Button>
                ))}
            </Flex>
            <Forms.FormText>Header weight</Forms.FormText>
            <Flex gap="0.35em" style={{ flexWrap: "wrap", marginBottom: "0.5em" }}>
                {["400", "500", "600", "700"].map(w => (
                    <Button key={w} size="small" variant={headerFontWeight === w ? "primary" : "secondary"}
                        onClick={() => { settings.store.headerFontWeight = w; }}>
                        {w}
                    </Button>
                ))}
            </Flex>
        </Flex>
    );
}

export function PanelOpacityPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Panel Opacity</Forms.FormTitle>
            <LiveSlider label="Chat" settingKey="chatBgOpacity" />
            <LiveSlider label="Sidebar" settingKey="sidebarBgOpacity" />
            <LiveSlider label="Server list" settingKey="serverListBgOpacity" />
            <LiveSlider label="Member list" settingKey="memberListBgOpacity" />
            <LiveSlider label="Input" settingKey="inputBgOpacity" />
            <LiveSlider label="Title bar" settingKey="titleBarBgOpacity" />
            <LiveSlider label="Extra message area" settingKey="messageAreaExtraOpacity" />
        </Flex>
    );
}

export function EffectsPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Effects</Forms.FormTitle>
            <LiveSlider label="Chat backdrop blur" settingKey="chatBackdropBlur" />
            <LiveSlider label="Panel border radius" settingKey="panelBorderRadius" />
            <LiveSwitch label="Text shadow" settingKey="textShadowEnabled" />
            <LiveSlider label="Shadow blur" settingKey="textShadowBlur" />
            <LiveSlider label="Shadow offset Y" settingKey="textShadowOffsetY" />
        </Flex>
    );
}

export function GlobalPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Global</Forms.FormTitle>
            <LiveSlider label="Global overlay opacity" settingKey="globalOverlayOpacity" />
            <LiveSwitch
                label="Strip Discord overlays"
                settingKey="stripDiscordOverlays"
                description="Makes Discord's built-in backgrounds transparent so the video shows through."
            />
            <LiveSwitch label="Hide body overlay" settingKey="hideBodyOverlay" />
        </Flex>
    );
}

export function TextColorsPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Text Colors</Forms.FormTitle>
            <SettingColorRow settingKey="messageTextColor" label="Message text" />
            <SettingColorRow settingKey="messageMutedColor" label="Muted text" />
            <SettingColorRow settingKey="headerTextColor" label="Header text" />
            <SettingColorRow settingKey="inputTextColor" label="Input text" />
            <Paragraph style={{ fontSize: "0.85em", opacity: 0.8, marginTop: "0.25em" }}>
                Username colors still follow role colors when set on the server.
            </Paragraph>
        </Flex>
    );
}

export function ChannelNamesPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Channel Names</Forms.FormTitle>
            <Paragraph>Customize sidebar and header channel name colors separately.</Paragraph>
            <SettingColorRow settingKey="sidebarChannelNameColor" label="Sidebar channel names" />
            <SettingColorRow settingKey="channelTextColor" label="Header channel name" />
        </Flex>
    );
}

export function BackgroundColorsPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Background Colors</Forms.FormTitle>
            <SettingColorRow settingKey="chatBgColor" label="Chat background" />
            <SettingColorRow settingKey="sidebarBgColor" label="Sidebar" />
            <SettingColorRow settingKey="serverListBgColor" label="Server list" />
            <SettingColorRow settingKey="memberListBgColor" label="Member list" />
            <SettingColorRow settingKey="inputBgColor" label="Input background" />
            <SettingColorRow settingKey="titleBarBgColor" label="Title bar" />
            <SettingColorRow settingKey="globalOverlayColor" label="Global overlay" />
        </Flex>
    );
}

export function EffectColorsPanel() {
    return (
        <Flex flexDirection="column" gap="0.25em">
            <Forms.FormTitle tag="h3">Effect Colors</Forms.FormTitle>
            <SettingColorRow settingKey="textShadowColor" label="Text shadow" />
        </Flex>
    );
}

export function ThemePresetsPanel() {
    const [activeId, setActiveId] = useState<string | null>(null);

    return (
        <Flex flexDirection="column" gap="0.75em">
            <Forms.FormTitle tag="h3">Theme Presets</Forms.FormTitle>
            <Paragraph>Apply a coordinated color and opacity preset. You can tweak individual settings afterward.</Paragraph>
            <div className="vc-videothemeengine-preset-grid">
                {PRESET_IDS.map(id => {
                    const meta = PRESET_LABELS[id];
                    return (
                        <Button
                            key={id}
                            variant={activeId === id ? "primary" : "secondary"}
                            onClick={() => {
                                setActiveId(id);
                                applyThemePreset(id);
                            }}
                            style={{ height: "auto", padding: "0.6em 0.75em", flexDirection: "column" }}
                        >
                            <span style={{ fontWeight: 600 }}>{meta.name}</span>
                            <span style={{ fontSize: "0.8em", opacity: 0.75, whiteSpace: "normal" }}>{meta.desc}</span>
                        </Button>
                    );
                })}
            </div>
        </Flex>
    );
}

export function VideoSizePanel() {
    const { videoSizeMode } = settings.use(["videoSizeMode"]);

    return (
        <Flex flexDirection="column" gap="0.75em">
            <Forms.FormTitle tag="h3">Video Size Mode</Forms.FormTitle>
            <Paragraph>Choose how the background video is scaled on screen.</Paragraph>
            <div className="vc-videothemeengine-size-grid">
                {SIZE_MODE_IDS.map(id => {
                    const meta = SIZE_MODE_LABELS[id];
                    return (
                        <Button
                            key={id}
                            variant={videoSizeMode === id ? "primary" : "secondary"}
                            onClick={() => { settings.store.videoSizeMode = id as SizeModeId; }}
                            style={{
                                height: "auto",
                                minHeight: "3.75em",
                                padding: "0.55em 0.65em",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                lineHeight: 1.25,
                            }}
                        >
                            <span style={{ fontWeight: 600, fontSize: "0.9em", display: "block", width: "100%" }}>{meta.name}</span>
                            <span style={{ fontSize: "0.75em", opacity: 0.75, display: "block", width: "100%", marginTop: "0.2em" }}>{meta.desc}</span>
                        </Button>
                    );
                })}
            </div>
        </Flex>
    );
}

export function VideoPickerPanel() {
    const { localVideoPath, videoReloadToken } = settings.use(["localVideoPath", "videoReloadToken"]);
    const [previewError, setPreviewError] = useState(false);
    const [previewSrc, setPreviewSrc] = useState("");

    useEffect(() => {
        let cancelled = false;
        void getVideoSource().then(s => { if (!cancelled) setPreviewSrc(s ?? ""); });
        return () => { cancelled = true; };
    }, [localVideoPath, videoReloadToken]);

    const reloadVideo = async () => {
        const source = await getVideoSource();
        if (!source) {
            Toasts.show({
                message: "No video loaded. Pick an MP4 file first.",
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
            });
            return;
        }
        revokeActiveObjectUrl();
        bumpVideoReloadToken();
        Toasts.show({
            message: "Video reloaded.",
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId(),
        });
    };

    return (
        <Flex flexDirection="column" gap="0.75em">
            <Forms.FormTitle tag="h3">Background Video</Forms.FormTitle>
            <Button onClick={() => void pickLocalVideo()}>Pick video file</Button>
            <Button variant="secondary" onClick={() => void reloadVideo()}>Reload video</Button>
            {localVideoPath
                ? <Paragraph>Current file: <strong>{basename(localVideoPath)}</strong></Paragraph>
                : <Paragraph style={{ color: "var(--status-danger)" }}>No video selected.</Paragraph>}
            {previewSrc && !previewError && (
                <video
                    key={previewSrc}
                    src={previewSrc}
                    muted
                    loop
                    autoPlay
                    playsInline
                    controls
                    onError={() => setPreviewError(true)}
                    className="vc-videothemeengine-preview"
                />
            )}
        </Flex>
    );
}

export function UiResetPanel() {
    return (
        <Flex flexDirection="column" gap="0.5em">
            <Forms.FormTitle tag="h3">Guide</Forms.FormTitle>
            <Paragraph>
                Video Theme Engine plays a looping video behind Discord with customizable panel colors,
                typography, and effects. Pick a video, try a preset, then fine-tune sliders and colors.
            </Paragraph>
            <Button variant="secondary" onClick={resetUiDefaults}>Reset UI to defaults</Button>
        </Flex>
    );
}
