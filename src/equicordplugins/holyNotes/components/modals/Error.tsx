/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { resultsClasses } from "@equicordplugins/holyNotes";

export default function EmptyNotebook({ error }: { error?: Error; } = {}) {
    if (error) {
        console.error("[HolyNotes] Error:", error);
        return (
            <div className={resultsClasses.emptyResultsWrap}>
                <div className={resultsClasses.emptyResultsContent} style={{ paddingBottom: 0 }}>
                    <div className={resultsClasses.errorImage} />
                    <div className={resultsClasses.emptyResultsText}>
                        There was an error parsing your notes. Check the console for details.
                    </div>
                </div>
            </div>
        );
    }

    const isEasterEgg = Math.random() < 0.1;

    return (
        <div className={resultsClasses.emptyResultsWrap}>
            <div className={resultsClasses.emptyResultsContent} style={{ paddingBottom: 0 }}>
                <div className={`${resultsClasses.noResultsImage}${isEasterEgg ? ` ${resultsClasses.alt}` : ""}`} />
                <div className={resultsClasses.emptyResultsText}>
                    {isEasterEgg
                        ? "No notes were found. Empathy banana is here for you."
                        : "No notes were found in this notebook."}
                </div>
            </div>
        </div>
    );
}
