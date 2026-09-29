/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "@webpack/common";

const listeners = new Set<() => void>();
let compressing = 0;

function notify() {
    for (const listener of listeners) listener();
}

export function beginCompressing() {
    compressing++;
    notify();
}

export function endCompressing() {
    compressing = Math.max(0, compressing - 1);
    notify();
}

export function useCompressing() {
    const [busy, setBusy] = useState(compressing > 0);

    useEffect(() => {
        const update = () => setBusy(compressing > 0);
        listeners.add(update);
        update();

        return () => void listeners.delete(update);
    }, []);

    return busy;
}
