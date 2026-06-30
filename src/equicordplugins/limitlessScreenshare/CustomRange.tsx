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
};

export const CustomRange = ({ onChange, initialValue, minMax, group, id, suffix }: CustomRangeProps) => {
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
        <Menu.MenuControlItem group={`${group}`} id={`${id}-custom`} label={value + suffix} control={(props, ref) => <Menu.MenuSliderControl
            {...props}
            ref={ref}
            onChange={onChangeHandler}
            renderValue={() => value + suffix}
            value={normalize(value, minValue, maxValue) || 0}
            minValue={0}
            maxValue={100}>
        </Menu.MenuSliderControl>} />
    );
};
