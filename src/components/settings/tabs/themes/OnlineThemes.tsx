/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { React, TextInput } from "@webpack/common";

const cl = classNameFactory("vc-settings-theme-");

export function Validator({ link, onValidate }: { link: string; onValidate: (valid: boolean) => void; }) {
    const [res, err, pending] = useAwaiter(() => fetch(link).then(res => {
        if (res.status > 300) throw `${res.status} ${res.statusText}`;
        const contentType = res.headers.get("Content-Type");
        if (!contentType?.startsWith("text/css") && !contentType?.startsWith("text/plain")) {
            onValidate(false);
            throw "Not a CSS file. Remember to use the raw link!";
        }

        onValidate(true);
        return "Okay!";
    }));

    const text = pending
        ? "Checking..."
        : err
            ? `Error: ${err instanceof Error ? err.message : String(err)}`
            : "Valid!";

    return <Paragraph style={{
        color: pending ? "var(--text-muted)" : err ? "var(--text-feedback-critical)" : "var(--status-positive)"
    }}>{text}</Paragraph>;
}

export interface OnlineThemesSectionProps {
    enableOnlineThemes: boolean;
    setEnableOnlineThemes: (value: boolean) => void;
    currentThemeLink: string;
    setCurrentThemeLink: (value: string) => void;
    themeLinkValid: boolean;
    setThemeLinkValid: (value: boolean) => void;
    addThemeLink: (link: string) => void;
}

export function OnlineThemesSection({
    enableOnlineThemes,
    setEnableOnlineThemes,
    currentThemeLink,
    setCurrentThemeLink,
    themeLinkValid,
    setThemeLinkValid,
    addThemeLink
}: OnlineThemesSectionProps) {
    return (
        <>
            <Heading className={Margins.top20}>Online Themes</Heading>
            <Paragraph className={Margins.bottom16}>
                Load themes directly from URLs instead of local files. Online themes auto-update when the source changes, so you always have the latest version without manual downloads.
            </Paragraph>
            <FormSwitch
                title="Enable Online Themes"
                description="Toggle online theme loading. When disabled, all online themes will be turned off and you won't be able to add new ones."
                value={enableOnlineThemes}
                onChange={setEnableOnlineThemes}
            />

            <Notice.Info className={Margins.bottom16} style={{ width: "100%" }}>
                Looking for themes? Check out <Link href="https://betterdiscord.app/themes">BetterDiscord Themes</Link> or search on <Link href="https://github.com/search?q=discord+theme">GitHub</Link>. When downloading from BetterDiscord, click "Download" and place the .theme.css file into your themes folder.
            </Notice.Info>

            <div className={cl("link-row")}>
                <TextInput
                    placeholder="https://example.com/theme.css"
                    value={currentThemeLink}
                    onChange={setCurrentThemeLink}
                    disabled={!enableOnlineThemes}
                />
                <Button onClick={() => addThemeLink(currentThemeLink)} disabled={!themeLinkValid || !enableOnlineThemes}>
                    Add
                </Button>
            </div>
            {currentThemeLink && (
                <div className={Margins.top8}>
                    <Validator link={currentThemeLink} onValidate={setThemeLinkValid} />
                </div>
            )}
        </>
    );
}
