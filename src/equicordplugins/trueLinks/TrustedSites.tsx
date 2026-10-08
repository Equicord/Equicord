/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { localStorage } from "@utils/localStorage";
import { findStoreLazy } from "@webpack";
import { useStateFromStores } from "@webpack/common";

const cl = classNameFactory("vc-truelinks-");

// Discord keeps the "Trust x links from now on" list here; there's no action to remove entries.
const KEY = "MaskedLinkStore";
const MaskedLinkStore = findStoreLazy(KEY);

function read(): { trustedDomains?: string[]; trustedProtocols?: string[]; } {
    try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? "{}");
        return Array.isArray(value) ? { trustedDomains: value } : value ?? {};
    } catch {
        return {};
    }
}

function untrust(domain: string) {
    const data = read();
    data.trustedDomains = (data.trustedDomains ?? []).filter(d => d !== domain);
    localStorage.setItem(KEY, JSON.stringify(data));
    MaskedLinkStore.initialize();
    MaskedLinkStore.emitChange();
}

export function TrustedSites() {
    const domains = useStateFromStores([MaskedLinkStore], () => [...(read().trustedDomains ?? [])].sort());

    return (
        <section>
            <HeadingSecondary>Trusted sites</HeadingSecondary>
            <Paragraph>Sites you ticked "Trust links from now on" for. They open without the Leaving Discord warning.</Paragraph>
            {domains.length
                ? domains.map(d => (
                    <Card key={d} className={cl("site")}>
                        {d}
                        <Button size="small" variant="dangerSecondary" onClick={() => untrust(d)}>Untrust</Button>
                    </Card>
                ))
                : <Paragraph>No trusted sites yet.</Paragraph>}
        </section>
    );
}
