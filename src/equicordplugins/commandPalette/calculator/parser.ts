/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { resolveTimezone } from "./timezones";
import type { CalculatorIntent } from "./types";

const CURRENCY_RATE_PATTERN = /\b(?:usd|eur|gbp|cad|aud|jpy|cny|inr|btc|eth|usdt|sol)\b/i;

const WEEKDAY_TO_INDEX: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
};

function normalizeQuery(input: string): string {
    return input.trim().replace(/\s+/g, " ");
}

function parseNumber(input: string): number | null {
    const normalized = input.trim().toLowerCase().replace(/,/g, "");
    const match = normalized.match(/^(-?\d+(?:\.\d+)?)([kmb])?$/);
    if (!match) return null;

    const base = Number(match[1]);
    if (!Number.isFinite(base)) return null;

    const suffix = match[2];
    if (!suffix) return base;
    if (suffix === "k") return base * 1000;
    if (suffix === "m") return base * 1000000;
    return base * 1000000000;
}

function parseTimeToken(input: string): { hour: number; minute: number; hasMeridiem: boolean; meridiem?: "am" | "pm"; } | null {
    const normalized = input.trim().toLowerCase();
    const withMeridiem = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/);
    if (withMeridiem) {
        let hour = Number(withMeridiem[1]);
        const minute = Number(withMeridiem[2] ?? "0");
        const meridiem = withMeridiem[3] as "am" | "pm";
        if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59 || hour < 1 || hour > 12) return null;
        if (meridiem === "am") {
            if (hour === 12) hour = 0;
        } else if (hour !== 12) {
            hour += 12;
        }
        return {
            hour,
            minute,
            hasMeridiem: true,
            meridiem
        };
    }

    const military = normalized.match(/^(\d{1,2})(?::(\d{2}))$/);
    if (military) {
        const hour = Number(military[1]);
        const minute = Number(military[2]);
        if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        return {
            hour,
            minute,
            hasMeridiem: false
        };
    }

    return null;
}

type DateDirection = "until" | "since";

const MONTH_INDEX: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sept: 8,
    sep: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11
};

function parseDateLoose(input: string, direction: DateDirection): Date | null {
    const trimmed = input
        .trim()
        .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
        .replace(/,/g, "");
    if (!trimmed) return null;

    const yearOnly = trimmed.match(/^(\d{4})$/);
    if (yearOnly) {
        const year = Number(yearOnly[1]);
        return new Date(year, 0, 1);
    }

    const dayMonth = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/);
    const monthDay = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
    const structured = dayMonth
        ? { day: Number(dayMonth[1]), monthToken: dayMonth[2], yearToken: dayMonth[3] }
        : monthDay
            ? { day: Number(monthDay[2]), monthToken: monthDay[1], yearToken: monthDay[3] }
            : null;

    if (structured) {
        const month = MONTH_INDEX[structured.monthToken.toLowerCase()];
        if (month == null || structured.day < 1 || structured.day > 31) return null;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const year = structured.yearToken ? Number(structured.yearToken) : now.getFullYear();
        let candidate = new Date(year, month, structured.day);

        if (!structured.yearToken) {
            if (direction === "until" && candidate < today) {
                candidate = new Date(year + 1, month, structured.day);
            } else if (direction === "since" && candidate > today) {
                candidate = new Date(year - 1, month, structured.day);
            }
        }

        if (Number.isNaN(candidate.getTime())) return null;
        return candidate;
    }

    return null;
}

function parseUnitConversion(query: string): CalculatorIntent | null {
    const match = query.match(/^(-?\d+(?:\.\d+)?(?:[kmb])?)\s*([a-zA-Z°]+)\s+(?:in|to)\s+([a-zA-Z]+)$/i);
    if (!match) return null;

    const value = parseNumber(match[1]);
    if (value == null) return null;

    const fromUnit = match[2].trim().toLowerCase();
    const toUnit = match[3].trim().toLowerCase();

    if (toUnit === "timespan") {
        return {
            kind: "duration_timespan",
            value,
            unit: fromUnit,
            displayInput: query
        };
    }

    return {
        kind: "unit_convert",
        value,
        fromUnit,
        toUnit,
        displayInput: query
    };
}

