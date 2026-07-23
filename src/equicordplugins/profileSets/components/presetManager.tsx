/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { classes } from "@utils/misc";
import { openModal, React, showToast, TextInput, Toasts } from "@webpack/common";

import { cl, settings } from "../index";
import { exportPresets, ImportDecision, importPresets, savePreset } from "../utils/actions";
import { loadPresetAsPending } from "../utils/profile";
import { loadPresets, presets, setCurrentPresetIndex } from "../utils/storage";
import { ImportProfilesModal } from "./confirmModal";
import { PresetList } from "./presetList";

const PRESETS_PER_PAGE = 5;

export function PresetManager({ userId }: { userId: string; }) {
    const [presetName, setPresetName] = React.useState("");
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [isSaving, setIsSaving] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageInput, setPageInput] = React.useState("1");
    const [selectedPreset, setSelectedPreset] = React.useState<number>(-1);
    const [searchMode, setSearchMode] = React.useState(false);
    const lastRandomIndexRef = React.useRef<number>(-1);
    const generationRef = React.useRef(0);

    React.useEffect(() => {
        let isActive = true;
        (async () => {
            await loadPresets();
            if (!isActive) return;
            setSelectedPreset(-1);
            setCurrentPage(1);
            setPageInput("1");
            forceUpdate();
        })();
        return () => { isActive = false; };
    }, [userId]);

    const filteredPresets = !searchMode
        ? presets
        : presets.filter(preset => preset.name.toLowerCase().includes(presetName.toLowerCase()));

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
        const trimmedName = presetName.trim();
        if (!trimmedName) return;
        setIsSaving(true);
        try {
            await savePreset(trimmedName);
            setPresetName("");
            const newTotalPages = Math.ceil(presets.length / PRESETS_PER_PAGE);
            handlePageChange(newTotalPages);
            forceUpdate();
        } catch (err) {
            showToast("Failed to save profile.", Toasts.Type.FAILURE);
        } finally {
            setIsSaving(false);
        }
    };

    const applyPreset = (index: number) => {
        setSelectedPreset(index);
        setCurrentPresetIndex(index);
        const gen = ++generationRef.current;
        loadPresetAsPending(presets[index], { generation: generationRef }).then(() => {
            if (generationRef.current !== gen) return;
            showToast("Preset applied. Review and save in Settings.", Toasts.Type.SUCCESS);
        }).catch(() => {
            if (generationRef.current !== gen) return;
            showToast("Failed to load profile preset.", Toasts.Type.FAILURE);
        });
        forceUpdate();
    };

    const handleLoadPreset = (index: number) => {
        applyPreset(index);
    };

    const handleRandomPreset = () => {
        if (!presets.length) return;
        let nextIndex = Math.floor(Math.random() * presets.length);
        if (presets.length > 1 && nextIndex === lastRandomIndexRef.current) {
            let attempts = 0;
            while (attempts < 5 && nextIndex === lastRandomIndexRef.current) {
                nextIndex = Math.floor(Math.random() * presets.length);
                attempts++;
            }
        }
        lastRandomIndexRef.current = nextIndex;
        applyPreset(nextIndex);
    };

    const showImportPrompt = (existingCount: number): Promise<ImportDecision> => {
        return new Promise(resolve => {
            openModal(props => (
                <ImportProfilesModal
                    {...props}
                    title="Import Profiles"
                    message={`You have ${existingCount} existing profiles. Do you want to override them or merge with imported profiles?`}
                    onOverride={() => resolve("override")}
                    onMerge={() => resolve("merge")}
                    onCancel={() => resolve("cancel")}
                />
            ));
        });
    };

    const { avatarSize } = settings.store;
    const hasPresets = presets.length > 0;
    const shouldShowPagination = filteredPresets.length > PRESETS_PER_PAGE;

    return (
        <div className={cl("section")}>
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
                <Button
                    size="small"
                    variant="secondary"
                    onClick={handleRandomPreset}
                    disabled={!presets.length}
                >
                    Random
                </Button>
                <Button
                    size="small"
                    variant="secondary"
                    onClick={() => importPresets(forceUpdate, showImportPrompt)}
                >
                    Import
                </Button>
                <Button
                    size="small"
                    variant="secondary"
                    onClick={() => exportPresets()}
                >
                    Export All
                </Button>
            </div>

            {hasPresets && (
                <>
                    <PresetList
                        presets={currentPresets}
                        allPresets={presets}
                        avatarSize={avatarSize}
                        selectedPreset={selectedPreset}
                        onLoad={handleLoadPreset}
                        onUpdate={() => {
                            const newTotal = Math.ceil(presets.length / PRESETS_PER_PAGE);
                            if (newTotal === 0) {
                                handlePageChange(1);
                            } else if (currentPage > newTotal) {
                                handlePageChange(newTotal);
                            }
                            forceUpdate();
                        }}
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
                                        const num = Number(value);
                                        if (Number.isInteger(num) && num >= 1 && num <= totalPages) {
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

                    <hr className={cl("block")} />
                </>
            )}
            <hr className={cl("block")} />
        </div>
    );
}
