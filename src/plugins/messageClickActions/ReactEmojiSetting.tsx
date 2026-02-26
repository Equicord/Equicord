/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Heading } from "@components/Heading";
import type { IPluginOptionComponentProps } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { TextInput, useState } from "@webpack/common";

import { settings } from ".";

type EmojiData = {
    id?: string | null;
    name: string;
};

type EmojiSelectPayload = {
    id: string | null;
    name: string;
    animated?: boolean;
};

const StatusEmojiPicker = findComponentByCodeLazy("setCustomStatusEmoji", "setIsEmojiPickerOpen", "selectedDefaultStatus");
export const MAX_ADDITIONAL_REACT_EMOJIS = 8;

function getEmojiValue(emoji: EmojiData) {
    return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

function parseEmojiValue(value: string): EmojiSelectPayload | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const customEmoji = trimmed.match(/^:?([\w-]+):(\d+)$/);
    if (customEmoji) {
        return {
            id: customEmoji[2],
            name: customEmoji[1],
            animated: false
        };
    }

    return {
        id: null,
        name: trimmed,
        animated: false
    };
}

function parseEmojiList(value: string) {
    return Array.from(new Set(
        value
            .split(/[\n,]/g)
            .map(entry => entry.trim())
            .filter(Boolean)
    )).slice(0, MAX_ADDITIONAL_REACT_EMOJIS);
}

export function ReactEmojiSetting({ setValue }: IPluginOptionComponentProps) {
    const [emoji, setEmoji] = useState(settings.store.reactEmoji ?? "💀");
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    return (
        <div>
            <Heading>Select Emoji For Reactions</Heading>
            <div
                className="vc-message-click-actions-primary-emoji-picker"
                onClick={event => event.stopPropagation()}
                onMouseDown={event => event.stopPropagation()}
            >
                <StatusEmojiPicker
                    customStatusEmoji={parseEmojiValue(emoji)}
                    setCustomStatusEmoji={(selectedEmoji: EmojiSelectPayload | null) => {
                        if (!selectedEmoji) {
                            setEmoji("");
                            setValue("");
                            setIsEmojiPickerOpen(false);
                            return;
                        }

                        const value = getEmojiValue(selectedEmoji);
                        setEmoji(value);
                        setValue(value);
                        setIsEmojiPickerOpen(false);
                    }}
                    selectedDefaultStatus={isEmojiPickerOpen ? null : "online"}
                    setIsEmojiPickerOpen={setIsEmojiPickerOpen}
                    defaultStatusVariant="small"
                />
            </div>
        </div>
    );
}

export function AdditionalReactEmojisSetting({ setValue }: IPluginOptionComponentProps) {
    const { addAdditionalReacts } = settings.use(["addAdditionalReacts"]);
    const [emojiList, setEmojiList] = useState(settings.store.additionalReactEmojis ?? "");
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [pickerEmoji, setPickerEmoji] = useState<EmojiSelectPayload | null>(parseEmojiValue("😀"));

    if (!addAdditionalReacts) return null;

    return (
        <div>
            <Heading>Select Additional Emojis</Heading>
            <div
                style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    maxWidth: 420
                }}
            >
                <TextInput
                    value={emojiList}
                    placeholder={`comma/newline separated, max ${MAX_ADDITIONAL_REACT_EMOJIS}`}
                    onChange={newValue => {
                        setEmojiList(newValue);
                        setValue(newValue);
                        const [first] = parseEmojiList(newValue);
                        setPickerEmoji(parseEmojiValue(first ?? "😀"));
                    }}
                    onClick={event => event.stopPropagation()}
                    onMouseDown={event => event.stopPropagation()}
                    style={{
                        flex: 1
                    }}
                />
                <div
                    onClick={event => event.stopPropagation()}
                    onMouseDown={event => event.stopPropagation()}
                    style={{
                        display: "inline-flex",
                        transform: "scale(1.2)",
                        transformOrigin: "center"
                    }}
                >
                    <StatusEmojiPicker
                        customStatusEmoji={pickerEmoji}
                        setCustomStatusEmoji={(selectedEmoji: EmojiSelectPayload | null) => {
                            if (!selectedEmoji) {
                                setIsEmojiPickerOpen(false);
                                return;
                            }

                            const value = getEmojiValue(selectedEmoji);
                            const parsed = parseEmojiList(emojiList);
                            const merged = parsed.includes(value)
                                ? parsed
                                : [...parsed, value].slice(0, MAX_ADDITIONAL_REACT_EMOJIS);
                            const nextValue = merged.join(", ");
                            setEmojiList(nextValue);
                            setValue(nextValue);
                            setPickerEmoji(selectedEmoji);
                            setIsEmojiPickerOpen(false);
                        }}
                        selectedDefaultStatus={isEmojiPickerOpen ? null : "online"}
                        setIsEmojiPickerOpen={setIsEmojiPickerOpen}
                        defaultStatusVariant="small"
                    />
                </div>
            </div>
        </div>
    );
}
