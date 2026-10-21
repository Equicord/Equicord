/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { DeleteCacheButton } from "./components/DeleteCacheButton";
import { cl } from "./utils/misc";

const MODEL_SIZES: Record<string, { quantized: string; full: string; gpu: string; }> = {
    "onnx-community/whisper-tiny": { quantized: "~40 MB", full: "~150 MB", gpu: "~75 MB" },
    "onnx-community/whisper-base": { quantized: "~77 MB", full: "~290 MB", gpu: "~145 MB" },
    "onnx-community/whisper-small": { quantized: "~250 MB", full: "~970 MB", gpu: "~490 MB" },
    "onnx-community/whisper-large-v3-turbo": { quantized: "~1.1 GB", full: "~3.2 GB", gpu: "~1.6 GB" },
};

const LEGACY_MODELS: Record<string, string> = {
    "Xenova/whisper-tiny": "onnx-community/whisper-tiny",
    "Xenova/whisper-base": "onnx-community/whisper-base",
    "Xenova/whisper-small": "onnx-community/whisper-small",
    "Xenova/whisper-medium": "onnx-community/whisper-large-v3-turbo",
};

export function migrateLegacyModel() {
    const migrated = LEGACY_MODELS[settings.store.selectedModel];
    if (migrated) settings.store.selectedModel = migrated;
}

function renderModelOption(option?: { label: string; value: string; }) {
    if (!option) return null;
    return <ModelOption option={option} />;
}

function ModelOption({ option }: { option: { label: string; value: string; }; }) {
    const { quantized, useGpu } = settings.use(["quantized", "useGpu"]);
    const size = MODEL_SIZES[option.value]?.[useGpu ? "gpu" : quantized ? "quantized" : "full"];

    return (
        <div className={cl("model-option")}>
            <span>{option.label}</span>
            {size && (
                <span className={cl("model-size")}>
                    {size}
                </span>
            )}
        </div>
    );
}

export const settings = definePluginSettings({
    embed: {
        type: OptionType.BOOLEAN,
        description: "Display transcription directly in the voice message attachment instead of a modal.",
        default: false,
        restartNeeded: false
    },
    maintainHorizontal: {
        type: OptionType.BOOLEAN,
        description: "Maintain horizontal size for the embedded transcription box and expand vertically.",
        default: false,
        restartNeeded: false
    },
    selectedModel: {
        type: OptionType.SELECT,
        description: "Model size.",
        options: [
            {
                label: "Tiny (Fastest, lowest accuracy)",
                value: "onnx-community/whisper-tiny",
            },
            {
                label: "Base (Recommended)",
                value: "onnx-community/whisper-base",
                default: true
            },
            {
                label: "Small",
                value: "onnx-community/whisper-small"
            },
            {
                label: "Large v3 Turbo (Best accuracy, GPU recommended)",
                value: "onnx-community/whisper-large-v3-turbo"
            }
        ],
        componentProps: {
            renderOptionLabel: (option: { label: string; value: string; }) => renderModelOption(option),
            renderOptionValue: (options: { label: string; value: string; }[]) => renderModelOption(options?.[0]),
        },
        restartNeeded: false
    },
    useGpu: {
        type: OptionType.BOOLEAN,
        description: "Run the model on your GPU (WebGPU) when supported. Much faster, and makes the larger models usable. Falls back to CPU if unavailable.",
        default: true,
        restartNeeded: false
    },
    quantized: {
        type: OptionType.BOOLEAN,
        description: "Use quantized models when running on CPU (smaller size, slight quality loss).",
        default: true,
        restartNeeded: false
    },
    deleteModalFiles: {
        type: OptionType.COMPONENT,
        description: "Delete cached files from storage.",
        component: DeleteCacheButton
    }
});
