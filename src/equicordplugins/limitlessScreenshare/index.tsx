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
    const minValue = isResolution ? MIN_RESOLUTION : MIN_FPS,
      maxValue = isResolution ? maxResolution : maxFPS;
    const initialValue = params[2];

    return this.CustomRange(
      (value: number) => changeStream(value),
      initialValue,
      [minValue, maxValue],
      params[0],
      params[1] + "-custom",
      (isResolution ? "p" : " FPS")
    );
  },
  SettingsRange(changeStream: Function, params: any[], isResolution: boolean) {
    const { maxFPS, maxResolution } = settings.store;
    const minValue = isResolution ? MIN_RESOLUTION : MIN_FPS,
      maxValue = isResolution ? maxResolution : maxFPS;
    const initialValue = params[isResolution ? 0 : 1];

    return this.CustomRange(
      (value: number) => changeStream(params[4], isResolution ? value : params[0], !isResolution ? value : params[1], params[5]),
      initialValue,
      [minValue, maxValue],
      params[2],
      params[3] + "-custom",
      (isResolution ? "p" : " FPS")
    );
  },

  CustomRange(onChange: Function, initialValue: number, minMax: [number, number], group: string, id: string, suffix: string) {
    const [value, setValue] = useState(initialValue);
    const minValue = minMax[0],
      maxValue = minMax[1];

    const onChangeHandler = (number: number) => {
      let tmp = denormalize(number, minValue, maxValue);
      tmp = Math.round(tmp);
      setValue(tmp);
      cooldown(() => onChange(tmp));
    };
    return (<Menu.MenuControlItem group={`${group}`} id={`${id}`} interactive={true} control={
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