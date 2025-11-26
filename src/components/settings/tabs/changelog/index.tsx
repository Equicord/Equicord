/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Card } from "@components/Card";
import { Divider } from "@components/Divider";
import { ErrorCard } from "@components/ErrorCard";
import { Heading } from "@components/Heading";
import { DeleteIcon } from "@components/Icons";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { HashLink } from "@components/settings/tabs/updater/Components";
import { gitHash, gitHashShort } from "@shared/vencordUserAgent";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { t } from "@utils/translation";
import { getRepo, UpdateLogger } from "@utils/updater";
import { Alerts, Button, React, Toasts } from "@webpack/common";

import {
    ChangelogEntry,
    ChangelogHistory,
    clearChangelogHistory,
    clearIndividualLog,
    formatTimestamp,
    getChangelogHistory,
    getCommitsSinceLastSeen,
    getLastRepositoryCheckHash,
    getNewPlugins,
    getNewSettings,
    getNewSettingsEntries,
    getNewSettingsSize,
    getUpdatedPlugins,
    initializeChangelog,
    saveUpdateSession,
    UpdateSession,
} from "./changelogManager";
import { NewPluginsCompact, NewPluginsSection } from "./NewPluginsSection";

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
                            hash={entry.hash}
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
    onClearLog,
}: {
    log: UpdateSession;
    repo: string;
    repoPending: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onClearLog: (logId: string) => void;
}) {
    const isRepositoryFetch =
        log.type === "repository_fetch" ||
        (log.type === undefined &&
            log.fromHash === log.toHash &&
            log.commits.length === 0);
    const isUpToDate = log.fromHash === log.toHash;

    return (
        <Card className="vc-changelog-log">
            <div className="vc-changelog-log-header" onClick={onToggleExpand}>
                <div className="vc-changelog-log-info">
                    <div className="vc-changelog-log-title">
                        <span>
                            {isRepositoryFetch
                                ? isUpToDate
                                    ? t("vencord.settings.changelog.updateCard.upToDate", { fromHash: log.fromHash.slice(0, 7) })
                                    : t("vencord.settings.changelog.updateCard.outOfDate", { fromHash: log.fromHash.slice(0, 7), toHash: log.toHash.slice(0, 7) })
                                : t("vencord.settings.changelog.updateCard.update", { fromHash: log.fromHash.slice(0, 7), toHash: log.toHash.slice(0, 7) })
                            }
                        </span>
                        <Button
                            size={Button.Sizes.NONE}
                            color={Button.Colors.TRANSPARENT}
                            look={Button.Looks.FILLED}
                            className="vc-changelog-delete-button"
                            style={{
                                padding: "4px",
                                color: "var(--status-danger)",
                                opacity: 0.6,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            onClick={e => {
                                e.stopPropagation();
                                onClearLog(log.id);
                            }}
                        >
                            <DeleteIcon width={16} height={16} />
                        </Button>
                    </div>
                    <div className="vc-changelog-log-meta">
                        {formatTimestamp(log.timestamp)}
                        {t("vencord.settings.changelog.updateCard.commits", { count: log.commits.length })}
                        {log.newPlugins.length > 0 && t("vencord.settings.changelog.updateCard.newPluginsCount", { plugins: log.newPlugins.length })}
                        {log.updatedPlugins.length > 0 && t("vencord.settings.changelog.updateCard.updatedPluginsCount", { plugins: log.updatedPlugins.length })}
                        {log.newSettings &&
                            getNewSettingsSize(log.newSettings) > 0 &&
                            t("vencord.settings.changelog.updateCard.newSettingsCount", {
                                settings: getNewSettingsEntries(log.newSettings).reduce((sum, [, arr]) => sum + arr.length, 0)
                            })}
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
                            <NewPluginsCompact
                                newPlugins={log.newPlugins}
                                maxDisplay={50}
                            />
                        </div>
                    )}

                    {log.updatedPlugins.length > 0 && (
                        <div className="vc-changelog-log-plugins">
                            <Heading className={Margins.bottom8}>
                                {t("vencord.settings.changelog.updateCard.updatedPlugins")}
                            </Heading>
                            <NewPluginsCompact
                                newPlugins={log.updatedPlugins}
                                maxDisplay={50}
                            />
                        </div>
                    )}

                    {log.newSettings &&
                        getNewSettingsSize(log.newSettings) > 0 && (
                            <div className="vc-changelog-log-plugins">
                                <Heading className={Margins.bottom8}>
                                    {t("vencord.settings.changelog.updateCard.newSettings")}
                                </Heading>
                                <div className="vc-changelog-new-plugins-list">
                                    {getNewSettingsEntries(log.newSettings).map(
                                        ([pluginName, settings]) =>
                                            settings.map(setting => (
                                                <span
                                                    key={`${pluginName}-${setting}`}
                                                    className="vc-changelog-new-plugin-tag"
                                                    title={t("vencord.settings.changelog.updateCard.newSettingInPlugin", { pluginName: pluginName })}
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
        fallbackValue: t("vencord.loading"),
    });
    const [changelog, setChangelog] = React.useState<ChangelogEntry[]>([]);
    const [changelogHistory, setChangelogHistory] =
        React.useState<ChangelogHistory>([]);
    const [newPlugins, setNewPlugins] = React.useState<string[]>([]);
    const [updatedPlugins, setUpdatedPlugins] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = React.useState<Set<string>>(
        new Set(),
    );
    const [showHistory, setShowHistory] = React.useState(false);
    const [recentlyChecked, setRecentlyChecked] = React.useState(false);

    React.useEffect(() => {
        const init = async () => {
            try {
                await initializeChangelog();
                await loadChangelogHistory();
            } catch (err) {
                console.error("Failed to initialize changelog:", err);
            }
        };
        init();
    }, []);

    React.useEffect(() => {
        if (repoErr) {
            UpdateLogger.error("Failed to retrieve repo", repoErr);
            setError(t("vencord.settings.changelog.missingRepoInfo"));
        }
    }, [repoErr]);

    const loadChangelogHistory = React.useCallback(async () => {
        try {
            const history = await getChangelogHistory();
            setChangelogHistory(history);
        } catch (err) {
            console.error("Failed to load changelog history:", err);
        }
    }, []);

    const loadNewPlugins = React.useCallback(async () => {
        try {
            const newPlgs = await getNewPlugins();
            const updatedPlgs = await getUpdatedPlugins();
            setNewPlugins(newPlgs);
            setUpdatedPlugins(updatedPlgs);
        } catch (err) {
            console.error("Failed to load new plugins:", err);
        }
    }, []);

    const ensureLocalUpdateLogged = React.useCallback(async () => {
        if (repoPending || repoErr) return false;
        const repoUrl = repo;
        if (!repoUrl) return false;

        try {
            const commits = await getCommitsSinceLastSeen(repoUrl);
            if (commits.length === 0) return false;

            const newPlgs = await getNewPlugins();
            const updatedPlgs = await getUpdatedPlugins();
            const newSettings = await getNewSettings();

            await saveUpdateSession(commits, newPlgs, updatedPlgs, newSettings);

            setChangelog(commits);
            setNewPlugins(newPlgs);
            setUpdatedPlugins(updatedPlgs);
            await loadChangelogHistory();
            return true;
        } catch (err) {
            console.error("Failed to log local update:", err);
            return false;
        }
    }, [repo, repoErr, repoPending, loadChangelogHistory]);

    // check if the repository was recently refreshed
    React.useEffect(() => {
        const checkRecentStatus = async () => {
            try {
                const lastRepoCheck = await getLastRepositoryCheckHash();
                const updates = await VencordNative.updater.getUpdates();

                if (updates.ok) {
                    const currentRepoHash =
                        updates.value.length > 0
                            ? updates.value[0].hash
                            : gitHash;
                    setRecentlyChecked(lastRepoCheck === currentRepoHash);
                }
            } catch (err) {
                // ignore errors (hopefully there are none lol)
                setRecentlyChecked(false);
            }
        };

        if (!repoPending && !repoErr) {
            checkRecentStatus();
        }
    }, [repoPending, repoErr]);

    const fetchChangelog = React.useCallback(async () => {
        if (repoPending || repoErr) return;

        setIsLoading(true);
        setError(null);

        try {
            // check if the repository was recently refreshed and that nothing has changed
            const updates = await VencordNative.updater.getUpdates();
            const lastRepoCheck = await getLastRepositoryCheckHash();
            const currentRepoHash =
                updates.ok && updates.value.length > 0
                    ? updates.value[0].hash
                    : gitHash;

            // If repository state hasn't changed since last check
            if (lastRepoCheck === currentRepoHash) {
                setIsLoading(false);
                setRecentlyChecked(true);
                const logged = await ensureLocalUpdateLogged();
                if (!logged) {
                    setChangelog([]);
                    Toasts.show({
                        message: t("vencord.settings.changelog.alreadyUpToDate"),
                        id: Toasts.genId(),
                        type: Toasts.Type.MESSAGE,
                        options: {
                            position: Toasts.Position.BOTTOM,
                        },
                    });
                }
                return;
            }

            if (updates.ok && updates.value) {
                if (updates.value.length > 0) {
                    setChangelog(updates.value);

                    const newPlgs = await getNewPlugins();
                    const updatedPlgs = await getUpdatedPlugins();
                    const newSettings = await getNewSettings();
                    setNewPlugins(newPlgs);
                    setUpdatedPlugins(updatedPlgs);

                    await saveUpdateSession(
                        updates.value,
                        newPlgs,
                        updatedPlgs,
                        newSettings,
                        true,
                    );
                    await loadChangelogHistory();
                    setRecentlyChecked(true);

                    Toasts.show({
                        message: t("vencord.settings.changelog.foundCommits", { count: updates.value.length }),
                        id: Toasts.genId(),
                        type: Toasts.Type.SUCCESS,
                        options: {
                            position: Toasts.Position.BOTTOM,
                        },
                    });
                } else {
                    const logged = await ensureLocalUpdateLogged();
                    setRecentlyChecked(true);
                    Toasts.show({
                        message: logged
                            ? t("vencord.settings.changelog.loggedCommits")
                            : t("vencord.settings.changelog.upToDateLocalCopy"),
                        id: Toasts.genId(),
                        type: logged ? Toasts.Type.SUCCESS : Toasts.Type.MESSAGE,
                        options: {
                            position: Toasts.Position.BOTTOM,
                        },
                    });
                    if (!logged) {
                        setChangelog([]);
                    }
                }
            } else if (!updates.ok) {
                throw new Error(
                    updates.error?.message || t("vencord.settings.changelog.missingRepoInfo"),
                );
            }
        } catch (err: any) {
            UpdateLogger.error("Failed to fetch commits from repository", err);
            const errorMessage =
                err?.message ||
                t("vencord.settings.changelog.checkYourConnection");
            setError(errorMessage);

            // funny little error toast hopefully doesn't happen!
            Toasts.show({
                message: t("vencord.settings.changelog.failedtoFetchCommits"),
                id: Toasts.genId(),
                type: Toasts.Type.FAILURE,
                options: {
                    position: Toasts.Position.BOTTOM,
                },
            });
        } finally {
            setIsLoading(false);
        }
    }, [repoPending, repoErr, loadNewPlugins, loadChangelogHistory]);

    React.useEffect(() => {
        const loadInitialData = async () => {
            if (!repoPending && !repoErr) {
                await loadNewPlugins();
                const logged = await ensureLocalUpdateLogged();
                if (!logged) {
                    await fetchChangelog();
                } else {
                    setIsLoading(false);
                }
            } else if (!repoPending) {
                // perseverance
                await loadNewPlugins();
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [
        repoPending,
        repoErr,
        fetchChangelog,
        loadNewPlugins,
        ensureLocalUpdateLogged,
    ]);

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
            <Paragraph className={Margins.bottom16}>
                {t("vencord.settings.changelog.viewRecentChanges")}
            </Paragraph>

            <Heading>{t("vencord.settings.changelog.repository")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {repoPending ? (
                    repo
                ) : repoErr ? (
                    t("vencord.settings.changelog.failedToRetrieve")
                ) : (
                    <Link href={repo}>
                        {repo.split("/").slice(-2).join("/")}
                    </Link>
                )}{" "}
                (Current:{" "}
                <span className="vc-changelog-current-hash">
                    {gitHashShort}
                </span>
                )
            </Paragraph>

            <div className="vc-changelog-controls">
                <Button
                    size={Button.Sizes.SMALL}
                    disabled={isLoading || repoPending || !!repoErr}
                    onClick={fetchChangelog}
                    color={
                        recentlyChecked
                            ? Button.Colors.GREEN
                            : Button.Colors.BRAND
                    }
                >
                    {isLoading
                        ? t("vencord.loading")
                        : recentlyChecked
                            ? t("vencord.settings.changelog.upToDate")
                            : t("vencord.settings.changelog.fetchRepo")
                    }
                </Button>

                {changelogHistory.length > 0 && (
                    <>
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
                            {showHistory ? t("vencord.logs.hideLogs") : t("vencord.logs.showLogs")}
                        </Button>
                        <Button
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.RED}
                            onClick={() => {
                                Alerts.show({
                                    title: t("vencord.logs.clearAllLogs"),
                                    body: t("vencord.logs.clearAllLogsConfirmation"),
                                    confirmText: t("vencord.logs.clearAll"),
                                    confirmColor: "danger",
                                    cancelText: t("vencord.cancel"),
                                    onConfirm: async () => {
                                        await clearChangelogHistory();
                                        await loadChangelogHistory();
                                        setShowHistory(false);
                                        Toasts.show({
                                            message: t("vencord.logs.allLogsCleared"),
                                            id: Toasts.genId(),
                                            type: Toasts.Type.SUCCESS,
                                            options: {
                                                position:
                                                    Toasts.Position.BOTTOM,
                                            },
                                        });
                                    },
                                });
                            }}
                            style={{ marginLeft: "8px" }}
                        >
                            {t("vencord.logs.clearAll")}
                        </Button>
                    </>
                )}
            </div>

            {error && (
                <ErrorCard style={{ padding: "1em", marginBottom: "1em" }}>
                    <p>{error}</p>
                    <Paragraph
                        style={{
                            marginTop: "0.5em",
                            color: "var(--text-muted)",
                        }}
                    >
                        {t("vencord.settings.changelog.checkYourInternet")}
                    </Paragraph>
                </ErrorCard>
            )}

            <Divider className={Margins.bottom16} />

            {/* Current Changes Section */}
            {hasCurrentChanges ? (
                <div className="vc-changelog-current">
                    <Heading className={Margins.bottom8}>
                        {t("vencord.settings.changelog.recentChanges")}
                    </Heading>

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
                            <Heading className={Margins.bottom8}>
                                {t("vencord.settings.changelog.updatedPluginsCount", { plugins: updatedPlugins.length })}
                            </Heading>
                            <NewPluginsCompact newPlugins={updatedPlugins} />
                        </div>
                    )}

                    {/* Code Changes */}
                    {changelog.length > 0 && (
                        <div>
                            <Heading className={Margins.bottom8}>
                                {t("vencord.settings.changelog.codeChanges", { count: changelog.length })}
                            </Heading>
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
                        <Paragraph>
                            {t("vencord.settings.changelog.emptyChangelog")}
                        </Paragraph>
                    </Card>
                )
            )}

            {/* History Section */}
            {showHistory && changelogHistory.length > 0 && (
                <div className="vc-changelog-history">
                    <Divider
                        className={Margins.top16}
                        style={{ marginBottom: "1em" }}
                    />
                    <Heading className={Margins.bottom8}>
                        {t("vencord.settings.changelog.updateLogs", { count: changelogHistory.length })}
                    </Heading>
                    <Paragraph className={Margins.bottom16}>
                        {t("vencord.settings.changelog.previousSessions")}
                    </Paragraph>

                    <div className="vc-changelog-history-list">
                        {changelogHistory.map(log => (
                            <UpdateLogCard
                                key={log.id}
                                log={log}
                                repo={repo}
                                repoPending={repoPending}
                                isExpanded={expandedLogs.has(log.id)}
                                onToggleExpand={() => toggleLogExpanded(log.id)}
                                onClearLog={logId => {
                                    Alerts.show({
                                        title: t("vencord.logs.clearLog"),
                                        body: t("vencord.logs.clearLogConfirmation"),
                                        confirmText: t("vencord.logs.clearLog"),
                                        confirmColor: "danger",
                                        cancelText: t("vencord.cancel"),
                                        onConfirm: async () => {
                                            await clearIndividualLog(logId);
                                            await loadChangelogHistory();
                                            setExpandedLogs(
                                                new Set(
                                                    Array.from(
                                                        expandedLogs,
                                                    ).filter(
                                                        id => id !== logId,
                                                    ),
                                                ),
                                            );
                                            Toasts.show({
                                                message: t("vencord.logs.logCleared"),
                                                id: Toasts.genId(),
                                                type: Toasts.Type.SUCCESS,
                                                options: {
                                                    position:
                                                        Toasts.Position.BOTTOM,
                                                },
                                            });
                                        },
                                    });
                                }}
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
        <SettingsTab title={t("vencord.settings.changelog.title")}>
            <ChangelogContent />
        </SettingsTab>
    );
}

export default wrapTab(ChangelogTab, t("vencord.settings.changelog.title"));
