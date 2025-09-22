/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ErrorCard } from "@components/ErrorCard";
import { Link } from "@components/Link";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { changes, getRepo, shortGitHash, UpdateLogger } from "@utils/updater";
import { Button, Card, Forms, React, Toasts } from "@webpack/common";

import {
    ChangelogEntry,
    ChangelogHistory,
    formatTimestamp,
    getChangelogHistory,
    getNewPlugins,
    getNewSettings,
    getUpdatedPlugins,
    initializeChangelog,
    saveUpdateSession,
    UpdateSession,
} from "./changelogManager";
import { NewPluginsCompact, NewPluginsSection } from "./NewPluginsSection";

function HashLink({
    repo,
    hash,
    disabled = false,
}: {
    repo: string;
    hash: string;
    disabled?: boolean;
}) {
    return (
        <Link href={`${repo}/commit/${hash}`} disabled={disabled}>
            {hash}
        </Link>
    );
}

function ChangelogCard({
    entry,
    repo,
    repoPending,
}: {
    entry: ChangelogEntry;
    repo: string;
    repoPending: boolean;
}) {
    return (
        <Card className="vc-changelog-entry">
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25em",
                }}
            >
                <div className="vc-changelog-entry-header">
                    <code className="vc-changelog-entry-hash">
                        <HashLink
                            repo={repo}
                            hash={entry.hash.slice(0, 7)}
                            disabled={repoPending}
                        />
                    </code>
                    <span className="vc-changelog-entry-author">
                        by {entry.author}
                    </span>
                </div>
                <div className="vc-changelog-entry-message">
                    {entry.message}
                </div>
            </div>
        </Card>
    );
}

