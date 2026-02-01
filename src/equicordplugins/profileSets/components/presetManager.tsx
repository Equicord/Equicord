/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Heading } from "@components/Heading";
import { Button } from "@components/index";
import { openModal } from "@utils/modal";
import { React, TextInput } from "@webpack/common";

import { cl, settings } from "../index";
import { exportPresets, importPresets, savePreset } from "../utils/actions";
import { loadPresetAsPending } from "../utils/profile";
import { presets, setCurrentPresetIndex } from "../utils/storage";
import { ConfirmModal } from "./confirmModal";
import { PresetList } from "./presetList";

const PRESETS_PER_PAGE = 5;

export function PresetManager({ guildId }: { guildId?: string; }) {
    const [presetName, setPresetName] = React.useState("");
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [isSaving, setIsSaving] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageInput, setPageInput] = React.useState("1");
    const [selectedPreset, setSelectedPreset] = React.useState<number>(-1);
    const [searchMode, setSearchMode] = React.useState(false);

    const filteredPresets = searchMode
        ? presets.filter(p => p.name.toLowerCase().includes(presetName.toLowerCase()))
        : presets;

    const totalPages = Math.ceil(filteredPresets.length / PRESETS_PER_PAGE);
    const startIndex = (currentPage - 1) * PRESETS_PER_PAGE;
    const currentPresets = filteredPresets.slice(startIndex, startIndex + PRESETS_PER_PAGE);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            setPageInput(String(newPage));
        }
    };

    const handleSavePreset = async () => {
        if (!presetName.trim()) return;
        setIsSaving(true);
        await savePreset(presetName.trim(), guildId);
        setPresetName("");
        setIsSaving(false);
        const newTotalPages = Math.ceil(presets.length / PRESETS_PER_PAGE);
        handlePageChange(newTotalPages);
        forceUpdate();
    };

    const handleLoadPreset = (index: number) => {
        setSelectedPreset(index);
        setCurrentPresetIndex(index);
        loadPresetAsPending(presets[index], guildId);
        forceUpdate();
    };

    const showOverridePrompt = (): Promise<boolean> => {
        return new Promise(resolve => {
            openModal(props => (
                <ConfirmModal
                    {...props}
                    title="Override Existing Presets?"
                    message="Some imported profiles match existing ones. Do you want to override all profiles or combine them?"
                    confirmText="Override"
                    cancelText="Combine"
                    onConfirm={() => resolve(true)}
                    onCancel={() => resolve(false)}
                />
            ));
        });
    };

    const avatarSize = settings.store.avatarSize || 40;
    const hasPresets = presets.length > 0;
    const shouldShowPagination = filteredPresets.length > PRESETS_PER_PAGE;

    return (
        <div className={cl("section")} >
            <Heading tag="h3" className={cl("heading")}>
                Saved Profiles
            </Heading>

            <div className={cl("text")}>
                <TextInput
                    placeholder={searchMode ? "Search profiles..." : "Profile Name"}
                    value={presetName}
                    onChange={setPresetName}
                    className={cl("text-input")}
                />
            </div>

            <div className={cl("search")}>
                {!searchMode && (
                    <Button
                        size="small"
                        disabled={isSaving || !presetName.trim()}
                        onClick={handleSavePreset}
                        className={cl("search-button")}
                    >
                        {isSaving ? "Saving..." : "Save Profile"}
                    </Button>
                )}
                {hasPresets && (
                    <Button
                        size="small"
                        variant={searchMode ? "primary" : "secondary"}
                        onClick={() => {
                            setSearchMode(!searchMode);
                            handlePageChange(1);
                        }}
                    >
                        {searchMode ? "Cancel Search" : "Search"}
                    </Button>
                )}
            </div>

            {hasPresets && (
                <>
                    <PresetList
                        presets={currentPresets}
                        allPresets={presets}
                        avatarSize={avatarSize}
                        selectedPreset={selectedPreset}
                        onLoad={handleLoadPreset}
                        onUpdate={forceUpdate}
                        guildId={guildId}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                    />

                    {shouldShowPagination && (
                        <div className={cl("pagination")}>
                            <Button
                                size="small"
                                variant="secondary"
                                disabled={currentPage === 1}
                                onClick={() => handlePageChange(currentPage - 1)}
                            >
                                ←
                            </Button>
                            <div className={cl("page")}>
                                <input
                                    type="text"
                                    value={pageInput}
                                    onChange={e => {
                                        const { value } = e.target;
                                        setPageInput(value);
                                        const num = parseInt(value);
                                        if (!isNaN(num) && num >= 1 && num <= totalPages) {
                                            setCurrentPage(num);
                                        }
                                    }}
                                    className={cl("page-input")}
                                />
                                <span className={cl("page-of")}>
                                    / {totalPages}
                                </span>
                            </div>
                            <Button
                                size="small"
                                variant="secondary"
                                disabled={currentPage === totalPages}
                                onClick={() => handlePageChange(currentPage + 1)}
                            >
                                →
                            </Button>
                        </div>
                    )}

                    <div className={cl("import")}>
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={() => importPresets(forceUpdate, showOverridePrompt)}
                        >
                            Import
                        </Button>
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={exportPresets}
                        >
                            Export All
                        </Button>
                    </div>

                    <hr className={cl("block")} />
                </>
            )}
        </div>
    );
}
