/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    formatDateMedium,
    formatDurationMinutes,
    formatNumber,
    formatRawNumber,
    formatTime12,
    formatTime24,
    formatTimespanMinutes,
    numberToWords
} from "./formatters";
import { convertTimeBetweenTimezones, getNowInTimezone, getTimezoneCountryName, getTimezoneDate } from "./timezones";
import type { CalculatorIntent, CalculatorResult } from "./types";

type UnitKind = "length" | "mass" | "temperature" | "duration";

type UnitDefinition = {
    kind: UnitKind;
    toBase: (value: number) => number;
    fromBase: (value: number) => number;
    label: string;
};

const UNITS: Record<string, UnitDefinition> = {
    mm: { kind: "length", toBase: v => v / 1000, fromBase: v => v * 1000, label: "mm" },
    cm: { kind: "length", toBase: v => v / 100, fromBase: v => v * 100, label: "cm" },
    m: { kind: "length", toBase: v => v, fromBase: v => v, label: "m" },
    km: { kind: "length", toBase: v => v * 1000, fromBase: v => v / 1000, label: "km" },
    in: { kind: "length", toBase: v => v * 0.0254, fromBase: v => v / 0.0254, label: "in" },
    inch: { kind: "length", toBase: v => v * 0.0254, fromBase: v => v / 0.0254, label: "in" },
    inches: { kind: "length", toBase: v => v * 0.0254, fromBase: v => v / 0.0254, label: "in" },
    ft: { kind: "length", toBase: v => v * 0.3048, fromBase: v => v / 0.3048, label: "ft" },
    feet: { kind: "length", toBase: v => v * 0.3048, fromBase: v => v / 0.3048, label: "ft" },
    yd: { kind: "length", toBase: v => v * 0.9144, fromBase: v => v / 0.9144, label: "yd" },
    mi: { kind: "length", toBase: v => v * 1609.344, fromBase: v => v / 1609.344, label: "mi" },
    g: { kind: "mass", toBase: v => v, fromBase: v => v, label: "g" },
    kg: { kind: "mass", toBase: v => v * 1000, fromBase: v => v / 1000, label: "kg" },
    lb: { kind: "mass", toBase: v => v * 453.59237, fromBase: v => v / 453.59237, label: "lb" },
    lbs: { kind: "mass", toBase: v => v * 453.59237, fromBase: v => v / 453.59237, label: "lb" },
    oz: { kind: "mass", toBase: v => v * 28.349523125, fromBase: v => v / 28.349523125, label: "oz" },
    c: { kind: "temperature", toBase: v => v, fromBase: v => v, label: "°C" },
    "°c": { kind: "temperature", toBase: v => v, fromBase: v => v, label: "°C" },
    f: { kind: "temperature", toBase: v => (v - 32) * (5 / 9), fromBase: v => v * (9 / 5) + 32, label: "°F" },
    "°f": { kind: "temperature", toBase: v => (v - 32) * (5 / 9), fromBase: v => v * (9 / 5) + 32, label: "°F" },
    k: { kind: "temperature", toBase: v => v - 273.15, fromBase: v => v + 273.15, label: "K" },
    s: { kind: "duration", toBase: v => v, fromBase: v => v, label: "s" },
    sec: { kind: "duration", toBase: v => v, fromBase: v => v, label: "s" },
    second: { kind: "duration", toBase: v => v, fromBase: v => v, label: "s" },
    seconds: { kind: "duration", toBase: v => v, fromBase: v => v, label: "s" },
    min: { kind: "duration", toBase: v => v * 60, fromBase: v => v / 60, label: "min" },
    mins: { kind: "duration", toBase: v => v * 60, fromBase: v => v / 60, label: "min" },
    minute: { kind: "duration", toBase: v => v * 60, fromBase: v => v / 60, label: "min" },
    minutes: { kind: "duration", toBase: v => v * 60, fromBase: v => v / 60, label: "min" },
    h: { kind: "duration", toBase: v => v * 3600, fromBase: v => v / 3600, label: "h" },
    hr: { kind: "duration", toBase: v => v * 3600, fromBase: v => v / 3600, label: "h" },
    hrs: { kind: "duration", toBase: v => v * 3600, fromBase: v => v / 3600, label: "h" },
    hour: { kind: "duration", toBase: v => v * 3600, fromBase: v => v / 3600, label: "h" },
    hours: { kind: "duration", toBase: v => v * 3600, fromBase: v => v / 3600, label: "h" },
    d: { kind: "duration", toBase: v => v * 86400, fromBase: v => v / 86400, label: "d" },
    day: { kind: "duration", toBase: v => v * 86400, fromBase: v => v / 86400, label: "d" },
    days: { kind: "duration", toBase: v => v * 86400, fromBase: v => v / 86400, label: "d" }
};

