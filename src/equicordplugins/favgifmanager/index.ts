/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { UserSettingsActionCreators, Toasts, openModal, Modal, React, useState, RestAPI, Checkbox, Alerts, Button as DiscordButton } from "@webpack/common";
import { Button } from "@components/Button";
import { BaseText as Text } from "@components/BaseText";

interface FavoriteGif {
    url: string;
    src?: string;
    width?: number;
    height?: number;
    format?: number;
}

interface FavoriteGifsSettings {
    gifs?: Record<string, Omit<FavoriteGif, "url">>;
}

const isValidGif = (gif: any): gif is FavoriteGif => {
    return typeof gif === "object" && gif !== null && typeof gif.url === "string" && gif.url.startsWith("http");
};



const exportGifs = () => {
    const gifs = UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue()?.favoriteGifs?.gifs;
    if (!gifs) return;
    
    const favorites = Object.entries(gifs).map(([url, gif]) => ({ url, ...(gif as Record<string, unknown>) })) as FavoriteGif[];
    
    openModal(modalProps => (
        <Modal
            {...modalProps}
            title="Export GIFs"
            subtitle={`Are you sure you want to export ${favorites.length} GIFs?`}
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: "Export",
                    variant: "primary",
                    onClick: async () => {
                        modalProps.onClose();
                        try {
                            const json = JSON.stringify(favorites, null, 2);
                            const now = new Date();
                            const dateStr = now.toISOString().split("T")[0];
                            const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
                            const filename = `favorite_gifs_${dateStr}_${timeStr}.json`;
                            
                            if (window.DiscordNative?.fileManager?.saveWithDialog) {
                                await window.DiscordNative.fileManager.saveWithDialog(json, filename);
                            } else {
                                const blob = new Blob([json], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = filename;
                                a.click();
                                URL.revokeObjectURL(url);
                            }

                            Toasts.show({
                                message: "GIFs exported successfully!",
                                type: Toasts.Type.SUCCESS,
                                id: Toasts.genId()
                            });
                        } catch {
                            Toasts.show({
                                message: "Export cancelled or failed.",
                                type: Toasts.Type.FAILURE,
                                id: Toasts.genId()
                            });
                        }
                    }
                }
            ]}
        />
    ));
};

const importGifs = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            let parsedData: unknown;
            try {
                parsedData = JSON.parse(text);
            } catch {
                Toasts.show({ message: "Couldn't read that file. Is it a valid JSON backup?", type: Toasts.Type.FAILURE, id: Toasts.genId() });
                return;
            }
            
            if (!Array.isArray(parsedData)) {
                Toasts.show({ message: "This backup file doesn't look like a valid list of GIFs.", type: Toasts.Type.FAILURE, id: Toasts.genId() });
                return;
            }

            const importedGifs = parsedData
                .filter(isValidGif)
                .map(gif => ({
                    url: gif.url,
                    src: gif.src || gif.url,
                    width: gif.width || 250,
                    height: gif.height || 250,
                    format: gif.format || 1,
                }));

            if (importedGifs.length === 0) {
                Toasts.show({ message: "Didn't find any valid GIFs in that backup.", type: Toasts.Type.FAILURE, id: Toasts.genId() });
                return;
            }
            
            openModal(modalProps => (
                <Modal
                    {...modalProps}
                    title="Import GIFs"
                    subtitle={`Found ${importedGifs.length} GIFs in this backup. Import them?`}
                    actions={[
                        {
                            text: "Cancel",
                            variant: "secondary",
                            onClick: modalProps.onClose
                        },
                        {
                            text: "Import",
                            variant: "primary",
                            onClick: async () => {
                                modalProps.onClose();
                                
                                let newCount = 0;
                                let overwriteCount = 0;
                                
                                await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.updateAsync("favoriteGifs", (settings: FavoriteGifsSettings) => {
                                    if (!settings.gifs) settings.gifs = {};
                                    for (const gif of importedGifs) {
                                        if (settings.gifs[gif.url]) {
                                            overwriteCount++;
                                        } else {
                                            newCount++;
                                        }
                                        const { url, ...rest } = gif;
                                        settings.gifs[url] = rest;
                                    }
                                });
                                
                                Toasts.show({
                                    message: `Imported ${newCount} new GIFs (${overwriteCount} updated)!`,
                                    type: Toasts.Type.SUCCESS,
                                    id: Toasts.genId()
                                });
                            }
                        }
                    ]}
                />
            ));
        } catch {
            Toasts.show({
                message: "Failed to read file.",
                type: Toasts.Type.FAILURE,
                id: Toasts.genId()
            });
        }
    };
    
    input.click();
};

