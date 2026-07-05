/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { classes } from "@utils/misc";
import { React, openModal, SelectedGuildStore, TextInput, useStateFromStores } from "@webpack/common";

import { cl } from "../classNames";
import { settings } from "../settings";
import { exportPresets, ImportDecision, importPresets, savePreset } from "../utils/actions";
import { getFolderById, getPresetsInFolder } from "../utils/folders";
import { loadPresetAsPending } from "../utils/profile";
import { PRESET_NAME_MAX_LENGTH } from "../utils/sanitize";
import { folders, getStoreRevision, loadPresets, presets, PresetSection, setCurrentPresetIndex } from "../utils/storage";
import { ImportProfilesModal } from "./confirmModal";
import { FolderBreadcrumb } from "./folderBreadcrumb";
import { FolderList } from "./folderList";
import { PresetList } from "./presetList";

const PRESETS_PER_PAGE = 7;
const SETTINGS_KEYS = ["avatarSize"] as const;

type PresetManagerProps = {
    section: PresetSection;
    guildId?: string;
    hideHeading?: boolean;
    activeFolderId: string | null;
    setActiveFolderId: (folderId: string | null) => void;
    searchMode: boolean;
    setSearchMode: (searchMode: boolean) => void;
    onStoreChange?: () => void;
};

