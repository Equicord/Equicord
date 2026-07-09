/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Flex } from "@components/Flex";
import { DeleteIcon, PlusIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { TextInput, useMemo, useState } from "@webpack/common";

import { cl } from ".";
import { MIN_FPS, MIN_RESOLUTION, settings } from "./settings";

export function SettingsPresetList(isResolution: boolean) {
    const [value, setValue] = useState<number>();
    const { resolutions, fpss } = settings.use(["resolutions", "fpss"]);

    const errorString = useMemo(() => {
        if (value === undefined) return;
        if (isResolution) {
            if (value < MIN_RESOLUTION)
                return `Must be >${MIN_RESOLUTION}`;
            return;
        }
        if (value < MIN_FPS)
            return `Must be >${MIN_FPS}`;
    }, [value]);

    function handleAddPreset() {
        if (!value) return;
        const list = (isResolution ? resolutions : fpss);
        list.push({ label: `${value}${(isResolution ? "p" : "fps")}`, value });
        list.sort((a, b) => (Number(!a.value) - Number(!b.value)) || (a.value - b.value));
    }

    return (
        <section>
            <Flex gap={"0.5em"} flexWrap="wrap">
                {(isResolution ? resolutions : fpss).map(({ label, value }, index) => (
                    <Card key={index} className={cl("settings-card")}>
                        <Flex gap={"0.5em"} alignItems="center" flexWrap="wrap">
                            <Paragraph size="sm" weight="semibold" className={cl("settings-preset-label")}>{label}</Paragraph>
                            <Button variant="dangerSecondary" size="iconOnly" disabled={label === "Source"} onClick={() => (isResolution ? resolutions : fpss).splice(index, 1)}>
                                <DeleteIcon aria-label="Delete Tag" width={20} height={20} />
                            </Button>
                        </Flex>
                    </Card>
                ))}
                <Card className={cl("settings-card")}>
                    <Flex gap={"0.5em"} alignItems="center" className={cl("settings-flex-input")}>
                        <TextInput type="number"
                            onBeforeInput={(e: React.FormEvent<HTMLInputElement> & { data: string | null; }) => {
                                if (e.data !== null && !/^\d*$/.test(e.data)) e.preventDefault();
                            }}
                            value={value}
                            onChange={e => setValue((e.length > 0 ? parseInt(e) : undefined))}
                            error={errorString} />
                        <Button size="iconOnly" disabled={!value || !!errorString} onClick={handleAddPreset}><PlusIcon /></Button>
                    </Flex>
                </Card>
            </Flex>
        </section>
    );
}
