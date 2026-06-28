/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */



let _isEnabled = false;
export function isPluginEnabled() { return _isEnabled; }
export function setIsEnabled(v: boolean) { _isEnabled = v; }

let _forceUpdate: (() => void) | null = null;
export function getForceUpdateWidget() { return _forceUpdate; }
export function setForceUpdateWidget(fn: (() => void) | null) { _forceUpdate = fn; }
