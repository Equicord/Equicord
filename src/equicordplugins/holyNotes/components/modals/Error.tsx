/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { resultsClasses } from "@equicordplugins/holyNotes";

export default ({ error }: { error?: Error; } = {}) => {
    if (error) {
        // Error
        console.log(error);
        return (
            <div className={resultsClasses.emptyResultsWrap}>
                <div className={resultsClasses.emptyResultsContent} style={{ paddingBottom: "0px" }}>
                    <div className={resultsClasses.errorImage} />
                    <div className={resultsClasses.emptyResultsText}>
                        There was an error parsing your notes! The issue was logged in your console, press CTRL
                        + I to access it! Please visit the support server if you need extra help!
                    </div>
                </div>
            </div>
        );
    } else if (Math.floor(Math.random() * 100) <= 10)
        // Easter egg
        return (
            <div className={resultsClasses.emptyResultsWrap}>
                <div className={resultsClasses.emptyResultsContent} style={{ paddingBottom: "0px" }}>
                    <div className={`${resultsClasses.noResultsImage} ${resultsClasses.alt}`} />
                    <div className={resultsClasses.emptyResultsText}>
                        No notes were found. Empathy banana is here for you.
                    </div>
                </div>
            </div>
        );
    // Empty notebook
    else
        return (
            <div className={resultsClasses.emptyResultsWrap}>
                <div className={resultsClasses.emptyResultsContent} style={{ paddingBottom: "0px" }}>
                    <div className={resultsClasses.noResultsImage} />
                    <div className={resultsClasses.emptyResultsText}>
                        No notes were found saved in this notebook.
                    </div>
                </div>
            </div>
        );
};
