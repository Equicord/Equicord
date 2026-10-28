/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { lodash, Menu, useEffect, useMemo, useState } from "@webpack/common";

import { COOLDOWN_MS } from "./settings";
import { denormalize, normalize } from "./utils";

export type CustomRangeProps = {
  onChange: (value: number) => void,
  initialValue: number,
  minMax: [number, number],
  group: string,
  id: string,
  suffix: string;
  step?: 1 | 10;
};

type RangeSliderProps = Omit<CustomRangeProps, "group" | "id"> & {
  controlProps: any,
  sliderRef: any;
};

const RangeSlider = ({ onChange, initialValue, minMax, suffix, controlProps, sliderRef, step = 1 }: RangeSliderProps) => {
  const [value, setValue] = useState(initialValue);
  const [minValue, maxValue] = minMax;
  const min = minValue / step, max = maxValue / step;

  const changeStreamSettings = useMemo(() => lodash.throttle((value: number) => onChange(value * step!), COOLDOWN_MS), []);
  useEffect(() => () => changeStreamSettings.cancel(), [changeStreamSettings]);

  const onChangeHandler = (newValue: number) => {
    const clampedValue = lodash.clamp(Math.round(denormalize(newValue, min, max)), min, max);
    setValue(clampedValue);
    changeStreamSettings(clampedValue);
  };
  return (
    <Menu.MenuSliderControl
      {...controlProps}
      ref={sliderRef}
      onChange={onChangeHandler}
      renderValue={() => value * step! + suffix}
      value={normalize(value, min, max) || 0}
      minValue={0}
      maxValue={100}>
    </Menu.MenuSliderControl>
  );
};

export const CustomRange = ({ group, id, initialValue, minMax, step = 1, ...props }: CustomRangeProps) => (
  <Menu.MenuControlItem group={`${group}`} id={`${id}-custom`} label={initialValue * step + props.suffix} control={(controlProps, ref) => <RangeSlider
    {...props}
    initialValue={initialValue}
    minMax={minMax}
    step={step}
    controlProps={controlProps}
    sliderRef={ref}
  />} />
);