function evaluateMathExpression(expression: string): number | null {
    const compact = expression.replace(/\s+/g, "");
    if (!compact) return null;

    const prepared = compact.replace(/sqrt\(/g, "Math.sqrt(").replace(/%/g, "/100");
    if (!/^[0-9+\-*/().Mathsqrt]+$/.test(prepared)) return null;

    try {
        const evaluate = Function(`"use strict"; return (${prepared});`) as () => unknown;
        const result = evaluate();
        if (typeof result !== "number" || !Number.isFinite(result)) return null;
        return result;
    } catch {
        return null;
    }
}

function getMathOperationLabel(expression: string): string {
    const compact = expression.replace(/\s+/g, "");
    const operations = new Set<"add" | "subtract" | "multiply" | "divide" | "power">();

    const isBinary = (index: number, width = 1) => {
        const prev = compact[index - 1];
        const next = compact[index + width];
        return /[0-9.)]/.test(prev ?? "") && /[0-9.(s]/.test(next ?? "");
    };

    for (let i = 0; i < compact.length; i++) {
        const current = compact[i];

        if (current === "*" && compact[i + 1] === "*") {
            if (isBinary(i, 2)) operations.add("power");
            i += 1;
            continue;
        }

        if (current === "+" && isBinary(i)) operations.add("add");
        if (current === "-" && isBinary(i)) operations.add("subtract");
        if (current === "*" && isBinary(i)) operations.add("multiply");
        if (current === "/" && isBinary(i)) operations.add("divide");
    }

    if (operations.size > 1) return "Expression";
    if (operations.has("power")) return "Power";
    if (operations.has("multiply")) return "Product";
    if (operations.has("divide")) return "Divide";
    if (operations.has("subtract")) return "Difference";
    return "Sum";
}

function positiveModulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
}

function evaluateTimeDifference(leftHour: number, leftMinute: number, rightHour: number, rightMinute: number): number {
    const left = leftHour * 60 + leftMinute;
    const right = rightHour * 60 + rightMinute;
    const diff = positiveModulo(left - right, 1440);
    if (diff > 720) return 1440 - diff;
    return diff;
}

function evaluateWeekdayInWeeks(weekday: number, weeks: number): Date {
    const now = new Date();
    const start = new Date(now);
    const currentWeekday = start.getDay();
    const daysFromMonday = positiveModulo(currentWeekday - 1, 7);
    start.setDate(start.getDate() - daysFromMonday + weeks * 7);
    const targetOffset = positiveModulo(weekday - 1, 7);
    start.setDate(start.getDate() + targetOffset);
    start.setHours(0, 0, 0, 0);
    return start;
}

function evaluateDaysUntil(targetDate: Date): number {
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
    return Math.ceil((target - current) / 86400000);
}

function evaluateDaysSince(targetDate: Date): number {
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
    return Math.floor((current - target) / 86400000);
}

function evaluateUnitConversion(value: number, fromUnit: string, toUnit: string): { value: number; label: string; } | null {
    const from = UNITS[fromUnit];
    const to = UNITS[toUnit];
    if (!from || !to) return null;
    if (from.kind !== to.kind) return null;

    const base = from.toBase(value);
    const converted = to.fromBase(base);
    if (!Number.isFinite(converted)) return null;

    return {
        value: converted,
        label: to.label
    };
}

function durationToMinutes(value: number, unit: string): number | null {
    const from = UNITS[unit];
    if (!from || from.kind !== "duration") return null;
    const seconds = from.toBase(value);
    return seconds / 60;
}

