/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { classes } from "@utils/misc";
import { RenderModalProps } from "@vencord/discord-types";
import { Checkbox, Forms, Modal, React, ScrollerThin, showToast, Toasts } from "@webpack/common";

import { cl } from "../classNames";
import {
    applyPinnedThemesOnly,
    applyThemesWithPreset,
    getAvailableThemes,
    getLastPresetTheme,
    themeItemToBinding,
    type ThemeItem,
} from "../utils/themes";
import {
    isThemePinned,
    togglePinnedTheme,
} from "../utils/themeBindings";

function PinnedThemeRow({
    theme,
    checked,
    onToggle,
}: {
    theme: ThemeItem;
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <div
            className={classes(
                cl("pinned-theme-row"),
                checked ? cl("pinned-theme-row-active") : ""
            )}
        >
            <Checkbox
                value={checked}
                onChange={(_event, value) => {
                    if (value !== checked) onToggle();
                }}
                type="row"
            >
                <span className={cl("pinned-theme-row-content")}>
                    <span className={cl("pinned-theme-name")}>{theme.name}</span>
                    <span className={cl("pinned-theme-type")}>{theme.type}</span>
                </span>
            </Checkbox>
        </div>
    );
}

function ThemeGroup({ title, themes, onToggle }: {
    title: string;
    themes: ThemeItem[];
    onToggle: (theme: ThemeItem) => void;
}) {
    if (!themes.length) return null;

    return (
        <section className={cl("pinned-theme-group")}>
            <Forms.FormTitle tag="h5" className={cl("pinned-theme-group-title")}>
                {title}
            </Forms.FormTitle>
            <div className={cl("pinned-theme-list")}>
                {themes.map(theme => (
                    <PinnedThemeRow
                        key={`${theme.type}-${theme.id}`}
                        theme={theme}
                        checked={isThemePinned(themeItemToBinding(theme))}
                        onToggle={() => onToggle(theme)}
                    />
                ))}
            </div>
        </section>
    );
}

export function PinnedThemesModal({ onClose, ...props }: RenderModalProps) {
    const [themes, setThemes] = React.useState<ThemeItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    React.useEffect(() => {
        let active = true;
        getAvailableThemes()
            .then(list => {
                if (active) setThemes(list);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const refreshActiveThemes = () => {
        applyThemesWithPreset(getLastPresetTheme());
    };

    const toggle = (theme: ThemeItem) => {
        const binding = themeItemToBinding(theme);
        const added = togglePinnedTheme(binding);
        refreshActiveThemes();
        forceUpdate();
        showToast(
            added ? `Pinned "${theme.name}"` : `Unpinned "${theme.name}"`,
            Toasts.Type.MESSAGE
        );
    };

    const localThemes = themes.filter(t => t.type === "local");
    const onlineThemes = themes.filter(t => t.type === "online");

    return (
        <Modal
            {...props}
            onClose={onClose}
            size="md"
            title="Pinned themes"
        >
            <Paragraph className={cl("pinned-theme-intro")}>
                Pinned themes always stay enabled. Loading a preset adds its assigned theme on top.
            </Paragraph>
            {loading ? (
                <Paragraph>Loading themes…</Paragraph>
            ) : themes.length === 0 ? (
                <Paragraph>No themes found. Add themes in Equicord Settings → Themes.</Paragraph>
            ) : (
                <ScrollerThin className={cl("pinned-theme-scroller")}>
                    <div className={cl("pinned-theme-scroll-inner")}>
                        <ThemeGroup title="Local themes" themes={localThemes} onToggle={toggle} />
                        <ThemeGroup title="Online themes" themes={onlineThemes} onToggle={toggle} />
                    </div>
                </ScrollerThin>
            )}
            <div className={cl("pinned-theme-actions")}>
                <Button
                    variant="secondary"
                    onClick={() => {
                        applyPinnedThemesOnly();
                        onClose();
                    }}
                >
                    Apply pinned only
                </Button>
            </div>
        </Modal>
    );
}
