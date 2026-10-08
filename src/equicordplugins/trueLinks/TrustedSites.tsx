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

const KEY = "MaskedLinkStore";
const MaskedLinkStore = findStoreLazy(KEY);

const read = (): { trustedDomains?: string[]; } => JSON.parse(localStorage.getItem(KEY) ?? "{}");

function untrust(domain: string) {
    const data = read();
    data.trustedDomains = data.trustedDomains?.filter(d => d !== domain);
    localStorage.setItem(KEY, JSON.stringify(data));
    MaskedLinkStore.initialize();
    MaskedLinkStore.emitChange();
}

export function TrustedSites() {
    const domains = useStateFromStores([MaskedLinkStore], () => [...read().trustedDomains ?? []].sort());

    return (
        <section>
            <HeadingSecondary>Trusted sites</HeadingSecondary>
            <Paragraph>Links to these sites open without a warning.</Paragraph>
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
