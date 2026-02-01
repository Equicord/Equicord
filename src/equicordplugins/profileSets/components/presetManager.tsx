/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openModal } from "@utils/modal";
import { Button, Forms, React, TextInput } from "@webpack/common";

import { settings } from "../index";
import { presets, setCurrentPresetIndex, currentPresetIndex } from "../utils/storage";
import { savePreset, importPresets, exportPresets } from "../utils/actions";
import { loadPresetAsPending, getCurrentProfile } from "../utils/profile";
import { PresetList } from "./presetList";
import { ConfirmModal } from "./confirmModal";

import "../styles.css";

const PRESETS_PER_PAGE = 5;

export function PresetManager({ guildId }: { guildId?: string }) {
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
        <Forms.FormSection className="vc-profile-presets-section">
            <Forms.FormTitle tag="h3" style={{ marginBottom: "8px", fontSize: "16px", fontWeight: 600 }}>
                Saved Profiles
            </Forms.FormTitle>

            <div style={{ marginBottom: "8px" }}>
                <TextInput
                    placeholder={searchMode ? "Search profiles..." : "Profile Name"}
                    value={presetName}
                    onChange={setPresetName}
                    style={{ width: "100%", maxWidth: "500px" }}
                />
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                {!searchMode && (
                    <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.BRAND}
                        disabled={isSaving || !presetName.trim()}
                        onClick={handleSavePreset}
                        style={{ minWidth: "120px" }}
                    >
                        {isSaving ? "Saving..." : "Save Profile"}
                    </Button>
                )}
                {hasPresets && (
                    <Button
                        size={Button.Sizes.SMALL}
                        color={searchMode ? Button.Colors.BRAND : Button.Colors.PRIMARY}
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
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", justifyContent: "center" }}>
                            <Button
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.PRIMARY}
                                disabled={currentPage === 1}
                                onClick={() => handlePageChange(currentPage - 1)}
                            >
                                ←
                            </Button>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <input
                                    type="text"
                                    value={pageInput}
                                    onChange={e => {
                                        const value = e.target.value;
                                        setPageInput(value);
                                        const num = parseInt(value);
                                        if (!isNaN(num) && num >= 1 && num <= totalPages) {
                                            setCurrentPage(num);
                                        }
                                    }}
                                    className="vc-preset-page-input"
                                />
                                <span style={{ fontSize: "14px", color: "var(--text-normal)", fontWeight: 500 }}>
                                    / {totalPages}
                                </span>
                            </div>
                            <Button
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.PRIMARY}
                                disabled={currentPage === totalPages}
                                onClick={() => handlePageChange(currentPage + 1)}
                            >
                                →
                            </Button>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                        <Button
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.PRIMARY}
                            onClick={() => importPresets(forceUpdate, showOverridePrompt)}
                        >
                            Import
                        </Button>
                        <Button
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.PRIMARY}
                            onClick={exportPresets}
                        >
                            Export All
                        </Button>
                    </div>

                    <Forms.FormDivider />
                </>
            )}
        </Forms.FormSection>
    );
}