export function evaluateCalculatorIntent(intent: CalculatorIntent): CalculatorResult | null {
    if (intent.kind === "unsupported_rate") return null;

    if (intent.kind === "math") {
        const value = evaluateMathExpression(intent.expression);
        if (value == null) return null;
        return {
            kind: "number",
            displayInput: intent.displayInput,
            displayAnswer: formatNumber(value),
            rawAnswer: formatRawNumber(value),
            secondaryText: "Answer",
            tertiaryText: getMathOperationLabel(intent.expression)
        };
    }

    if (intent.kind === "time_convert") {
        if (intent.hasMeridiem) {
            return {
                kind: "time",
                displayInput: intent.displayInput,
                displayAnswer: formatTime24(intent.hour, intent.minute),
                rawAnswer: formatTime24(intent.hour, intent.minute),
                secondaryText: formatTime12(intent.hour, intent.minute).toLowerCase()
            };
        }

        const converted = formatTime12(intent.hour, intent.minute);
        return {
            kind: "time",
            displayInput: intent.displayInput,
            displayAnswer: converted,
            rawAnswer: converted,
            secondaryText: formatTime24(intent.hour, intent.minute)
        };
    }

    if (intent.kind === "time_diff") {
        const diffMinutes = evaluateTimeDifference(intent.leftHour, intent.leftMinute, intent.rightHour, intent.rightMinute);
        const duration = formatDurationMinutes(diffMinutes);
        return {
            kind: "duration",
            displayInput: intent.displayInput,
            displayAnswer: duration.display,
            rawAnswer: duration.raw,
            secondaryText: formatTime12(intent.rightHour, intent.rightMinute).toLowerCase()
        };
    }

    if (intent.kind === "timezone_convert") {
        const converted = convertTimeBetweenTimezones(intent.hour, intent.minute, intent.fromTimezone, intent.toTimezone);
        if (!converted) return null;

        const dayShift = converted.dayShift === 0
            ? ""
            : converted.dayShift > 0
                ? ` (+${converted.dayShift}d)`
                : ` (${converted.dayShift}d)`;

        return {
            kind: "time",
            displayInput: intent.displayInput,
            displayAnswer: `${formatTime24(converted.hour, converted.minute)}${dayShift}`,
            rawAnswer: formatTime24(converted.hour, converted.minute),
            secondaryText: formatTime12(converted.hour, converted.minute).toLowerCase()
        };
    }

    if (intent.kind === "timezone_now") {
        const now = getNowInTimezone(intent.timezone);
        const country = getTimezoneCountryName(intent.timezone);
        const date = getTimezoneDate(intent.timezone);
        return {
            kind: "time",
            displayInput: intent.displayInput,
            displayAnswer: formatTime24(now.hour, now.minute),
            rawAnswer: formatTime24(now.hour, now.minute),
            secondaryText: country ?? intent.timezone,
            tertiaryText: formatDateMedium(date)
        };
    }

    if (intent.kind === "days_until") {
        const days = evaluateDaysUntil(intent.targetDate);
        return {
            kind: "date",
            displayInput: intent.displayInput,
            displayAnswer: `${days} ${Math.abs(days) === 1 ? "day" : "days"}`,
            rawAnswer: String(days),
            secondaryText: formatDateMedium(intent.targetDate)
        };
    }

    if (intent.kind === "days_since") {
        const days = evaluateDaysSince(intent.targetDate);
        return {
            kind: "date",
            displayInput: intent.displayInput,
            displayAnswer: `${days} ${Math.abs(days) === 1 ? "day" : "days"}`,
            rawAnswer: String(days),
            secondaryText: formatDateMedium(intent.targetDate)
        };
    }

    if (intent.kind === "weekday_in_weeks") {
        const date = evaluateWeekdayInWeeks(intent.weekday, intent.weeks);
        const dateText = formatDateMedium(date);
        return {
            kind: "date",
            displayInput: intent.displayInput,
            displayAnswer: dateText,
            rawAnswer: date.toISOString(),
            secondaryText: `${Math.max(intent.weeks, 0)} weeks ahead`
        };
    }

    if (intent.kind === "unit_convert") {
        const conversion = evaluateUnitConversion(intent.value, intent.fromUnit, intent.toUnit);
        if (!conversion) return null;
        const formatted = formatNumber(conversion.value);
        return {
            kind: "unit",
            displayInput: intent.displayInput,
            displayAnswer: `${formatted} ${conversion.label}`,
            rawAnswer: `${formatRawNumber(conversion.value)} ${conversion.label}`,
            secondaryText: numberToWords(Math.trunc(conversion.value)) || undefined
        };
    }

    if (intent.kind === "duration_timespan") {
        const minutes = durationToMinutes(intent.value, intent.unit);
        if (minutes == null) return null;
        return {
            kind: "duration",
            displayInput: intent.displayInput,
            displayAnswer: formatTimespanMinutes(minutes),
            rawAnswer: String(minutes),
            secondaryText: `${formatNumber(minutes)} minutes`
        };
    }

    return null;
}
