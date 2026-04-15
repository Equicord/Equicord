/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText, BaseTextProps } from "@components/BaseText";

export type SectionProps = BaseTextProps<"div"> & {
    title?: string;
};

export function ModalSection({ children, ...restProps }: SectionProps) {
    return (
        <div style={{ marginBottom: 8 }} {...restProps}>
            <BaseText style={{ marginBottom: 8 }}
                color="header-primary"
                weight="medium"
                tag="h1"
                size="md"
            >
                {restProps.title}
            </BaseText>
            {children}
        </div>
    );
}
