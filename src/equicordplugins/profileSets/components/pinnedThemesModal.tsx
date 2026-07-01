/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { classes } from "@utils/misc";
import { RenderModalProps } from "@vencord/discord-types";
import { Forms, Modal, React, ScrollerThin, showToast, Toasts } from "@webpack/common";

import { cl } from "../classNames";
import {
    getPinnedThemes,
    pinnedThemeKey,
    togglePinnedTheme,
} from "../utils/themeBindings";
import {
    applyPinnedThemesOnly,
    applyThemesWithPreset,
    getAvailableThemes,
    getLastPresetTheme,
    type ThemeItem,
    themeItemToBinding,
} from "../utils/themes";

function PinnedThemeCheck({ checked }: { checked: boolean; }) {
    return (
        <span className={cl("pinned-theme-check")} aria-hidden="true">
            {checked ? (
                <svg className={cl("pinned-theme-check-icon")} viewBox="0 0 16 16">
                    <path
                        d="M3.5 8.2 6.4 11 12.5 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            ) : null}
        </span>
    );
}

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
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            className={classes(
                cl("pinned-theme-row"),
                checked ? cl("pinned-theme-row-active") : ""
            )}
            onClick={onToggle}
        >
            <PinnedThemeCheck checked={checked} />
            <span className={cl("pinned-theme-row-content")}>
                <span className={cl("pinned-theme-name")}>{theme.name}</span>
                <span className={cl("pinned-theme-type")}>{theme.type}</span>
            </span>
        </button>
    );
}

function ThemeGroup({
    title,
    themes,
    pinnedKeys,
    onToggle,
}: {
    title: string;
    themes: ThemeItem[];
    pinnedKeys: Set<string>;
    onToggle: (theme: ThemeItem) => void;
}) {
    if (!themes.length) return null;

    return (
        <section className={cl("pinned-theme-group")}>
            <Forms.FormTitle tag="h5" className={cl("pinned-theme-group-title")}>
                {title}
            </Forms.FormTitle>
            <div className={cl("pinned-theme-list")}>
                {themes.map(theme => {
                    const key = pinnedThemeKey(themeItemToBinding(theme));
                    return (
                        <PinnedThemeRow
                            key={key}
                            theme={theme}
                            checked={pinnedKeys.has(key)}
                            onToggle={() => onToggle(theme)}
                        />
                    );
                })}
            </div>
        </section>
    );
}

export function PinnedThemesModal({ onClose, ...props }: RenderModalProps) {
    const [themes, setThemes] = React.useState<ThemeItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [pinTick, setPinTick] = React.useState(0);

    React.useEffect(() => {
        let active = true;
        getAvailableThemes()
            .then(list => {
                if (!active) return;
                setThemes(list);
                setLoadError(null);
            })
            .catch(() => {
                if (!active) return;
                setLoadError("Failed to load themes.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const pinnedKeys = React.useMemo(
        () => new Set(getPinnedThemes().map(pinnedThemeKey)),
        [pinTick]
    );

    const { localThemes, onlineThemes } = React.useMemo(() => ({
        localThemes: themes.filter(t => t.type === "local"),
        onlineThemes: themes.filter(t => t.type === "online"),
    }), [themes]);

    const toggle = (theme: ThemeItem) => {
        const binding = themeItemToBinding(theme);
        const added = togglePinnedTheme(binding);
        applyThemesWithPreset(getLastPresetTheme());
        setPinTick(tick => tick + 1);
        showToast(
            added ? `Pinned "${theme.name}"` : `Unpinned "${theme.name}"`,
            Toasts.Type.MESSAGE
        );
    };

    return (
        <Modal
            {...props}
            onClose={onClose}
            size="sm"
            title="Pinned themes"
        >
            <div className={cl("pinned-theme-modal")}>
                <Paragraph className={cl("pinned-theme-intro")}>
                    Pinned themes always stay enabled. Loading a preset adds its assigned theme on top.
                </Paragraph>
                {loading ? (
                    <Paragraph>Loading themes…</Paragraph>
                ) : loadError ? (
                    <Paragraph>{loadError}</Paragraph>
                ) : themes.length === 0 ? (
                    <Paragraph>No themes found. Add themes in Equicord Settings → Themes.</Paragraph>
                ) : (
                    <ScrollerThin className={cl("pinned-theme-scroller")}>
                        <div className={cl("pinned-theme-scroll-inner")}>
                            <ThemeGroup
                                title="Local themes"
                                themes={localThemes}
                                pinnedKeys={pinnedKeys}
                                onToggle={toggle}
                            />
                            <ThemeGroup
                                title="Online themes"
                                themes={onlineThemes}
                                pinnedKeys={pinnedKeys}
                                onToggle={toggle}
                            />
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
            </div>
        </Modal>
    );
}
