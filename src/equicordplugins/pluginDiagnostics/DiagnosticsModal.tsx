/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Layer 3: UI (render ONLY — no scanning, no scoring) ─────────────────────

import "./styles.css";

import { saveFile } from "@utils/web";
import { Modal, React, useState } from "@webpack/common";

import type { ScoredPlugin } from "./scoring";

type SortKey = "name" | "hooks" | "listeners" | "patches" | "uiInjects" | "risk";

const COLUMNS: { key: SortKey; label: string; tip: string; num: boolean; }[] = [
    { key: "name", label: "Plugin", tip: "Plugin name", num: false },
    { key: "hooks", label: "Hooks", tip: "Registered slash commands", num: true },
    { key: "listeners", label: "Listeners", tip: "Flux/Dispatcher subscriptions", num: true },
    { key: "patches", label: "Patches", tip: "Webpack code patches", num: true },
    { key: "uiInjects", label: "UI Injects", tip: "Context menus + UI render surfaces", num: true },
    { key: "risk", label: "Risk", tip: "(patches×2) + (listeners×3) + (uiInjects×1.5)", num: true },
];

function exportJson(rows: ScoredPlugin[], heapMB: number | null) {
    const payload = {
        type: "plugin-diagnostics",
        version: 1,
        takenAt: new Date().toISOString(),
        heapMB,
        plugins: rows,
    };
    const date = new Date().toISOString().slice(0, 10);
    saveFile(new File([JSON.stringify(payload, null, 2)], `plugin-diagnostics-${date}.json`, { type: "application/json" }));
}

export function DiagnosticsModal({ modalProps, initial, heapMB, rescan }: {
    modalProps: any;
    initial: ScoredPlugin[];
    heapMB: number | null;
    rescan: () => ScoredPlugin[];
}) {
    const [rows, setRows] = useState<ScoredPlugin[]>(initial);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("risk");
    const [asc, setAsc] = useState(false);

    function sortBy(key: SortKey) {
        if (key === sortKey) setAsc(!asc);
        else { setSortKey(key); setAsc(key === "name"); }
    }

    const q = search.trim().toLowerCase();
    const view = rows
        .filter(r => !q || r.name.toLowerCase().includes(q))
        .sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            const cmp = typeof av === "string"
                ? (av as string).localeCompare(bv as string)
                : (av as number) - (bv as number);
            return asc ? cmp : -cmp;
        });

    return (
        <Modal {...modalProps} size="lg" title="Plugin Diagnostics">
            <div className="vc-diag">
                <div className="vc-diag-sub">One-time plugin resource snapshot</div>

                <div className="vc-diag-toolbar">
                    <input
                        className="vc-diag-search"
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch((e.target as HTMLInputElement).value)}
                    />
                    <div className="vc-diag-actions">
                        {heapMB != null && (
                            <span className="vc-diag-heap" title="Current JS heap">Heap: {heapMB} MB</span>
                        )}
                        <button className="vc-diag-btn" onClick={() => setRows(rescan())}>Re-scan</button>
                        <button className="vc-diag-btn" onClick={() => exportJson(view, heapMB)}>Export JSON</button>
                    </div>
                </div>

                <div className="vc-diag-tablewrap">
                    <table className="vc-diag-table">
                        <thead>
                            <tr>
                                {COLUMNS.map(c => (
                                    <th
                                        key={c.key}
                                        title={c.tip}
                                        className={c.num ? "num" : ""}
                                        onClick={() => sortBy(c.key)}
                                    >
                                        {c.label}{sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {view.length === 0 ? (
                                <tr><td colSpan={6} className="vc-diag-empty">No results</td></tr>
                            ) : view.map(r => (
                                <tr key={r.name} className={`vc-diag-row lvl-${r.level}`}>
                                    <td>{r.name}</td>
                                    <td className="num">{r.hooks}</td>
                                    <td className="num">{r.listeners}</td>
                                    <td className="num">{r.patches}</td>
                                    <td className="num">{r.uiInjects}</td>
                                    <td className="num"><span className={`vc-diag-badge ${r.level}`}>{r.risk}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="vc-diag-foot">{view.length} / {rows.length} plugins</div>
            </div>
        </Modal>
    );
}
