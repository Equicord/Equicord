/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function findArrayContainingId(node: any, id: string): any[] | null {
    if (!node) return null
    if (Array.isArray(node)) {
        if (node.some((c) => c?.props?.id === id)) return node
        for (const child of node) {
            const found = findArrayContainingId(child, id)
            if (found) return found
        }
        return null
    }
    if (node.props?.children) {
        return findArrayContainingId(node.props.children, id)
    }
    return null
}
