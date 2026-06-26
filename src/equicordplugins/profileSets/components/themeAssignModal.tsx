/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, React, ScrollerThin, showToast, Toasts } from "@webpack/common";

import type { PresetSection } from "../utils/storage";
import {
    bindingKey,
    getBinding,
    setBinding,
} from "../utils/themeBindings";
import {
    applyPinnedThemesOnly,
    applyThemesWithPreset,
    getAvailableThemes,
    type ThemeItem,
    themeItemToBinding,
} from "../utils/themes";

export type ThemeAssignTarget = {
    presetName: string;
    section: PresetSection;
    guildId?: string;
};

type ThemeAssignModalProps = RenderModalProps & ThemeAssignTarget;

export function openThemeAssignModal(target: ThemeAssignTarget) {
    openModal(props => (
        <ThemeAssignModal
            {...props}
            {...target}
        />
    ));
}

export function getThemeMenuLabel(target: ThemeAssignTarget) {
    const assigned = getBinding(bindingKey(target.section, target.guildId, target.presetName));
    if (!assigned) return "Assign Equicord theme…";
    return `Equicord theme: ${assigned.themeName ?? assigned.themeId}`;
}

export function ThemeAssignModal({
    presetName,
    section,
    guildId,
    onClose,
    ...props
}: ThemeAssignModalProps) {
    const [themes, setThemes] = React.useState<ThemeItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const key = bindingKey(section, guildId, presetName);
    const assigned = getBinding(key);

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

    const assign = (theme: ThemeItem | null, preview = false) => {
        if (theme == null) {
            setBinding(key, null);
            applyPinnedThemesOnly();
            showToast("Theme binding removed", Toasts.Type.MESSAGE);
            onClose();
            return;
        }

        const binding = themeItemToBinding(theme);
        if (preview) {
            applyThemesWithPreset(binding);
            showToast(`Previewing "${binding.themeName}"`, Toasts.Type.MESSAGE);
            return;
        }

        setBinding(key, binding);
        showToast(`Assigned "${binding.themeName}" to ${presetName}`, Toasts.Type.SUCCESS);
        onClose();
    };

    const dismiss = () => {
        applyThemesWithPreset(assigned);
        onClose();
    };

    const localThemes = themes.filter(t => t.type === "local");
    const onlineThemes = themes.filter(t => t.type === "online");

    return (
        <Modal
            {...props}
            onClose={dismiss}
            size="md"
            title={`Equicord theme — ${presetName}`}
        >
            <Paragraph>
                {assigned
                    ? `Currently assigned: ${assigned.themeName ?? assigned.themeId}`
                    : "No theme assigned to this preset."}
            </Paragraph>
            {loading ? (
                <Paragraph>Loading themes…</Paragraph>
            ) : themes.length === 0 ? (
                <Paragraph>No themes found. Add themes in Equicord Settings → Themes.</Paragraph>
            ) : (
                <ScrollerThin style={{ maxHeight: 360, marginTop: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingRight: 8 }}>
                        <Button
                            variant="secondary"
                            onClick={() => assign(null)}
                        >
                            No theme (unbound)
                        </Button>
                        {assigned ? (
                            <Button
                                variant="primary"
                                onClick={() => {
                                    const theme = themes.find(
                                        t => t.type === assigned.type && t.id === assigned.themeId
                                    );
                                    if (theme) assign(theme, true);
                                }}
                            >
                                {`Preview: ${assigned.themeName ?? assigned.themeId}`}
                            </Button>
                        ) : null}
                        {localThemes.length > 0 ? (
                            <div style={{ fontWeight: 600, marginTop: 8 }}>Local themes</div>
                        ) : null}
                        {localThemes.map(theme => (
                            <Button
                                key={`local-${theme.id}`}
                                variant={assigned?.type === "local" && assigned.themeId === theme.id ? "primary" : "secondary"}
                                onClick={() => assign(theme)}
                            >
                                {theme.name}
                            </Button>
                        ))}
                        {onlineThemes.length > 0 ? (
                            <div style={{ fontWeight: 600, marginTop: 8 }}>Online themes</div>
                        ) : null}
                        {onlineThemes.map(theme => (
                            <Button
                                key={`online-${theme.id}`}
                                variant={assigned?.type === "online" && assigned.themeId === theme.id ? "primary" : "secondary"}
                                onClick={() => assign(theme)}
                            >
                                {theme.name}
                            </Button>
                        ))}
                    </div>
                </ScrollerThin>
            )}
        </Modal>
    );
}
