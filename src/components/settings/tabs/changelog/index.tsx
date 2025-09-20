/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import "./styles.css";

import { ErrorCard } from "@components/ErrorCard";
import { Link } from "@components/Link";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { changes, getRepo, UpdateLogger } from "@utils/updater";
import { Button, Card, Forms, React, Toasts } from "@webpack/common";

import gitHash from "~git-hash";

interface ChangelogEntry {
    hash: string;
    author: string;
    message: string;
}

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

function ChangelogContent() {
    const [repo, repoErr, repoPending] = useAwaiter(getRepo, {
        fallbackValue: "Loading...",
    });
    const [changelog, setChangelog] = React.useState<ChangelogEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

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
    }, []);

    const fetchChangelog = React.useCallback(async () => {
        if (repoPending || repoErr) return;

        setIsLoading(true);
        setError(null);

        try {
            // Try to fetch updates to get the most recent changelog
            const updates = await VencordNative.updater.getUpdates();

            if (updates.ok && updates.value && updates.value.length > 0) {
                setChangelog(updates.value);
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
                    {gitHash.slice(0, 7)}
                </span>
                )
            </Forms.FormText>

            <div className="vc-changelog-refresh-btn">
                <Button
                    size={Button.Sizes.SMALL}
                    disabled={isLoading || repoPending || !!repoErr}
                    onClick={fetchChangelog}
                >
                    {isLoading ? "Loading..." : "Refresh Changelog"}
                </Button>
            </div>

            {error && (
                <ErrorCard style={{ padding: "1em", marginBottom: "1em" }}>
                    <p>{error}</p>
                </ErrorCard>
            )}

            <Forms.FormDivider className={Margins.bottom16} />

            {changelog.length === 0 && !isLoading && !error ? (
                <Card className="vc-changelog-empty">
                    <Forms.FormText>
                        No recent changes available. Click "Refresh Changelog"
                        to check for updates.
                    </Forms.FormText>
                </Card>
            ) : changelog.length > 0 ? (
                <>
                    <Forms.FormTitle tag="h5">
                        Recent Changes ({changelog.length}{" "}
                        {changelog.length === 1 ? "commit" : "commits"})
                    </Forms.FormTitle>
                    <div style={{ marginTop: "0.75em" }}>
                        {changelog.map((entry) => (
                            <ChangelogCard
                                key={entry.hash}
                                entry={entry}
                                repo={repo}
                                repoPending={repoPending}
                            />
                        ))}
                    </div>
                </>
            ) : null}
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
