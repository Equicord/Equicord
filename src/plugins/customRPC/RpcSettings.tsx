/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./settings.css";

import { isPluginEnabled } from "@api/PluginManager";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { resolveError } from "@components/settings/tabs/plugins/components/Common";
import { debounce } from "@shared/debounce";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/translation";
import { ActivityType } from "@vencord/discord-types/enums";
import { Select, Text, TextInput, useState } from "@webpack/common";

import CustomRPCPlugin, { setRpc, settings, TimestampMode } from ".";

const cl = classNameFactory("vc-customRPC-settings-");

type SettingsKey = keyof typeof settings.store;

interface TextOption<T> {
    settingsKey: SettingsKey;
    label: string;
    disabled?: boolean;
    transform?: (value: string) => T;
    isValid?: (value: T) => true | string;
}

interface SelectOption<T> {
    settingsKey: SettingsKey;
    label: string;
    disabled?: boolean;
    options: { label: string; value: T; default?: boolean; }[];
}

const makeValidator = (maxLength: number, isRequired = false) => (value: string) => {
    if (isRequired && !value) return t("customRPC.validation.required");
    if (value.length > maxLength) return t("customRPC.validation.maxLength", { length: maxLength });
    return true;
};

const maxLength128 = makeValidator(128);

function isAppIdValid(value: string) {
    if (!/^\d{16,21}$/.test(value)) return t("customRPC.validation.discordId");
    return true;
}

const updateRPC = debounce(() => {
    setRpc(true);
    if (isPluginEnabled(CustomRPCPlugin.name)) setRpc();
});

function isStreamLinkDisabled() {
    return settings.store.type !== ActivityType.STREAMING;
}

function isStreamLinkValid(value: string) {
    if (!isStreamLinkDisabled() && !/https?:\/\/(www\.)?(twitch\.tv|youtube\.com)\/\w+/.test(value)) return t("customRPC.validation.streamingLink");
    if (value && value.length > 512) return t("customRPC.validation.streamingLinkLength");
    return true;
}

function parseNumber(value: string) {
    return value ? parseInt(value, 10) : 0;
}

function isNumberValid(value: number) {
    if (isNaN(value)) return t("customRPC.validation.number");
    if (value < 0) return t("customRPC.validation.positiveNumber");
    return true;
}

function isUrlValid(value: string) {
    if (value && !/^https?:\/\/.+/.test(value)) return t("customRPC.validation.url");
    return true;
}