const doubleConfirm = (title: string, subtitle: string, title2: string, subtitle2: string, onConfirm: () => void) => {
    Alerts.show({
        title,
        body: <Text size="md" style={{ color: "var(--text-normal)" }}>{subtitle}</Text>,
        confirmText: "Yes",
        cancelText: "Cancel",
        confirmColor: DiscordButton.Colors.RED,
        onConfirm: () => {
            Alerts.show({
                title: title2,
                body: <Text size="md" style={{ color: "var(--text-normal)" }}>{subtitle2}</Text>,
                confirmText: "I'm Sure",
                cancelText: "Cancel",
                confirmColor: DiscordButton.Colors.RED,
                onConfirm
            });
        }
    });
};

const removeAllGifs = () => {
    doubleConfirm(
        "Clear All Favorite GIFs",
        "All of your favorite GIFs will be deleted. You sure?",
        "Double Check",
        "This will permanently delete all your favorite GIFs. Sure about this?",
        async () => {
            await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.updateAsync("favoriteGifs", (settings: FavoriteGifsSettings) => {
                settings.gifs = {};
            });
            Toasts.show({
                message: "All favorite GIFs have been removed!",
                type: Toasts.Type.SUCCESS,
                id: Toasts.genId()
            });
        }
    );
};

const removeBackupGifsFromFavorites = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            let toRemove: unknown;
            try {
                toRemove = JSON.parse(text);
            } catch {
                Toasts.show({ message: "Couldn't read that file. Is it a valid JSON backup?", type: Toasts.Type.FAILURE, id: Toasts.genId() });
                return;
            }
            
            if (Array.isArray(toRemove)) {
                const validToRemove = toRemove.filter(isValidGif);
                if (validToRemove.length === 0) {
                    Toasts.show({ message: "Didn't find any valid GIFs in that file.", type: Toasts.Type.FAILURE, id: Toasts.genId() });
                    return;
                }
                
                doubleConfirm(
                    "Bulk Remove GIFs",
                    `${validToRemove.length} GIFs from this file will be removed from your favorites. Are you sure?`,
                    "Double Check",
                    "This will permanently delete these GIFs from your favorites. Sure about this?",
                    async () => {
                        let count = 0;
                        await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.updateAsync("favoriteGifs", (settings: FavoriteGifsSettings) => {
                            if (!settings.gifs) return;
                            for (const gif of validToRemove) {
                                if (settings.gifs[gif.url]) {
                                    delete settings.gifs[gif.url];
                                    count++;
                                }
                            }
                        });
                        Toasts.show({
                            message: `${count} GIFs have been removed!`,
                            type: Toasts.Type.SUCCESS,
                            id: Toasts.genId()
                        });
                    }
                );
            } else {
                Toasts.show({ message: "File must contain a list of GIFs.", type: Toasts.Type.FAILURE, id: Toasts.genId() });
            }
        } catch {
            Toasts.show({ message: "Failed to read file.", type: Toasts.Type.FAILURE, id: Toasts.genId() });
        }
    };
    
    input.click();
};

