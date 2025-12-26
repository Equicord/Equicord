/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { EquicordDevs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { ContextMenuApi, Forms, Menu, OAuth2AuthorizeModal, React, showToast,Toasts, UserStore } from "@webpack/common";

const CACHE_STORE_KEY = "freebadges-cache";
const AUTH_STORE_KEY = "freebadges-auth";
const SUBMISSION_STORE_KEY = "freebadges-submissions";
const CACHE_VERSION = 1;

interface ApprovedBadge {
    id: string;
    name: string;
    iconUrl: string;
    creatorId: string;
    createdAt: string;
    updatedAt: string;
}

interface CacheRecord {
    version: number;
    etag?: string;
    updatedAt: number;
    badges: ApprovedBadge[];
}

interface SubmissionBadge extends ApprovedBadge {
    status: "PENDING" | "APPROVED" | "REJECTED" | "BANNED";
    reviewReason?: string | null;
    reviewerId?: string | null;
}

interface AuthState {
    token: string;
    user: {
        id: string;
        username: string;
        globalName?: string | null;
        avatar?: string | null;
    };
}

const settings = definePluginSettings({
    backendUrl: {
        type: OptionType.STRING,
        description: "Base URL for the FreeBadges backend",
        default: "https://fbr.kzis.gay"
    },
    discordClientId: {
        type: OptionType.STRING,
        description: "Discord client ID of the backend",
        default: "1446692568468291706"
    },
    refreshMinutes: {
        type: OptionType.NUMBER,
        description: "Minutes between automatic badge refreshes",
        default: 30,
        onChange(newValue: number) {
            if (!Number.isFinite(newValue) || newValue <= 0) settings.store.refreshMinutes = 30;
            scheduleRefresh();
        }
    }
});

const log = new Logger("FreeBadges");

let cache: CacheRecord | null = null;
let authState: AuthState | null = null;
let submissions: SubmissionBadge[] = [];
let badgeIndex = new Map<string, ApprovedBadge[]>();
let refreshTimer: number | null = null;
const subscribers = new Set<() => void>();

function subscribe(listener: () => void) {
    subscribers.add(listener);
    return () => {
        subscribers.delete(listener);
    };
}

function notify() {
    subscribers.forEach(cb => cb());
}

function getBackendUrl() {
    return settings.store.backendUrl?.replace(/\/$/, "") ?? "";
}

function getCurrentUserId() {
    return UserStore.getCurrentUser()?.id;
}

async function loadCacheFromStore() {
    try {
        const stored = await DataStore.get<CacheRecord>(`${CACHE_STORE_KEY}-v${CACHE_VERSION}`);
        if (stored?.badges) {
            cache = stored;
            rebuildBadgeIndex();
        }
    } catch (error) {
        log.error("Failed to load cache", error);
    }
}

async function persistCache() {
    if (!cache) return;
    await DataStore.set(`${CACHE_STORE_KEY}-v${CACHE_VERSION}`, cache);
}

async function loadAuthFromStore() {
    const userId = getCurrentUserId();
    if (!userId) return;
    const record = await DataStore.get<Record<string, AuthState>>(AUTH_STORE_KEY);
    if (record?.[userId]) {
        authState = record[userId];
    }
}

async function persistAuth() {
    const userId = getCurrentUserId();
    if (!userId) return;
    await DataStore.update<Record<string, AuthState>>(AUTH_STORE_KEY, data => {
        data ??= {};
        if (authState) data[userId] = authState;
        else delete data[userId];
        return data;
    });
}

async function loadSubmissionsFromStore() {
    const userId = getCurrentUserId();
    if (!userId) return;
    const record = await DataStore.get<Record<string, SubmissionBadge[]>>(SUBMISSION_STORE_KEY);
    submissions = record?.[userId] ?? [];
}

async function persistSubmissions() {
    const userId = getCurrentUserId();
    if (!userId) return;
    await DataStore.update<Record<string, SubmissionBadge[]>>(SUBMISSION_STORE_KEY, data => {
        data ??= {};
        data[userId] = submissions;
        return data;
    });
}

function rebuildBadgeIndex() {
    badgeIndex = new Map();
    if (!cache) return;
    for (const badge of cache.badges) {
        const list = badgeIndex.get(badge.creatorId) ?? [];
        list.push(badge);
        badgeIndex.set(badge.creatorId, list);
    }
}

async function refreshApprovedBadges(force = false) {
    const base = getBackendUrl();
    if (!base) return;
    try {
        const headers: Record<string, string> = {
            Accept: "application/json"
        };
        if (!force && cache?.etag) headers["If-None-Match"] = cache.etag;
        const res = await fetch(`${base}/badges/approved`, {
            headers,
            cache: "no-store"
        });
        if (res.status === 304) return;
        if (!res.ok) throw new Error(`Failed to fetch badges: ${res.status}`);
        const body = await res.json() as { badges: ApprovedBadge[]; };
        cache = {
            version: CACHE_VERSION,
            etag: res.headers.get("etag") ?? undefined,
            updatedAt: Date.now(),
            badges: body.badges ?? []
        };
        rebuildBadgeIndex();
        await persistCache();
        notify();
    } catch (error) {
        log.error("Failed to refresh badges", error);
        showToast("Failed to refresh FreeBadges list", Toasts.Type.FAILURE);
    }
}

async function fetchMySubmissions() {
    const base = getBackendUrl();
    if (!base || !authState) return;
    try {
        const res = await fetch(`${base}/badges/mine`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${authState.token}`
            }
        });
        if (!res.ok) throw new Error(await res.text());
        const body = await res.json() as { badges: SubmissionBadge[]; };
        submissions = body.badges ?? [];
        await persistSubmissions();
        notify();
    } catch (error) {
        log.error("Failed to load submissions", error);
    }
}

function scheduleRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    const minutes = Math.max(5, Number(settings.store.refreshMinutes) || 30);
    refreshTimer = window.setInterval(() => refreshApprovedBadges(), minutes * 60 * 1000);
}

function openBadgeContextMenu(event: React.MouseEvent, badge: ProfileBadge & BadgeUserArgs) {
    ContextMenuApi.openContextMenu(event, () => (
        <Menu.Menu
            navId="freebadges-context"
            onClose={ContextMenuApi.closeContextMenu}
        >
            <Menu.MenuItem
                id="freebadges-copy-name"
                label="Copy badge name"
                action={() => copyWithToast(badge.description ?? badge.key ?? "FreeBadge")}
            />
            <Menu.MenuItem
                id="freebadges-copy-url"
                label="Copy badge image link"
                action={() => copyWithToast(badge.iconSrc ?? "")}
            />
        </Menu.Menu>
    ));
}

const freeBadgeDefinition: ProfileBadge = {
    position: BadgePosition.END,
    getBadges({ userId }: BadgeUserArgs) {
        const list = badgeIndex.get(userId);
        if (!list?.length) return [];
        return list.map(badge => ({
            description: `${badge.name}`,
            iconSrc: badge.iconUrl,
            position: BadgePosition.END,
            key: `freebadge-${badge.id}`,
            props: { style: { borderRadius: "50%", transform: "scale(0.9)" } },
            onContextMenu: (event, props) => openBadgeContextMenu(event, props)
        } satisfies ProfileBadge));
    }
};

function useFreeBadgesState() {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
        const unsubscribe = subscribe(() => forceUpdate());
        return unsubscribe;
    }, []);
    return {
        auth: authState,
        submissions,
        cache
    };
}

function FreeBadgesSettingsPanel() {
    const { auth, submissions: mySubmissions, cache: badgeCache } = useFreeBadgesState();
    const [name, setName] = React.useState("");
    const [file, setFile] = React.useState<File | null>(null);
    const [isSubmitting, setSubmitting] = React.useState(false);

    const lastUpdated = badgeCache?.updatedAt ? new Date(badgeCache.updatedAt).toLocaleString() : "Never";

    const handleLogin = () => openLoginModal();
    const handleLogout = () => logout();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!auth) return showToast("Please sign in first", Toasts.Type.FAILURE);
        if (!name.trim() || !file) return showToast("Name and icon are required", Toasts.Type.FAILURE);
        setSubmitting(true);
        try {
            await submitBadge(name.trim(), file);
            setName("");
            setFile(null);
            showToast("Badge submitted!", Toasts.Type.SUCCESS);
        } catch (error) {
            showToast((error as Error).message ?? "Submission failed", Toasts.Type.FAILURE);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="vc-freebadges-panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Forms.FormText>Backend: {getBackendUrl() || "Not configured"}</Forms.FormText>
            <Forms.FormText>Last synced: {lastUpdated}</Forms.FormText>
            <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button variant="secondary" onClick={() => refreshApprovedBadges(true)}>
                    Refresh Badges
                </Button>
                {auth ? (
                    <Button variant="dangerSecondary" onClick={handleLogout}>
                        Logout
                    </Button>
                ) : (
                    <Button variant="primary" onClick={handleLogin}>
                        Sign in with Discord
                    </Button>
                )}
            </div>
            {auth && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem", border: "1px solid var(--background-modifier-accent)", borderRadius: 8 }}>
                    <Forms.FormTitle>Submit a badge</Forms.FormTitle>
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <input
                            type="text"
                            value={name}
                            placeholder="Badge name"
                            onChange={e => setName(e.currentTarget.value)}
                            className="vc-freebadges-input"
                        />
                        <input
                            type="file"
                            accept="image/png,image/webp,image/jpeg"
                            onChange={e => setFile(e.currentTarget.files?.[0] ?? null)}
                        />
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </Button>
                    </form>
                </div>
            )}
            {!!mySubmissions?.length && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem", border: "1px solid var(--background-modifier-accent)", borderRadius: 8 }}>
                    <Forms.FormTitle>Your submissions</Forms.FormTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {mySubmissions.map(sub => (
                            <div
                                key={sub.id}
                                style={{ border: "1px solid var(--background-modifier-accent)", borderRadius: 8, padding: "0.75rem" }}
                            >
                                <Forms.FormText>{sub.name}</Forms.FormText>
                                <Forms.FormText>Status: {sub.status}</Forms.FormText>
                                {sub.reviewReason && <Forms.FormText>Notes: {sub.reviewReason}</Forms.FormText>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

async function submitBadge(name: string, file: File) {
    if (!authState) throw new Error("Not authenticated");
    const base = getBackendUrl();
    if (!base) throw new Error("Backend URL missing");
    const form = new FormData();
    form.append("metadata", JSON.stringify({ name }));
    form.append("icon", file, file.name || "badge.png");
    const res = await fetch(`${base}/badges/submit`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${authState.token}`
        },
        body: form
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Submission failed (${res.status})`);
    }
    await fetchMySubmissions();
}

function openLoginModal() {
    const clientId = settings.store.discordClientId?.trim();
    const redirectUri = settings.store.backendUrl?.trim() + "/auth/discord/callback";
    if (!clientId || !redirectUri) {
        return showToast("Set Discord client ID and redirect URI in the settings above.", Toasts.Type.FAILURE);
    }

    openModal(props => (
        <OAuth2AuthorizeModal
            {...props}
            scopes={["identify"]}
            clientId={clientId}
            redirectUri={redirectUri}
            responseType="code"
            permissions={0n}
            cancelCompletesFlow={false}
            callback={async response => {
                try {
                    const url = new URL(response.location);
                    url.searchParams.set("clientMod", "equicord");
                    const res = await fetch(url, { headers: { Accept: "application/json" } });
                    if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        showToast(body.error ?? "Login failed", Toasts.Type.FAILURE);
                        return;
                    }
                    const body = await res.json();
                    authState = { token: body.token, user: body.user };
                    await persistAuth();
                    showToast("Logged in to FreeBadges", Toasts.Type.SUCCESS);
                    await fetchMySubmissions();
                    notify();
                } catch (error) {
                    showToast((error as Error).message ?? "OAuth failed", Toasts.Type.FAILURE);
                }
            }}
        />
    ));
}

async function logout() {
    const base = getBackendUrl();
    if (base && authState) {
        try {
            await fetch(`${base}/auth/logout`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${authState.token}`
                }
            });
        } catch {
            // ignore
        }
    }
    authState = null;
    submissions = [];
    await persistAuth();
    await persistSubmissions();
    notify();
}

export default definePlugin({
    name: "FreeBadges",
    description: "Displays FreeBadges profiles and lets you submit new ones for approval.",
    authors: [EquicordDevs.kz],
    dependencies: ["BadgeAPI"],
    settings,
    settingsAboutComponent: FreeBadgesSettingsPanel,

    async start() {
        await Promise.all([loadCacheFromStore(), loadAuthFromStore(), loadSubmissionsFromStore()]);
        await refreshApprovedBadges();
        scheduleRefresh();
        addProfileBadge(freeBadgeDefinition);
        notify();
    },

    stop() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        removeProfileBadge(freeBadgeDefinition);
        badgeIndex.clear();
    },

    toolboxActions: {
        async "Force Refresh FreeBadges"() {
            await refreshApprovedBadges(true);
            showToast("FreeBadges cache refreshed", Toasts.Type.SUCCESS);
        }
    }
});
