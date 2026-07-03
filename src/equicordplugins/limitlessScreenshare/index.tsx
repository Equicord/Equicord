/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { lodash, MediaEngineStore, Menu, useEffect, useMemo, useState } from "@webpack/common";

import { denormalize, normalize } from "./utils";

// 0 FPS freezes (obviously) and anything less than 22p doesn't work
const COOLDOWN_MS = 1000;
const MIN_FPS = 1;
const MIN_RESOLUTION = 22;

type CustomRangeProps = {
    onChange: (value: number) => void,
    initialValue: number,
    minMax: [number, number],
    group: string,
    id: string,
    suffix: string;
};

const CustomRange = ({ onChange, initialValue, minMax, group, id, suffix }: CustomRangeProps) => {
    const [value, setValue] = useState(initialValue);
    const [minValue, maxValue] = minMax;

    const changeStreamSettings = useMemo(() => lodash.throttle((value: number) => onChange(value), COOLDOWN_MS), []);
    useEffect(() => () => changeStreamSettings.cancel(), [changeStreamSettings]);

    const onChangeHandler = (newValue: number) => {
        const roundedValue = Math.round(denormalize(newValue, minValue, maxValue));
        setValue(roundedValue);
        changeStreamSettings(roundedValue);
    };
    return (
        <Menu.MenuControlItem group={`${group}`} id={`${id}`} label={value + suffix} control={
            (props, ref) =>
                <Menu.MenuSliderControl
                    {...props}
                    ref={ref}
                    onChange={onChangeHandler}
                    renderValue={() => value + suffix}
                    value={normalize(value, minValue, maxValue) || 0}
                    minValue={0}
                    maxValue={100}>
                </Menu.MenuSliderControl>}
        />
    );
};

const settings = definePluginSettings({
    maxFPS: {
        description: "Max FPS for the range slider",
        default: 120,
        type: OptionType.NUMBER,
        isValid: (value: number) => value >= MIN_FPS
    },
    maxResolution: {
        description: "Max Resolution for the range slider",
        default: 1080,
        type: OptionType.NUMBER,
        isValid: (value: number) => value >= MIN_RESOLUTION
    }
});

export default definePlugin({
    name: "LimitlessScreenshare",
    description: "Adds a slider for screenshare resolution and fps.",
    authors: [EquicordDevs.KawaiianPizza],
    tags: ["Utility", "Voice"],
    settings,
    patches: [
        {
            find: '"canStreamWithSettings"',
            replacement: {
                match: /(?=if\(\i===\i\.\i.PRESET_AUTO\))/,
                replace: "return !0;"
            }
        },
        {
            find: '"stream-option-notify"',
            replacement: [
                {
                    match: /(?<=#{intl::IG5n0X::raw}\),children:).{0,150}checked:(\i)===.{0,80}action:\(\)=>(\(function.{0,150}resolution:\i\}\)\}\)).{0,5}\i\)\}\)/,
                    replace: "[$self.OptionsRange($2,$1,true),...$&]"
                },
                {
                    match: /(?<=#{intl::SkkeIt::raw}\),children:).{0,90}checked:(\i)===.{0,200}action:\(\)=>(\(function.{0,500}fps:\i\}\)\}\)).{0,5}\i\)\)/,
                    replace: "[$self.OptionsRange($2,$1,false),...$&]"
                },
            ]
        },
        {
            find: '"stream-settings-audio-enable"',
            replacement: [
                {
                    match: /(?<=action:\(\)=>(\i)\((\i),\i,\i,(\i\.\i\.RESOLUTION)\)\},.{0,200}#{intl::SCREENSHARE_FRAME_RATE}\),children:)(\i)/,
                    replace: "[$self.SettingsRange($1,[$2,$3],false),...$4]"
                },
                {
                    match: /(?<=action:\(\)=>(\i)\((\i),\i,\i,(\i\.\i\.RESOLUTION)\)\},.{0,300}#{intl::STREAM_RESOLUTION}\),children:)(\i)/,
                    replace: "[$self.SettingsRange($1,[$2,$3],true),...$4]"
                },
            ]
        }
    ],
    OptionsRange(changeStream: (value: number) => void, initialValue, isResolution: boolean) {
        const { maxFPS, maxResolution } = settings.store;
        const minValue = isResolution ? MIN_RESOLUTION : MIN_FPS,
            maxValue = isResolution ? maxResolution : maxFPS;

        return CustomRange({
            onChange: (value: number) => changeStream(value),
            initialValue,
            minMax: [minValue, maxValue],
            group: isResolution ? "resolution" : "frame-rate",
            id: isResolution ? "stream-option-resolution-custom" : "stream-option-frame-rate-custom",
            suffix: (isResolution ? "p" : " FPS")
        });
    },
    SettingsRange(changeStream: (boolean: boolean, resolution: number, fps: number, analyticsType: string) => void, params: [boolean, string], isResolution: boolean) {
        const { maxFPS, maxResolution } = settings.store;
        const [p1, p2] = params;
        const minValue = isResolution ? MIN_RESOLUTION : MIN_FPS,
            maxValue = isResolution ? maxResolution : maxFPS;
        const initialValue = isResolution ? MediaEngineStore.getState().goLiveSource?.quality.resolution || 720 : MediaEngineStore.getState().goLiveSource?.quality.frameRate || 30;

        const onChange = (value: number) => {
            const otherValue = !isResolution
                ? MediaEngineStore.getState().goLiveSource?.quality.resolution || 720
                : MediaEngineStore.getState().goLiveSource?.quality.frameRate || 30;
            return changeStream(p1, isResolution ? value : otherValue, !isResolution ? value : otherValue, p2);
        };

        return CustomRange({
            onChange,
            initialValue,
            minMax: [minValue, maxValue],
            group: isResolution ? "stream-settings-resolution" : "stream-settings-fps",
            id: isResolution ? "stream-settings-resolution-custom" : "stream-settings-fps-custom",
            suffix: (isResolution ? "p" : " FPS")
        });
    },
});
