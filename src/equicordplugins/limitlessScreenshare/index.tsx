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

const COOLDOWN_MS = 1000, MIN_FPS = 1, MIN_RESOLUTION = 22; // 0 FPS freezes (obviously) and anything less than 22p doesn't work

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
      find: "\"canStreamWithSettings\"",
      replacement: {
        match: /(?=if\(\i===\i\.\i.PRESET_AUTO\))/,
        replace: "return !0;"
      }
    },
    {
      find: "id:\"frame-rate\",",
      replacement: [{
        match: /(?<=id:"resolution".{32,48}children:)(\i.{64,96}group:"(resolution)",id:`([^$]{1,32}).{4}`.{9}(\i).{64,96}(function.{150,170}}\)})\).{8,16})(?=}\),)/,
        replace: "[$self.OptionsRange(($5),['$2','$3',$4],true),...$1]"
      },
      {
        match: /(?<=id:"frame-rate".{32,48}children:)(\i.{24,32}group:.(frame-rate).{2}id:`([^$]{1,32}).{4}`.{9}(\i).{64,96}(function.{140,150}}\)})\).{8,16})(?=}\)\])/,
        replace: "[$self.OptionsRange(($5),['$2','$3',$4],false),...$1]"
      }]
    },
    {
      find: "\"stream-settings-resolution\"",
      replacement: [{
        match: /(\i.\i.map\(\i=>[^"]{64,96}group:"([^"]{8,16}fps)\",id:.([^$]{1,32}).{32,48}action:\(\)=>(\i)\((\i),\i,\i,([^\)]{1,64}).{1,32}\${\i}`\)}\))/,
        replace: "[$self.SettingsRange($4,['$2','$3',$5,$6],false),...$1]"
      },
      {
        match: /(\i.\i.map\(\i=>[^"]{64,96}group:"([^"]{8,16}resolution)\",id:.([^$]{1,32}).{32,48}action:\(\)=>(\i)\((\i),\i,\i,([^\)]{1,64}).{1,32}\${\i}`\)}\))/,
        replace: "[$self.SettingsRange($4,['$2','$3',$5,$6],true),...$1]"
      }]
    }
  ],
  OptionsRange(changeStream: (value: number) => void, params: [string, string, number], isResolution: boolean) {
    const { maxFPS, maxResolution } = settings.store;
    const [group, id, initialValue] = params;
    const minValue = isResolution ? MIN_RESOLUTION : MIN_FPS,
      maxValue = isResolution ? maxResolution : maxFPS;
    return CustomRange({
      onChange: (value: number) => changeStream(value),
      initialValue,
      minMax: [minValue, maxValue],
      group,
      id: id + "custom",
      suffix: (isResolution ? "p" : " FPS")
    });
  },
  SettingsRange(changeStream: (boolean: boolean, resolution: number, fps: number, analyticsType: string) => void, params: [string, string, boolean, string], isResolution: boolean) {
    const { maxFPS, maxResolution } = settings.store;
    const [group, id, p1, p2] = params;
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
      group,
      id: id + "custom",
      suffix: (isResolution ? "p" : " FPS")
    });
  },
});

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
    let roundedValue = Math.round(denormalize(newValue, minValue, maxValue));
    setValue(roundedValue);
    changeStreamSettings(roundedValue);
  };
  return (<Menu.MenuControlItem group={`${group}`} id={`${id}`} label={value + suffix} control={
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
  />);
};