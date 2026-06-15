/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { React, Tooltip, openModal } from "@webpack/common";

import { cl } from "../classNames";
import { getPinnedThemes } from "../utils/themeBindings";
import { PinnedThemesModal } from "./pinnedThemesModal";

export function PinnedThemesControl() {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    const pinned = getPinnedThemes();
    const count = pinned.length;
    const subtitle = count === 0
        ? "None pinned"
        : count === 1
            ? pinned[0].themeName ?? pinned[0].themeId
            : `${count} themes pinned`;

    const open = () => {
        openModal(props => (
            <PinnedThemesModal
                {...props}
                onClose={() => {
                    props.onClose();
                    forceUpdate();
                }}
            />
        ));
    };

    return (
        <Tooltip text="Choose themes that always stay enabled, even when switching profile presets.">
            {({ onMouseEnter, onMouseLeave }) => (
                <div className={cl("pinned-themes")} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                    <Button size="small" variant="secondary" onClick={open}>
                        <div className={cl("pinned-themes-inner")}>
                            <span className={cl("pinned-themes-title")}>Pinned themes</span>
                            <span className={cl("pinned-themes-subtitle")}>{subtitle}</span>
                        </div>
                    </Button>
                </div>
            )}
        </Tooltip>
    );
}