export function PresetManager({
    section,
    guildId,
    hideHeading,
    activeFolderId,
    setActiveFolderId,
    searchMode,
    setSearchMode,
    onStoreChange,
}: PresetManagerProps) {
    const [presetName, setPresetName] = React.useState("");
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [isSaving, setIsSaving] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageInput, setPageInput] = React.useState("1");
    const [selectedPreset, setSelectedPreset] = React.useState<number>(-1);
    const isServerSection = section === "server";
    const lastSelectedGuildId = useStateFromStores(
        [SelectedGuildStore],
        () => SelectedGuildStore.getLastSelectedGuildId() ?? SelectedGuildStore.getGuildId()
    );
    const resolvedGuildId = isServerSection ? (guildId ?? lastSelectedGuildId ?? undefined) : undefined;
    const canUseGuild = !isServerSection || Boolean(resolvedGuildId);
    const activeFolder = activeFolderId ? getFolderById(folders, activeFolderId) : null;
    const storeRevision = getStoreRevision();

    const notifyUpdate = () => {
        forceUpdate();
        onStoreChange?.();
    };

    React.useEffect(() => {
        let isActive = true;
        (async () => {
            await loadPresets(section);
            if (!isActive) return;
            setSelectedPreset(-1);
            setCurrentPage(1);
            setPageInput("1");
            notifyUpdate();
        })();
        return () => {
            isActive = false;
        };
    }, [section]);

    React.useEffect(() => {
        if (activeFolderId && !getFolderById(folders, activeFolderId)) {
            setActiveFolderId(null);
        }
    }, [activeFolderId, storeRevision, setActiveFolderId]);

    const visiblePresets = searchMode
        ? presets.filter(preset => preset.name.toLowerCase().includes(presetName.toLowerCase()))
        : getPresetsInFolder(presets, activeFolderId);

    const totalPages = Math.max(1, Math.ceil(visiblePresets.length / PRESETS_PER_PAGE));

    React.useEffect(() => {
        if (visiblePresets.length === 0) {
            if (currentPage !== 1) {
                setCurrentPage(1);
                setPageInput("1");
            }
            return;
        }
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
            setPageInput(String(totalPages));
        }
    }, [visiblePresets.length, totalPages, currentPage]);
    const startIndex = (currentPage - 1) * PRESETS_PER_PAGE;
    const currentPresets = visiblePresets.slice(startIndex, startIndex + PRESETS_PER_PAGE);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            setPageInput(String(newPage));
        }
    };

    const handleSavePreset = async () => {
        if (!canUseGuild) return;
        const trimmedName = presetName.trim();
        if (!trimmedName) return;
        setIsSaving(true);
        await savePreset(trimmedName, section, resolvedGuildId, activeFolderId);
        setPresetName("");
        setIsSaving(false);
        const newTotalPages = Math.max(1, Math.ceil(getPresetsInFolder(presets, activeFolderId).length / PRESETS_PER_PAGE));
        handlePageChange(newTotalPages);
        notifyUpdate();
    };

    const applyInFlightRef = React.useRef(false);

    const applyPreset = async (index: number) => {
        if (applyInFlightRef.current) return;
        applyInFlightRef.current = true;
        try {
            setSelectedPreset(index);
            setCurrentPresetIndex(index);
            await loadPresetAsPending(presets[index], resolvedGuildId, {
                isGuildProfile: section === "server"
            });
            notifyUpdate();
        } finally {
            applyInFlightRef.current = false;
        }
    };

    const handleLoadPreset = (index: number) => {
        if (!canUseGuild) return;
        applyPreset(index);
    };

    const showImportPrompt = (existingPresets: number, existingFolders: number): Promise<ImportDecision> => {
        return new Promise(resolve => {
            openModal(props => (
                <ImportProfilesModal
                    {...props}
                    title="Import Profiles"
                    message={`You have ${existingPresets} profiles and ${existingFolders} folders in this section. Override them or merge with the import?`}
                    onOverride={() => resolve("override")}
                    onMerge={() => resolve("merge")}
                    onCancel={() => resolve("cancel")}
                />
            ));
        });
    };

    const { avatarSize } = settings.use(SETTINGS_KEYS);
    const hasPresets = visiblePresets.length > 0;
    const shouldShowPagination = visiblePresets.length > PRESETS_PER_PAGE;
    const showFolderUi = !searchMode && activeFolderId == null;
    const saveTargetLabel = activeFolder ? `Save to ${activeFolder.name}` : "Save Profile";

    return (
        <div className={classes(cl("section"), isServerSection ? cl("section-server") : "")} >
            {!hideHeading && (
                <Heading tag="h3" className={cl("heading")}>
                    Saved Profiles
                </Heading>
            )}

            {activeFolder && (
                <FolderBreadcrumb
                    folderName={activeFolder.name}
                    onNavigateRoot={() => {
                        setActiveFolderId(null);
                        handlePageChange(1);
                    }}
                />
            )}

            {showFolderUi && (
                <FolderList
                    section={section}
                    guildId={resolvedGuildId}
                    onOpenFolder={folderId => {
                        setActiveFolderId(folderId);
                        handlePageChange(1);
                    }}
                    onUpdate={notifyUpdate}
                />
            )}

            <div className={cl("text")}>
                <TextInput
                    placeholder={searchMode ? "Search profiles..." : "Profile Name"}
                    value={presetName}
                    onChange={setPresetName}
                    maxLength={searchMode ? undefined : PRESET_NAME_MAX_LENGTH}
                    className={cl("text-input")}
                />
            </div>

            <div className={cl("search")}>
                {!searchMode && (
                    <Button
                        size="small"
                        disabled={isSaving || !presetName.trim() || !canUseGuild}
                        onClick={handleSavePreset}
                        className={cl("search-button")}
                    >
                        {isSaving ? "Saving..." : saveTargetLabel}
                    </Button>
                )}
                {presets.length > 0 && (
                    <Button
                        size="small"
                        variant={searchMode ? "primary" : "secondary"}
                        onClick={() => {
                            const nextSearchMode = !searchMode;
                            setSearchMode(nextSearchMode);
                            setPresetName("");
                            if (nextSearchMode) setActiveFolderId(null);
                            handlePageChange(1);
                        }}
                    >
                        {searchMode ? "Cancel Search" : "Search"}
                    </Button>
                )}
                {hasPresets && shouldShowPagination && (
                    <div className={cl("pagination")}>
                        <Button
                            size="min"
                            variant="secondary"
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            aria-label="Previous page"
                            className={cl("page-nav")}
                        >
                            ←
                        </Button>
                        <div className={cl("page")}>
                            <input
                                type="text"
                                inputMode="numeric"
                                size={Math.max(1, String(totalPages).length)}
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
                                /{totalPages}
                            </span>
                        </div>
                        <Button
                            size="min"
                            variant="secondary"
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            aria-label="Next page"
                            className={cl("page-nav")}
                        >
                            →
                        </Button>
                    </div>
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
                        onUpdate={notifyUpdate}
                        guildId={resolvedGuildId}
                        section={section}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                    />

                    <hr className={cl("block")} />
                </>
            )}

            {activeFolderId == null && (
                <>
                    <div className={cl("import")}>
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={() => importPresets(
                                notifyUpdate,
                                count => showImportPrompt(count, folders.length),
                                section,
                                resolvedGuildId
                            )}
                            disabled={!canUseGuild}
                        >
                            Import
                        </Button>
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={() => exportPresets(section)}
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
