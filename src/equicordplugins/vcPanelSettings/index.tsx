/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { SettingsSection } from "@components/settings/tabs/plugins/components/Common";
import { Devs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { identity } from "@utils/misc";
import { useForceUpdater } from "@utils/react";
import definePlugin, { defineDefault, OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Checkbox, FluxDispatcher, Select, Slider, useEffect, useState } from "@webpack/common";

const cl = classNameFactory("vc-panelsettings-");
const configModule = findByPropsLazy("getOutputVolume");
const audioActionCreators = findByPropsLazy("setAttenuation");

const getDevices = (devices: unknown) => Object.values(devices as Record<string, { id: string; name: string; }>);
const headingStyle = { fontSize: "1.27rem" } as const;
const subscribeToDispatcher = (type: string, listener: () => void) => {
    FluxDispatcher.subscribe(type, listener);
    return () => FluxDispatcher.unsubscribe(type, listener);
};
const headerLabels = {
    outputVolume: "Output volume",
    inputVolume: "Input volume",
    outputDevice: "Output device",
    inputDevice: "Input device",
    camera: "Camera",
    globalAttenuation: "Global Attentuation"
} as const;

const shouldShowHeader = (key: keyof typeof headerLabels) => settings.store.headerVisibility[key];

function HeaderSetting({ settingKey }: { settingKey: keyof typeof headerLabels; }) {
    const update = useForceUpdater();
    const value = settings.store.headerVisibility[settingKey];

    return (
        <Checkbox
            value={value}
            size={20}
            onChange={(_, newValue) => {
                settings.store.headerVisibility[settingKey] = newValue;
                settings.store.headerVisibility = { ...settings.store.headerVisibility };
                update();
            }}
        >
            <BaseText size="sm">{headerLabels[settingKey]}</BaseText>
        </Checkbox>
    );
}

const HeaderSettings = ErrorBoundary.wrap(() => (
    <SettingsSection name="Header List" description="Choose which section headers to show">
        <div className={cl("filter-list")}>
            {Object.keys(headerLabels).map(key => (
                <HeaderSetting key={key} settingKey={key as keyof typeof headerLabels} />
            ))}
        </div>
    </SettingsSection>
), { noop: true });

const settings = definePluginSettings({
    title1: {
        type: OptionType.COMPONENT,
        component: () => <BaseText weight="bold" style={headingStyle}>Appearance</BaseText>,
        description: ""
    },
    uncollapseSettingsByDefault: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Automatically uncollapse voice settings by default."
    },
    title2: {
        type: OptionType.COMPONENT,
        component: () => <BaseText weight="bold" style={headingStyle}>Settings to show</BaseText>,
        description: ""
    },
    outputVolume: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show an output volume slider."
    },
    inputVolume: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show an input volume slider."
    },
    outputDevice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show an output device selector."
    },
    inputDevice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show an input device selector."
    },
    globalAttenuation: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show global attenuation controls."
    },
    camera: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show a camera selector."
    },
    headerVisibility: {
        type: OptionType.COMPONENT,
        component: HeaderSettings,
        default: defineDefault({
            outputVolume: true,
            inputVolume: true,
            outputDevice: false,
            inputDevice: false,
            camera: false,
            globalAttenuation: false
        })
    }
});

function OutputVolumeComponent() {
    const [outputVolume, setOutputVolume] = useState(configModule.getOutputVolume());

    useEffect(() => {
        const listener = () => setOutputVolume(configModule.getOutputVolume());
        return subscribeToDispatcher("AUDIO_SET_OUTPUT_VOLUME", listener);
    }, []);

    return (
        <>
            {shouldShowHeader("outputVolume") && <Heading>Output volume</Heading>}
            <Slider maxValue={200} minValue={0} onValueRender={v => `${v.toFixed(0)}%`} initialValue={outputVolume} asValueChanges={volume => {
                FluxDispatcher.dispatch({
                    type: "AUDIO_SET_OUTPUT_VOLUME",
                    volume
                });
            }} />
        </>
    );
}

function InputVolumeComponent() {
    const [inputVolume, setInputVolume] = useState(configModule.getInputVolume());

    useEffect(() => {
        const listener = () => setInputVolume(configModule.getInputVolume());
        return subscribeToDispatcher("AUDIO_SET_INPUT_VOLUME", listener);
    }, []);

    return (
        <>
            {shouldShowHeader("inputVolume") && <Heading>Input volume</Heading>}
            <Slider maxValue={100} minValue={0} initialValue={inputVolume} asValueChanges={volume => {
                FluxDispatcher.dispatch({
                    type: "AUDIO_SET_INPUT_VOLUME",
                    volume
                });
            }} />
        </>
    );
}

function OutputDeviceComponent() {
    const [outputDevice, setOutputDevice] = useState(configModule.getOutputDeviceId());

    useEffect(() => {
        const listener = () => setOutputDevice(configModule.getOutputDeviceId());
        return subscribeToDispatcher("AUDIO_SET_OUTPUT_DEVICE", listener);
    }, []);

    return (
        <>
            {shouldShowHeader("outputDevice") && <Heading>Output device</Heading>}
            <Select options={getDevices(configModule.getOutputDevices()).map(device => {
                return { value: device.id, label: shouldShowHeader("outputDevice") ? device.name : `🔊 ${device.name}` };
            })}
                serialize={identity}
                isSelected={value => value === outputDevice}
                select={id => {
                    FluxDispatcher.dispatch({
                        type: "AUDIO_SET_OUTPUT_DEVICE",
                        id
                    });
                }}>

            </Select>
        </>
    );
}

