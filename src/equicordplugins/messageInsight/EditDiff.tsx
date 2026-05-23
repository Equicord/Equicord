/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Modal, React } from "@webpack/common";

interface DiffToken {
    type: "same" | "add" | "remove";
    text: string;
}

function lcs(a: string[], b: string[]): number[][] {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp;
}

export function wordDiff(before: string, after: string): DiffToken[] {
    const a = before.split(/(\s+)/);
    const b = after.split(/(\s+)/);
    const dp = lcs(a, b);
    const result: DiffToken[] = [];
    let i = a.length, j = b.length;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            result.unshift({ type: "same", text: a[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: "add", text: b[j - 1] });
            j--;
        } else {
            result.unshift({ type: "remove", text: a[i - 1] });
            i--;
        }
    }
    return result;
}

function DiffView({ before, after }: { before: string; after: string; }) {
    const tokens = wordDiff(before, after);
    return (
        <div className="vc-messageinsight-diff-view">
            {tokens.map((token, i) => {
                if (token.type === "same") return <span key={i}>{token.text}</span>;
                if (token.type === "add") return <span key={i} className="vc-messageinsight-diff-add">{token.text}</span>;
                return <span key={i} className="vc-messageinsight-diff-remove">{token.text}</span>;
            })}
        </div>
    );
}

export function EditDiffModal({ modalProps, history }: { modalProps: any; history: string[]; }) {
    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Edit History"
        >
            <div className="vc-messageinsight-modal-body">
                {history.length < 2 ? (
                    <p className="vc-messageinsight-empty-text">
                        No edit history available.
                    </p>
                ) : (
                    history.slice(0, -1).map((version, i) => (
                        <div key={i} className="vc-messageinsight-edit-entry">
                            <div className="vc-messageinsight-edit-label">
                                {`Edit ${i + 1}`}
                            </div>
                            <DiffView before={version} after={history[i + 1]} />
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
}