function UpdateLogCard({
    log,
    repo,
    repoPending,
    isExpanded,
    onToggleExpand,
}: {
    log: UpdateSession;
    repo: string;
    repoPending: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
}) {
    return (
        <Card className="vc-changelog-log">
            <div className="vc-changelog-log-header" onClick={onToggleExpand}>
                <div className="vc-changelog-log-info">
                    <div className="vc-changelog-log-title">
                        Update from {log.fromHash.slice(0, 7)} →{" "}
                        {log.toHash.slice(0, 7)}
                    </div>
                    <div className="vc-changelog-log-meta">
                        {formatTimestamp(log.timestamp)} • {log.commits.length}{" "}
                        commits
                        {log.newPlugins.length > 0 &&
                            ` • ${log.newPlugins.length} new plugins`}
                        {log.updatedPlugins.length > 0 &&
                            ` • ${log.updatedPlugins.length} updated plugins`}
                        {log.newSettings &&
                            log.newSettings.size > 0 &&
                            ` • ${Array.from(log.newSettings.values()).reduce((sum, arr) => sum + arr.length, 0)} new settings`}
                    </div>
                </div>
                <div
                    className={`vc-changelog-log-toggle ${isExpanded ? "expanded" : ""}`}
                >
                    ▼
                </div>
            </div>

            {isExpanded && (
                <div className="vc-changelog-log-content">
                    {log.newPlugins.length > 0 && (
                        <div className="vc-changelog-log-plugins">
                            <Forms.FormTitle
                                tag="h6"
                                className={Margins.bottom8}
                            >
                                New Plugins
                            </Forms.FormTitle>
                            <NewPluginsCompact
                                newPlugins={log.newPlugins}
                                maxDisplay={10}
                            />
                        </div>
                    )}

                    {log.updatedPlugins.length > 0 && (
                        <div className="vc-changelog-log-plugins">
                            <Forms.FormTitle
                                tag="h6"
                                className={Margins.bottom8}
                            >
                                Updated Plugins
                            </Forms.FormTitle>
                            <NewPluginsCompact
                                newPlugins={log.updatedPlugins}
                                maxDisplay={10}
                            />
                        </div>
                    )}

                    {log.newSettings && log.newSettings.size > 0 && (
                        <div className="vc-changelog-log-plugins">
                            <Forms.FormTitle
                                tag="h6"
                                className={Margins.bottom8}
                            >
                                New Settings
                            </Forms.FormTitle>
                            <div className="vc-changelog-new-plugins-list">
                                {Array.from(
                                    log.newSettings?.entries() || [],
                                ).map(([pluginName, settings]) =>
                                    settings.map(setting => (
                                        <span
                                            key={`${pluginName}-${setting}`}
                                            className="vc-changelog-new-plugin-tag"
                                            title={`New setting in ${pluginName}`}
                                        >
                                            {pluginName}.{setting}
                                        </span>
                                    )),
                                )}
                            </div>
                        </div>
                    )}

                    {log.commits.length > 0 && (
                        <div className="vc-changelog-log-commits">
                            <Forms.FormTitle
                                tag="h6"
                                className={Margins.bottom8}
                            >
                                Code Changes
                            </Forms.FormTitle>
                            <div className="vc-changelog-log-commits-list">
                                {log.commits.map(entry => (
                                    <ChangelogCard
                                        key={entry.hash}
                                        entry={entry}
                                        repo={repo}
                                        repoPending={repoPending}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

function ChangelogContent() {
    const [repo, repoErr, repoPending] = useAwaiter(getRepo, {
        fallbackValue: "Loading...",
    });
    const [changelog, setChangelog] = React.useState<ChangelogEntry[]>([]);
    const [changelogHistory, setChangelogHistory] =
        React.useState<ChangelogHistory>([]);
    const [newPlugins, setNewPlugins] = React.useState<string[]>([]);
    const [updatedPlugins, setUpdatedPlugins] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = React.useState<Set<string>>(
        new Set(),
    );
    const [showHistory, setShowHistory] = React.useState(false);

    React.useEffect(() => {
        initializeChangelog().catch(console.error);
        loadChangelogHistory();
    }, []);

    React.useEffect(() => {
        if (repoErr) {
            UpdateLogger.error("Failed to retrieve repo", repoErr);
            setError("Failed to retrieve repository information");
        }
    }, [repoErr]);

    React.useEffect(() => {
        // Use existing changes if available, otherwise they'll be empty
        if (changes && changes.length > 0) {
            setChangelog(changes);
        }
        loadNewPlugins();
    }, []);

    const loadChangelogHistory = async () => {
        try {
            const history = await getChangelogHistory();
            setChangelogHistory(history);
        } catch (err) {
            console.error("Failed to load changelog history:", err);
        }
    };

    const loadNewPlugins = async () => {
        try {
            const newPlgs = await getNewPlugins();
            const updatedPlgs = await getUpdatedPlugins();
            setNewPlugins(newPlgs);
            setUpdatedPlugins(updatedPlgs);
        } catch (err) {
            console.error("Failed to load new plugins:", err);
        }
    };

    const fetchChangelog = React.useCallback(async () => {
        if (repoPending || repoErr) return;

        setIsLoading(true);
        setError(null);

        try {
            // Try to fetch updates to get the most recent changelog
            const updates = await VencordNative.updater.getUpdates();

            if (updates.ok && updates.value && updates.value.length > 0) {
                setChangelog(updates.value);

                // Load current new/updated plugins and settings
                const newPlgs = await getNewPlugins();
                const updatedPlgs = await getUpdatedPlugins();
                const newSettings = await getNewSettings();
                setNewPlugins(newPlgs);
                setUpdatedPlugins(updatedPlgs);

                // Save this update session to history
                await saveUpdateSession(
                    updates.value,
                    newPlgs,
                    updatedPlgs,
                    newSettings,
                );
                await loadChangelogHistory();

                Toasts.show({
                    message: "Changelog updated!",
                    id: Toasts.genId(),
                    type: Toasts.Type.SUCCESS,
                    options: {
                        position: Toasts.Position.BOTTOM,
                    },
                });
            } else if (
                updates.ok &&
                updates.value &&
                updates.value.length === 0
            ) {
                setChangelog([]);
                Toasts.show({
                    message: "You're up to date!",
                    id: Toasts.genId(),
                    type: Toasts.Type.MESSAGE,
                    options: {
                        position: Toasts.Position.BOTTOM,
                    },
                });
            } else if (!updates.ok) {
                throw updates.error;
            }
        } catch (err: any) {
            UpdateLogger.error("Failed to fetch changelog", err);
            setError(err?.message || "Failed to fetch changelog");
        } finally {
            setIsLoading(false);
        }
    }, [repoPending, repoErr]);

    const toggleLogExpanded = (logId: string) => {
        const newExpanded = new Set(expandedLogs);
        if (newExpanded.has(logId)) {
            newExpanded.delete(logId);
        } else {
            newExpanded.add(logId);
        }
        setExpandedLogs(newExpanded);
    };

    const hasCurrentChanges =
        changelog.length > 0 ||
        newPlugins.length > 0 ||
        updatedPlugins.length > 0;

    return (
        <>
            <Forms.FormText className={Margins.bottom16}>
                View the most recent changes to Equicord. This shows you what's
                new in the latest update, whether you've updated or not.
            </Forms.FormText>

            <Forms.FormTitle tag="h5">Repository</Forms.FormTitle>
            <Forms.FormText className={Margins.bottom16}>
                {repoPending ? (
                    repo
                ) : repoErr ? (
                    "Failed to retrieve - check console"
                ) : (
                    <Link href={repo}>
                        {repo.split("/").slice(-2).join("/")}
                    </Link>
                )}{" "}
                (Current:{" "}
                <span className="vc-changelog-current-hash">
                    {shortGitHash()}
                </span>
                )
            </Forms.FormText>

            <div className="vc-changelog-controls">
                <Button
                    size={Button.Sizes.SMALL}
                    disabled={isLoading || repoPending || !!repoErr}
                    onClick={fetchChangelog}
                >
                    {isLoading ? "Loading..." : "Refresh Changelog"}
                </Button>

                {changelogHistory.length > 0 && (
                    <Button
                        size={Button.Sizes.SMALL}
                        color={
                            showHistory
                                ? Button.Colors.PRIMARY
                                : Button.Colors.BRAND
                        }
                        onClick={() => setShowHistory(!showHistory)}
                        style={{ marginLeft: "8px" }}
                    >
                        {showHistory ? "Hide Logs" : "Show Logs"}
                    </Button>
                )}
            </div>

            {error && (
                <ErrorCard style={{ padding: "1em", marginBottom: "1em" }}>
                    <p>{error}</p>
                </ErrorCard>
            )}

            <Forms.FormDivider className={Margins.bottom16} />

            {/* Current Changes Section */}
            {hasCurrentChanges ? (
                <div className="vc-changelog-current">
                    <Forms.FormTitle tag="h5" className={Margins.bottom8}>
                        Latest Changes
                    </Forms.FormTitle>

                    {/* New Plugins Section */}
                    {newPlugins.length > 0 && (
                        <div className={Margins.bottom16}>
                            <NewPluginsSection
                                newPlugins={newPlugins}
                                onPluginToggle={(pluginName, enabled) => {
                                    // Handle plugin toggle if needed
                                }}
                            />
                        </div>
                    )}

                    {/* Updated Plugins Section */}
                    {updatedPlugins.length > 0 && (
                        <div className={Margins.bottom16}>
                            <Forms.FormTitle
                                tag="h6"
                                className={Margins.bottom8}
                            >
                                Updated Plugins ({updatedPlugins.length})
                            </Forms.FormTitle>
                            <NewPluginsCompact newPlugins={updatedPlugins} />
                        </div>
                    )}

                    {/* Code Changes */}
                    {changelog.length > 0 && (
                        <div>
                            <Forms.FormTitle
                                tag="h6"
                                className={Margins.bottom8}
                            >
                                Code Changes ({changelog.length}{" "}
                                {changelog.length === 1 ? "commit" : "commits"})
                            </Forms.FormTitle>
                            <div className="vc-changelog-commits-list">
                                {changelog.map(entry => (
                                    <ChangelogCard
                                        key={entry.hash}
                                        entry={entry}
                                        repo={repo}
                                        repoPending={repoPending}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                !isLoading &&
                !error && (
                    <Card className="vc-changelog-empty">
                        <Forms.FormText>
                            No recent changes available. Click "Refresh
                            Changelog" to check for updates.
                        </Forms.FormText>
                    </Card>
                )
            )}

            {/* History Section */}
            {showHistory && changelogHistory.length > 0 && (
                <div className="vc-changelog-history">
                    <Forms.FormDivider
                        className={Margins.top16}
                        style={{ marginBottom: "1em" }}
                    />
                    <Forms.FormTitle tag="h5" className={Margins.bottom8}>
                        Update Logs ({changelogHistory.length}{" "}
                        {changelogHistory.length === 1 ? "log" : "logs"})
                    </Forms.FormTitle>
                    <Forms.FormText className={Margins.bottom16}>
                        View past updates and changes to Equicord.
                    </Forms.FormText>

                    <div className="vc-changelog-history-list">
                        {changelogHistory.map(log => (
                            <UpdateLogCard
                                key={log.id}
                                log={log}
                                repo={repo}
                                repoPending={repoPending}
                                isExpanded={expandedLogs.has(log.id)}
                                onToggleExpand={() => toggleLogExpanded(log.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function ChangelogTab() {
    return (
        <SettingsTab title="Changelog">
            <ChangelogContent />
        </SettingsTab>
    );
}

export default wrapTab(ChangelogTab, "Changelog");