const GifManagerModal = ({ modalProps }: { modalProps: Record<string, unknown> }) => {
    const [gifs, setGifs] = useState<FavoriteGif[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [failedGifs, setFailedGifs] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        let isMounted = true;
        const fetchAndRefresh = async () => {
            const initialGifs = UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue()?.favoriteGifs?.gifs || {};
            const items = (Object.entries(initialGifs).map(([url, data]) => ({ url, ...(data as Record<string, unknown>) })) as FavoriteGif[]).reverse();
            
            const toRefresh = items.map(g => g.src || g.url).filter(url => {
                if (!url) return false;
                if (!url.includes("/attachments/")) return false;
                try {
                    const parsed = new URL(url);
                    const ex = parsed.searchParams.get("ex");
                    if (!ex) return true;
                    // Refresh if the link expires in less than 1 hour (3600000 ms)
                    if (parseInt(ex, 16) * 1000 < Date.now() + 3600000) return true;
                } catch {}
                return false;
            });

            if (toRefresh.length > 0) {
                try {
                    let hasUpdates = false;
                    for (let i = 0; i < toRefresh.length; i += 50) {
                        const chunk = toRefresh.slice(i, i + 50);
                        const res = await RestAPI.post({ url: "/attachments/refresh-urls", body: { attachment_urls: chunk } });
                        if (res.ok && res.body.refreshed_urls) {
                            const map: Record<string, string> = {};
                            for (const { original, refreshed } of res.body.refreshed_urls) {
                                map[original] = refreshed;
                            }
                            for (const item of items) {
                                const u = item.src || item.url;
                                if (map[u]) {
                                    item.src = map[u];
                                    hasUpdates = true;
                                }
                            }
                        }
                    }
                    if (hasUpdates) {
                        await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.updateAsync("favoriteGifs", (settings: FavoriteGifsSettings) => {
                            if (!settings.gifs) return;
                            for (const item of items) {
                                if (settings.gifs[item.url]) {
                                    settings.gifs[item.url].src = item.src;
                                }
                            }
                        });
                    }
                } catch {
                    Toasts.show({
                        message: "Failed to refresh some expired GIFs.",
                        type: Toasts.Type.FAILURE,
                        id: Toasts.genId()
                    });
                }
            }
            
            if (isMounted) {
                setGifs(items);
                setLoading(false);
            }
        };
        fetchAndRefresh();
        
        return () => {
            isMounted = false;
        };
    }, []);

    const toggleSelect = (url: string) => {
        const next = new Set(selected);
        if (next.has(url)) next.delete(url);
        else next.add(url);
        setSelected(next);
    };

    const handleMediaError = (url: string) => {
        setFailedGifs(prev => {
            const next = new Set(prev);
            next.add(url);
            return next;
        });
    };

    return (
        <Modal
            {...modalProps}
            size="md"
            title="Manage Favorite GIFs"
            subtitle={selected.size > 0 ? `${selected.size} GIFs selected` : "Select GIFs to delete."}
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: `Delete Selected (${selected.size})`,
                    color: DiscordButton.Colors.RED,
                    disabled: selected.size === 0,
                    onClick: () => {
                        doubleConfirm(
                            "Delete Selected",
                            `Are you sure you want to delete ${selected.size} selected GIFs?`,
                            "Are you really sure? (Double Check)",
                            "This action cannot be undone.",
                            async () => {
                                await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.updateAsync("favoriteGifs", (settings: FavoriteGifsSettings) => {
                                    if (!settings.gifs) return;
                                    for (const url of selected) {
                                        delete settings.gifs[url];
                                    }
                                });
                                Toasts.show({
                                    message: `${selected.size} GIFs removed!`,
                                    type: Toasts.Type.SUCCESS,
                                    id: Toasts.genId()
                                });
                                modalProps.onClose();
                            }
                        );
                    }
                }
            ]}
        >
            {loading ? (
                <div style={{ padding: "40px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Loading GIFs...</div>
            ) : (
                <div style={{ padding: "16px", maxHeight: "70vh", overflowY: "auto", overflowX: "hidden" }}>
                    <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", 
                        gap: "12px",
                        alignItems: "start"
                    }}>
                                {gifs.map(gif => {
                                    const isSelected = selected.has(gif.url);
                                    const mediaSrc = gif.src || gif.url;
                                    const cleanUrl = mediaSrc.split("?")[0].toLowerCase();
                                    const isVideo = cleanUrl.endsWith(".mp4") || cleanUrl.endsWith(".webm") || gif.format === 2 || gif.format === 3;
                                    const isFailed = failedGifs.has(gif.url);
                                    
                                    return (
                                        <div 
                                            key={gif.url} 
                                            onClick={() => toggleSelect(gif.url)}
                                            style={{ 
                                                position: "relative",
                                                cursor: "pointer",
                                                borderRadius: "8px",
                                                overflow: "hidden",
                                                backgroundColor: "var(--background-secondary-alt)",
                                                boxSizing: "border-box",
                                                border: isSelected ? "4px solid var(--brand-experiment)" : "4px solid transparent"
                                            }}
                                        >
                                            {isFailed ? (
                                                <div style={{ width: "100%", height: "150px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                                                    <Text size="sm" weight="semibold" style={{ color: "var(--text-danger)" }}>Load Error</Text>
                                                </div>
                                            ) : isVideo ? (
                                                <video 
                                                    src={mediaSrc} 
                                                    autoPlay 
                                                    loop 
                                                    muted 
                                                    playsInline
                                                    onError={() => handleMediaError(gif.url)}
                                                    style={{ width: "100%", maxHeight: "250px", display: "block", objectFit: "cover" }}
                                                />
                                            ) : (
                                                <img 
                                                    src={mediaSrc} 
                                                    referrerPolicy="no-referrer"
                                                    onError={() => handleMediaError(gif.url)}
                                                    style={{ width: "100%", maxHeight: "250px", display: "block", objectFit: "cover" }} 
                                                />
                                            )}
                                            {isSelected && (
                                                <div style={{ position: "absolute", top: "8px", right: "8px", pointerEvents: "none" }}>
                                                    <Checkbox value={true} onChange={() => {}} shape="round" size={24} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                    </div>
                    {gifs.length === 0 && (
                        <div style={{ width: "100%", textAlign: "center", marginTop: "20px" }}>
                            <Text size="md" style={{ color: "var(--text-muted)" }}>You don't have any favorite GIFs.</Text>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

const openManager = () => {
    openModal(props => <GifManagerModal modalProps={props} />);
};

const TransferMenu = () => {
    return (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "16px", backgroundColor: "var(--background-secondary)", borderRadius: "8px" }}>
                <Text size="md" weight="semibold" style={{ marginBottom: "8px" }}>Manage Favorites</Text>
                <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                    Visually browse and bulk-remove your favorite GIFs.
                </Text>
                <Button variant="primary" onClick={() => openManager()}>
                    Open GIF Manager
                </Button>
            </div>

            <div style={{ padding: "16px", backgroundColor: "var(--background-secondary)", borderRadius: "8px" }}>
                <Text size="md" weight="semibold" style={{ marginBottom: "8px" }}>Backup & Restore</Text>
                <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                    Save your favorite GIFs to a JSON file, or load an existing backup.
                </Text>
                <div style={{ display: "flex", gap: "12px" }}>
                    <Button variant="secondary" onClick={() => exportGifs()}>
                        Export to Backup File
                    </Button>
                    <Button variant="secondary" onClick={() => importGifs()}>
                        Import from Backup File
                    </Button>
                </div>
            </div>

            <div style={{ padding: "16px", backgroundColor: "var(--background-secondary)", borderRadius: "8px", border: "1px solid var(--background-modifier-accent)" }}>
                <Text size="md" weight="semibold" style={{ marginBottom: "8px", color: "var(--text-danger)" }}>Danger Zone</Text>
                <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                    Delete your favorite GIFs. These actions are permanent unless you have a backup.
                </Text>
                <div style={{ display: "flex", gap: "12px" }}>
                    <Button variant="dangerPrimary" onClick={() => removeBackupGifsFromFavorites()}>
                        Remove GIFs listed in Backup
                    </Button>
                    <Button variant="dangerPrimary" onClick={() => removeAllGifs()}>
                        Remove All
                    </Button>
                </div>
            </div>
        </div>
    );
};

const settings = definePluginSettings({
    showInToolbox: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show quick actions in the Equicord Toolbox",
        restartNeeded: true
    },
    menu: {
        type: OptionType.COMPONENT,
        component: TransferMenu,
        description: ""
    }
});

export default definePlugin({
    name: "FavGifManager",
    tags: ["Utility"],
    description: "Manage, export, and import your favorite GIFs.",
    authors: [{ name: "x0thra", id: 1529340252261716088n }],
    settings,
    get toolboxActions() {
        return settings.store.showInToolbox ? {
            "Open GIF Manager": openManager,
            "Export to Backup File": exportGifs,
            "Import from Backup File": importGifs,
            "Remove GIFs listed in Backup": removeBackupGifsFromFavorites,
            "Remove All": removeAllGifs
        } : {};
    }
});
