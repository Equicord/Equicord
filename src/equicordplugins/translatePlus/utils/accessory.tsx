/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Parser, useEffect, useState } from "@webpack/common";

import { cl } from "../misc/class";
import { languages } from "../misc/languages";
import { Icon } from "./icon";
import { translate } from "./translator";

const setters = new Map();

export function Accessory({ message }) {
    const [translation, setTranslation] = useState();

    useEffect(() => {
        if ((message as any).vencordEmbeddedBy) return;

        setters.set(message.id, setTranslation);

        return () => void setters.delete(message.id);
    }, []);

    if (!translation) return null;

    return (
        <span className={cl("accessory")}>
            <Icon width={16} height={16} />
            {Parser.parse(translation.text)}
            {" "}
            (translated from {languages[translation.src] ?? translation.src} - <button onClick={() => setTranslation(undefined)} className={cl("dismiss")}>Dismiss</button>)
        </span>
    );
}

export async function handleTranslate(message) {
    setters.get(message.id)!(await translate(message.content));
}
