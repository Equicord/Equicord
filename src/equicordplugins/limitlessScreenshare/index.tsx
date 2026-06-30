/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { MediaEngineStore, Menu } from "@webpack/common";

import { CustomRange } from "./CustomRange";
import { MIN_FPS, MIN_RESOLUTION, settings } from "./settings";

export const cl = classNameFactory("vc-limitlessScreenshare-");

type CustomPresetListProps = {
    onChange: (value: number) => void,
    initialValue: number,
    group: string,
    id: string,
    list: {
        label: string;
        value: number;
    }[];
};

const CustomPresetList = ({ onChange, initialValue, group, id, list }: CustomPresetListProps) => {
    return list.map(({ label, value }, index) =>
        <Menu.MenuRadioItem
            key={index}
            group={`${group}`}
            id={`${id}-${value}`}
            action={() => onChange(value)}
            checked={initialValue === value}
            label={label}>
        </Menu.MenuRadioItem>
    );
};

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
                    replace: "[...$self.OptionsRange($2,$1,true)]"
                },
                {
                    match: /(?<=#{intl::SkkeIt::raw}\),children:).{0,90}checked:(\i)===.{0,200}action:\(\)=>(\(function.{0,500}fps:\i\}\)\}\)).{0,5}\i\)\)/,
                    replace: "[...$self.OptionsRange($2,$1,false)]"
                },
            ]
        },
        {
            find: '"stream-settings-audio-enable"',
            replacement: [
                {
                    match: /(?<=action:\(\)=>(\i)\((\i),\i,\i,(\i\.\i\.RESOLUTION)\)\},.{0,200}#{intl::SCREENSHARE_FRAME_RATE}\),children:)(\i)/,
                    replace: "[...$self.SettingsRange($1,[$2,$3],false)]"
                },
                {
                    match: /(?<=action:\(\)=>(\i)\((\i),\i,\i,(\i\.\i\.RESOLUTION)\)\},.{0,300}#{intl::STREAM_RESOLUTION}\),children:)(\i)/,
                    replace: "[...$self.SettingsRange($1,[$2,$3],true)]"
                },
            ]
        }
    ],
    OptionsRange(changeStream: (value: number) => void, initialValue: number, isResolution: boolean) {
        const { maxFPS, maxResolution, roundResolution, resolutions, fpss } = settings.store;
        const rounder = roundResolution ? 10 : 1;

        return [
            CustomRange(isResolution ? {
                onChange: (value: number) => changeStream(value * rounder),
                initialValue: initialValue / rounder,
                minMax: [MIN_RESOLUTION / rounder, maxResolution / rounder],
                group: "resolution",
                id: "stream-option-resolution",
                suffix: roundResolution ? "0p" : "p"
            } : {
                onChange: (value: number) => changeStream(value),
                initialValue,
                minMax: [MIN_FPS, maxFPS],
                group: "frame-rate",
                id: "stream-option-frame-rate",
                suffix: "fps"
            }),
            ...CustomPresetList({
                onChange: (value: number) => changeStream(value),
                initialValue,
                group: isResolution ? "resolution" : "frame-rate",
                id: isResolution ? "stream-option-resolution" : "stream-option-frame-rate",
                list: isResolution ? resolutions : fpss
            })
        ];
    },
    SettingsRange(changeStream: (boolean: boolean, resolution: number, fps: number, analyticsType: string) => void, params: [boolean, string], isResolution: boolean) {
        const { maxFPS, maxResolution, roundResolution, resolutions, fpss } = settings.store;
        const rounder = roundResolution ? 10 : 1;
        const [p1, p2] = params;
        const getResolution = () => MediaEngineStore.getState().goLiveSource?.quality.resolution || 720;
        const getFPS = () => MediaEngineStore.getState().goLiveSource?.quality.frameRate || 30;

        return [
            CustomRange(isResolution ? {
                onChange: (value: number) => changeStream(p1, value * rounder, getFPS(), p2),
                initialValue: getResolution() / rounder,
                minMax: [MIN_RESOLUTION / rounder, maxResolution / rounder],
                group: "stream-settings-resolution",
                id: "stream-settings-resolution",
                suffix: roundResolution ? "0p" : "p"
            } : {
                onChange: (value: number) => changeStream(p1, getResolution(), value, p2),
                initialValue: getFPS(),
                minMax: [MIN_FPS, maxFPS],
                group: "stream-settings-fps",
                id: "stream-settings-fps",
                suffix: " FPS"
            }),
            ...CustomPresetList(isResolution ? {
                onChange: (value: number) => changeStream(p1, value, getFPS(), p2),
                initialValue: getResolution(),
                group: "stream-settings-resolution",
                id: "stream-settings-resolution",
                list: resolutions
            } : {
                onChange: (value: number) => changeStream(p1, getResolution(), value, p2),
                initialValue: getFPS(),
                group: "stream-settings-fps",
                id: "stream-settings-fps",
                list: fpss
            })
        ];
    },
});
