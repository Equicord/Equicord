/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./ToggleButton.css";

import { Tooltip, useState } from "@webpack/common";

import { settings } from "../settings";
import { Icon } from "./Icon";
import { Button } from "@components/Button";


export const ToggleButton = () => {
    const [enabled, setEnabled] = useState(settings.store.notifyEnabled);
    const toggle = () => {
        settings.store.notifyEnabled = !enabled;
        setEnabled(!enabled);
    };

    return <Tooltip text={enabled ? "Disable Notify When Muted" : "Enable Notify When Muted"}>
        {({ onMouseEnter, onMouseLeave }) => (
            <Button size={"min"} variant="none" className={`toggleNotifyMuted`} onClick={toggle} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                <Icon enabled={enabled} />
            </Button>
        )}
    </Tooltip>;
};
