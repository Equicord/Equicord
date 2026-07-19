/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { DeleteIcon } from "@components/Icons";
import { useForceUpdater } from "@utils/react";
import { TextInput, useState } from "@webpack/common";

import { cl } from "..";

export function ListedIds({ listIds, setListIds }: { listIds: string[]; setListIds: (v: string[]) => void; }) {
    const update = useForceUpdater();
    const [values] = useState(listIds);

    async function onChange(e: string, index: number) {
        values[index] = e.trim();
        setListIds(values);
        update();
    }

    const elements = values.map((currentValue: string, index: number) => {
        return (
            <Flex key={index} flexDirection="row" style={{ marginBottom: "5px" }}>
                <div style={{ flexGrow: 1 }}>
                    <TextInput
                        placeholder="ID"
                        spellCheck={false}
                        value={currentValue}
                        onChange={e => onChange(e, index)} />
                </div>
                <Button
                    onClick={() => {
                        values.splice(index, 1);
                        setListIds(values);
                        update();
                    }}
                    variant="none"
                    size="iconOnly"
                    className={cl("delete")}>
                    <DeleteIcon />
                </Button>
            </Flex>
        );
    });

    return <>{elements}</>;
}
