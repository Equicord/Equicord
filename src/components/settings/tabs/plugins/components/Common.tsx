/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { wordsFromCamel, wordsToTitle } from "@utils/text";
import { DefinedSettings, PluginSettingDefCommon } from "@utils/types";
import { PropsWithChildren } from "react";
import { t } from "@api/I18n";

export const cl = classNameFactory("vc-plugins-setting-");

interface SettingBaseProps<T> {
    setting: T;
    onChange(newValue: any): void;
    pluginSettings: {
        [setting: string]: any;
        enabled: boolean;
    };
    id: string;
    definedSettings: DefinedSettings;
    closePluginSettings(): void;
    translationPrefix?: string;
}

export type SettingProps<T extends PluginSettingDefCommon> = SettingBaseProps<T>;
export type ComponentSettingProps<T extends Omit<PluginSettingDefCommon, "description" | "placeholder">> = SettingBaseProps<T>;

export function resolveError(isValidResult: boolean | string) {
    if (typeof isValidResult === "string") return isValidResult;

    return isValidResult ? null : "Invalid input provided";
}

interface SettingsSectionProps extends PropsWithChildren {
    name: string;
    description: string;
    error?: string | null;
    inlineSetting?: boolean;
    tag?: "label" | "div";
    settingId?: string;
    translationPrefix?: string;
}

export function SettingsSection({ tag: Tag = "div", name, description, error, inlineSetting, settingId, translationPrefix, children }: SettingsSectionProps) {
    const translatedDesc = translationPrefix && settingId
        ? t(`equicord.settings.${translationPrefix}.${settingId}`, description)
        : description;
    return (
        <Tag className={cl("section")}>
            <div className={classes(cl("content"), inlineSetting && cl("inline"))}>
                <div className={cl("label")}>
                    {name && <BaseText className={cl("title")} size="md" weight="medium">{wordsToTitle(wordsFromCamel(name))}</BaseText>}
                    {description && <BaseText className={cl("description")} size="sm">{translatedDesc}</BaseText>}
                </div>
                {children}
            </div>
            {error && <BaseText className={cl("error")} size="sm">{error}</BaseText>}
        </Tag>
    );
}