function parseTimeTimezoneConversion(query: string): CalculatorIntent | null {
    const match = query.match(/^(.+?)\s+([a-zA-Z/_ ]+)\s+(?:to|in)\s+([a-zA-Z/_ ]+)$/i);
    if (!match) return null;

    const time = parseTimeToken(match[1]);
    if (!time) return null;

    const fromTimezone = resolveTimezone(match[2]);
    const toTimezone = resolveTimezone(match[3]);
    if (!fromTimezone || !toTimezone) return null;

    return {
        kind: "timezone_convert",
        hour: time.hour,
        minute: time.minute,
        fromTimezone,
        toTimezone,
        displayInput: query
    };
}

function parseTimeDiff(query: string): CalculatorIntent | null {
    const match = query.match(/^(.+?)\s*-\s*(.+)$/);
    if (!match) return null;

    const left = parseTimeToken(match[1]);
    const right = parseTimeToken(match[2]);
    if (!left || !right) return null;

    return {
        kind: "time_diff",
        leftHour: left.hour,
        leftMinute: left.minute,
        rightHour: right.hour,
        rightMinute: right.minute,
        displayInput: query
    };
}

function parseSingleTime(query: string): CalculatorIntent | null {
    const time = parseTimeToken(query);
    if (!time) return null;

    return {
        kind: "time_convert",
        hour: time.hour,
        minute: time.minute,
        hasMeridiem: time.hasMeridiem,
        meridiem: time.meridiem,
        displayInput: query
    };
}

function parseTimezoneNow(query: string): CalculatorIntent | null {
    const match = query.match(/^time in (.+)$/i);
    if (!match) return null;

    const timezone = resolveTimezone(match[1]);
    if (!timezone) return null;

    return {
        kind: "timezone_now",
        timezone,
        displayInput: query
    };
}

function parseDaysUntil(query: string): CalculatorIntent | null {
    const match = query.match(/^days until (.+)$/i);
    if (!match) return null;

    const targetDate = parseDateLoose(match[1], "until");
    if (!targetDate) return null;

    return {
        kind: "days_until",
        targetDate,
        displayInput: query
    };
}

function parseDaysSince(query: string): CalculatorIntent | null {
    const match = query.match(/^days since (.+)$/i);
    if (!match) return null;

    const targetDate = parseDateLoose(match[1], "since");
    if (!targetDate) return null;

    return {
        kind: "days_since",
        targetDate,
        displayInput: query
    };
}

function parseWeekdayInWeeks(query: string): CalculatorIntent | null {
    const match = query.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+in\s+(\d+)\s+weeks?$/i);
    if (!match) return null;

    const weekday = WEEKDAY_TO_INDEX[match[1].toLowerCase()];
    const weeks = Number(match[2]);
    if (!Number.isFinite(weeks)) return null;

    return {
        kind: "weekday_in_weeks",
        weekday,
        weeks,
        displayInput: query
    };
}

function parseMath(query: string): CalculatorIntent | null {
    const lowered = query.toLowerCase();
    let expression = lowered
        .replace(/\$/g, "")
        .replace(/\bsquare root of\s+(-?\d+(?:\.\d+)?)\b/g, "sqrt($1)")
        .replace(/\b(-?\d+(?:\.\d+)?)\s+power\s+(-?\d+(?:\.\d+)?)\b/g, "($1^$2)")
        .replace(/\b(-?\d+(?:\.\d+)?)\s*%\s+of\s+(-?\d+(?:\.\d+)?(?:[kmb])?)\b/g, "(($1/100)*$2)")
        .replace(/\b(-?\d+(?:\.\d+)?)\s*([kmb])\b/g, (_, value: string, suffix: string) => {
            const parsed = parseNumber(`${value}${suffix}`);
            return String(parsed ?? value);
        });

    expression = expression.replace(/\^/g, "**");

    if (!/[0-9]/.test(expression)) return null;
    if (!/^[0-9+\-*/().\s%*sqrt]+$/.test(expression.replace(/\bsqrt\b/g, "sqrt"))) return null;

    return {
        kind: "math",
        expression,
        displayInput: query
    };
}

export function parseCalculatorQuery(rawQuery: string): CalculatorIntent | null {
    const query = normalizeQuery(rawQuery);
    if (!query) return null;

    const lowered = query.toLowerCase();
    if (CURRENCY_RATE_PATTERN.test(lowered) && /\b(?:to|in)\b/i.test(lowered)) {
        return { kind: "unsupported_rate" };
    }

    return parseTimeTimezoneConversion(query)
        ?? parseTimeDiff(query)
        ?? parseTimezoneNow(query)
        ?? parseWeekdayInWeeks(query)
        ?? parseDaysSince(query)
        ?? parseDaysUntil(query)
        ?? parseUnitConversion(query)
        ?? parseSingleTime(query)
        ?? parseMath(query);
}