function InputDeviceComponent() {
    const [inputDevice, setInputDevice] = useState(configModule.getInputDeviceId());

    useEffect(() => {
        const listener = () => setInputDevice(configModule.getInputDeviceId());
        return subscribeToDispatcher("AUDIO_SET_INPUT_DEVICE", listener);
    }, []);

    return (
        <div className={cl("section")}>
            {shouldShowHeader("inputDevice") && <Heading>Input device</Heading>}
            <Select options={getDevices(configModule.getInputDevices()).map(device => {
                return { value: device.id, label: shouldShowHeader("inputDevice") ? device.name : `🎤 ${device.name}` };
            })}
                serialize={identity}
                isSelected={value => value === inputDevice}
                select={id => {
                    FluxDispatcher.dispatch({
                        type: "AUDIO_SET_INPUT_DEVICE",
                        id
                    });
                }}>

            </Select>
        </div>
    );
}

function VideoDeviceComponent() {
    const [videoDevice, setVideoDevice] = useState(configModule.getVideoDeviceId());

    useEffect(() => {
        const listener = () => setVideoDevice(configModule.getVideoDeviceId());
        return subscribeToDispatcher("MEDIA_ENGINE_SET_VIDEO_DEVICE", listener);
    }, []);

    return (
        <div className={cl("section")}>
            {shouldShowHeader("camera") && <Heading>Camera</Heading>}
            <Select options={getDevices(configModule.getVideoDevices()).map(device => {
                return { value: device.id, label: shouldShowHeader("camera") ? device.name : `📷 ${device.name}` };
            })}
                serialize={identity}
                isSelected={value => value === videoDevice}
                select={id => {
                    FluxDispatcher.dispatch({
                        type: "MEDIA_ENGINE_SET_VIDEO_DEVICE",
                        id
                    });
                }}>

            </Select>
        </div>
    );
}

const getAttenuationState = () => ({
    attenuation: configModule.getAttenuation(),
    attenuateWhileSpeakingSelf: configModule.getAttenuateWhileSpeakingSelf(),
    attenuateWhileSpeakingOthers: configModule.getAttenuateWhileSpeakingOthers()
});

function GlobalAttenuationComponent() {
    const [showGlobalAttentuation, setShowGlobalAttentuation] = useState(false);
    const [{ attenuation, attenuateWhileSpeakingSelf, attenuateWhileSpeakingOthers }, setAttenuationState] = useState(getAttenuationState);

    useEffect(() => {
        const listener = () => setAttenuationState(getAttenuationState());

        return subscribeToDispatcher("AUDIO_SET_ATTENUATION", listener);
    }, []);

    return (
        <div className={cl("section")}>
            <Link className={cl("toggle")} onClick={() => setShowGlobalAttentuation(!showGlobalAttentuation)}>
                {!showGlobalAttentuation ? `► ${headerLabels.globalAttenuation}` : `▼ ${headerLabels.globalAttenuation}`}
            </Link>
            {showGlobalAttentuation && (
                <>
                    <Slider
                        maxValue={100}
                        minValue={0}
                        initialValue={attenuation}
                        onValueRender={value => `${value.toFixed(0)}%`}
                        asValueChanges={value => {
                            const nextAttenuation = Math.round(value);
                            setAttenuationState(state => state.attenuation === nextAttenuation ? state : { ...state, attenuation: nextAttenuation });
                            audioActionCreators.setAttenuation(nextAttenuation, attenuateWhileSpeakingSelf, attenuateWhileSpeakingOthers);
                        }}
                    />
                    <FormSwitch
                        title="When I speak"
                        value={attenuateWhileSpeakingSelf}
                        onChange={enabled => audioActionCreators.setAttenuation(attenuation, enabled, attenuateWhileSpeakingOthers)}
                    />
                    <FormSwitch
                        title="When others speak"
                        value={attenuateWhileSpeakingOthers}
                        onChange={enabled => audioActionCreators.setAttenuation(attenuation, attenuateWhileSpeakingSelf, enabled)}
                    />
                </>
            )}
        </div>
    );
}

function VoiceSettings() {
    const [showSettings, setShowSettings] = useState(settings.store.uncollapseSettingsByDefault);
    return <div className={cl("panel")}>
        <div className={cl("toggle-row")}>
            <Link className={cl("toggle")} onClick={() => { setShowSettings(!showSettings); }}>{!showSettings ? "► Settings" : "▼ Hide"}</Link>
        </div>

        {
            showSettings && <>
                {settings.store.outputVolume && <OutputVolumeComponent />}
                {settings.store.inputVolume && <InputVolumeComponent />}
                {settings.store.outputDevice && <OutputDeviceComponent />}
                {settings.store.inputDevice && <InputDeviceComponent />}
                {settings.store.globalAttenuation && <GlobalAttenuationComponent />}
                {settings.store.camera && <VideoDeviceComponent />}
            </>
        }
    </div>;
}

export default definePlugin({
    name: "VCPanelSettings",
    description: "Control voice settings right from the voice panel",
    authors: [Devs.nin0dev],
    settings,
    renderVoiceSettings() { return <VoiceSettings />; },
    patches: [
        {
            find: "this.renderChannelButtons()",
            replacement: {
                match: /this.renderChannelButtons\(\)/,
                replace: "this.renderChannelButtons(), $self.renderVoiceSettings()"
            }
        }
    ]
});