function isImageKeyValid(value: string) {
    if (/https?:\/\/(cdn|media)\.discordapp\.(com|net)\//.test(value)) return t("customRPC.validation.discordLink");
    if (/https?:\/\/(?!i\.)?imgur\.com\//.test(value)) return t("customRPC.validation.imgurDirect");
    if (/https?:\/\/(?!media\.)?tenor\.com\//.test(value)) return t("customRPC.validation.tenorDirect");
    return true;
}

function PairSetting<T>(props: { data: [TextOption<T>, TextOption<T>]; }) {
    const [left, right] = props.data;

    return (
        <div className={cl("pair")}>
            <SingleSetting {...left} />
            <SingleSetting {...right} />
        </div>
    );
}

function SingleSetting<T>({ settingsKey, label, disabled, isValid, transform }: TextOption<T>) {
    const [state, setState] = useState(settings.store[settingsKey] ?? "");
    const [error, setError] = useState<string | null>(null);

    function handleChange(newValue: any) {
        if (transform) newValue = transform(newValue);

        const valid = isValid?.(newValue) ?? true;

        setState(newValue);
        setError(resolveError(valid));

        if (valid === true) {
            settings.store[settingsKey] = newValue;
            updateRPC();
        }
    }

    return (
        <div className={cl("single", { disabled })}>
            <Heading tag="h5">{label}</Heading>
            <TextInput
                type="text"
                placeholder={t("customRPC.placeholder.enterValue")}
                value={state}
                onChange={handleChange}
                disabled={disabled}
            />
            {error && <Text className={cl("error")} variant="text-sm/normal">{error}</Text>}
        </div>
    );
}

function SelectSetting<T>({ settingsKey, label, options, disabled }: SelectOption<T>) {
    return (
        <div className={cl("single", { disabled })}>
            <Heading tag="h5">{label}</Heading>
            <Select
                placeholder={t("customRPC.placeholder.selectOption")}
                options={options}
                maxVisibleItems={5}
                closeOnSelect={true}
                select={v => settings.store[settingsKey] = v}
                isSelected={v => v === settings.store[settingsKey]}
                serialize={v => String(v)}
                isDisabled={disabled}
            />
        </div>
    );
}

export function RPCSettings() {
    const s = settings.use();

    return (
        <div className={cl("root")}>
            <SelectSetting
                settingsKey="type"
                label={t("customRPC.activityType")}
                options={[
                    {
                        label: t("customRPC.activityTypes.playing"),
                        value: ActivityType.PLAYING,
                        default: true
                    },
                    {
                        label: t("customRPC.activityTypes.streaming"),
                        value: ActivityType.STREAMING
                    },
                    {
                        label: t("customRPC.activityTypes.listening"),
                        value: ActivityType.LISTENING
                    },
                    {
                        label: t("customRPC.activityTypes.watching"),
                        value: ActivityType.WATCHING
                    },
                    {
                        label: t("customRPC.activityTypes.competing"),
                        value: ActivityType.COMPETING
                    }
                ]}
            />

            <PairSetting data={[
                { settingsKey: "appID", label: t("customRPC.appId"), isValid: isAppIdValid },
                { settingsKey: "appName", label: t("customRPC.appName"), isValid: makeValidator(128, true) },
            ]} />

            <PairSetting data={[
                { settingsKey: "details", label: t("customRPC.detailLine1"), isValid: maxLength128 },
                { settingsKey: "detailsURL", label: t("customRPC.detailUrl"), isValid: isUrlValid },
            ]} />

            <PairSetting data={[
                { settingsKey: "state", label: t("customRPC.stateLine2"), isValid: maxLength128 },
                { settingsKey: "stateURL", label: t("customRPC.stateUrl"), isValid: isUrlValid },
            ]} />

            <SingleSetting
                settingsKey="streamLink"
                label={t("customRPC.streamLink")}
                disabled={s.type !== ActivityType.STREAMING}
                isValid={isStreamLinkValid}
            />

            <PairSetting data={[
                {
                    settingsKey: "partySize",
                    label: t("customRPC.partySize"),
                    transform: parseNumber,
                    isValid: isNumberValid,
                    disabled: s.type !== ActivityType.PLAYING,
                },
                {
                    settingsKey: "partyMaxSize",
                    label: t("customRPC.partyMaxSize"),
                    transform: parseNumber,
                    isValid: isNumberValid,
                    disabled: s.type !== ActivityType.PLAYING,
                },
            ]} />

            <Divider />

            <PairSetting data={[
                { settingsKey: "imageBig", label: t("customRPC.largeImageUrl"), isValid: isImageKeyValid },
                { settingsKey: "imageBigTooltip", label: t("customRPC.largeImageText"), isValid: maxLength128 },
            ]} />
            <SingleSetting settingsKey="imageBigURL" label={t("customRPC.largeImageClickUrl")} isValid={isUrlValid} />

            <PairSetting data={[
                { settingsKey: "imageSmall", label: t("customRPC.smallImageUrl"), isValid: isImageKeyValid },
                { settingsKey: "imageSmallTooltip", label: t("customRPC.smallImageText"), isValid: maxLength128 },
            ]} />
            <SingleSetting settingsKey="imageSmallURL" label={t("customRPC.smallImageClickUrl")} isValid={isUrlValid} />

            <Divider />

            <PairSetting data={[
                { settingsKey: "buttonOneText", label: t("customRPC.button1Text"), isValid: makeValidator(31) },
                { settingsKey: "buttonOneURL", label: t("customRPC.button1Url"), isValid: isUrlValid },
            ]} />
            <PairSetting data={[
                { settingsKey: "buttonTwoText", label: t("customRPC.button2Text"), isValid: makeValidator(31) },
                { settingsKey: "buttonTwoURL", label: t("customRPC.button2Url"), isValid: isUrlValid },
            ]} />

            <Divider />

            <SelectSetting
                settingsKey="timestampMode"
                label={t("customRPC.timestampMode")}
                options={[
                    {
                        label: t("customRPC.timestampModes.none"),
                        value: TimestampMode.NONE,
                        default: true
                    },
                    {
                        label: t("customRPC.timestampModes.sinceOpen"),
                        value: TimestampMode.NOW
                    },
                    {
                        label: t("customRPC.timestampModes.currentTime"),
                        value: TimestampMode.TIME
                    },
                    {
                        label: t("customRPC.timestampModes.custom"),
                        value: TimestampMode.CUSTOM
                    }
                ]}
            />

            <PairSetting data={[
                {
                    settingsKey: "startTime",
                    label: t("customRPC.startTimestamp"),
                    transform: parseNumber,
                    isValid: isNumberValid,
                    disabled: s.timestampMode !== TimestampMode.CUSTOM,
                },
                {
                    settingsKey: "endTime",
                    label: t("customRPC.endTimestamp"),
                    transform: parseNumber,
                    isValid: isNumberValid,
                    disabled: s.timestampMode !== TimestampMode.CUSTOM,
                },
            ]} />
        </div>
    );
}
