import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Menu, useState } from "@webpack/common";
import { cooldown, denormalize, normalize } from "./utils";

const MIN_FPS = 1, MIN_RESOLUTION = 22; // 0 FPS freezes (obviously) and anything less than 22p doesn't work

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
        match: /if\(\i===\i\.\i.PRESET_AUTO\)/,
        replace: "return !0;$&"
      }
    },
    {
      find: "id:\"frame-rate\",",
      replacement: [{
        match: /(PRESET_CUSTOM&&.+id:"[^"]+".+?children:)(\i.+?group:.(resolution).+?id:.([^$]+).+?(\i)===\i,.+?(function.+?\}\)\})\).+?)(}\)[,\]])/,
        replace: "$1[$self.OptionsRange(($6),['$3','$4',$5],true),...$2]$7"
      },
      {
        match: /(PRESET_CUSTOM&&.+id:"[^"]+".+?children:)(\i.+?group:.(frame-rate).+?id:.([^$]+).+?(\i)===\i,.+?(function.+?\}\)\})\).+?)(}\)[,\]])/,
        replace: "$1[$self.OptionsRange(($6),['$3','$4',$5],false),...$2]$7"
      }]
    },
    {
      find: "\"stream-settings-resolution\"",
      replacement: [{
        match: /({preset:\i,resolution:(\i),fps:(\i),soundshareEnabled:\i}.+?\i=)(\i.\i.map\(\i=>[^"]+?group:"([^"]+?fps)\".+?id:.([^$]+).+?action:\(\)=>(\i)\((\i),\i,\i,([^\)]+).+?\${\i}`\)}\))/,
        replace: "$1[$self.SettingsRange($7,[$2,$3,'$5','$6',$8,$9],false),...$4]"
      },
      {
        match: /({preset:\i,resolution:(\i),fps:(\i),soundshareEnabled:\i}.+?\i=)(\i.\i.map\(\i=>[^"]+?group:"([^"]+?resolution)\".+?id:.([^$]+).+?action:\(\)=>(\i)\((\i),\i,\i,([^\)]+).+?\${\i}`\)}\))/,
        replace: "$1[$self.SettingsRange($7,[$2,$3,'$5','$6',$8,$9],true),...$4]"
      }]
    }
  ],
  OptionsRange(changeStream: Function, params: any[], isResolution: boolean) {
    const { maxFPS, maxResolution } = settings.store;
    const [group, id, initialValue] = params;
    const minValue = isResolution ? MIN_RESOLUTION : MIN_FPS,
      maxValue = isResolution ? maxResolution : maxFPS;

    return this.CustomRange(
      (value: number) => changeStream(value),
      initialValue,
      [minValue, maxValue],
      group,
      id + "custom",
      (isResolution ? "p" : " FPS")
    );
  },
  SettingsRange(changeStream: Function, params: any[], isResolution: boolean) {
    const { maxFPS, maxResolution } = settings.store;
    const [resolution, fps, group, id, p1, p2] = params;
    const minValue = isResolution ? MIN_RESOLUTION : MIN_FPS,
      maxValue = isResolution ? maxResolution : maxFPS;
    const initialValue = isResolution ? resolution : fps;

    return this.CustomRange(
      (value: number) => changeStream(p1, isResolution ? value : resolution, !isResolution ? value : fps, p2),
      initialValue,
      [minValue, maxValue],
      group,
      id + "custom",
      (isResolution ? "p" : " FPS")
    );
  },

  CustomRange(onChange: Function, initialValue: number, minMax: [number, number], group: string, id: string, suffix: string) {
    const [value, setValue] = useState(initialValue);
    const [minValue, maxValue] = minMax;

    const onChangeHandler = (newValue: number) => {
      let roundedValue = Math.round(denormalize(newValue, minValue, maxValue));
      setValue(roundedValue);
      cooldown(() => onChange(roundedValue));
    };
    return (<Menu.MenuControlItem group={`${group}`} id={`${id}`} label={value + suffix} control={
      (props, ref) =>
        <Menu.MenuSliderControl
          {...props}
          ref={ref}
          onChange={onChangeHandler}
          renderValue={() => value + suffix}
          value={normalize(initialValue, minValue, maxValue) || 0}
          minValue={0}
          maxValue={100}>
        </Menu.MenuSliderControl>}
    />);
  }
});