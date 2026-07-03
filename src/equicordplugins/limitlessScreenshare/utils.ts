/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function normalize(value: number, minValue: number, maxValue: number): number | undefined {
  return (value - minValue) / (maxValue - minValue) * 100;
}

export function denormalize(number: number, minValue: number, maxValue: number) {
  return number * (maxValue - minValue) / 100 + minValue;
}
