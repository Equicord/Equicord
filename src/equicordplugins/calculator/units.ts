/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Unit conversion engine. Syntax: "5 km to miles" or "100 celsius to fahrenheit"
// Each category defines units relative to a base unit (factor to multiply to get base).
// Temperature uses special conversion functions.

interface UnitDef {
    names: string[];
    toBase: (v: number) => number;
    fromBase: (v: number) => number;
}

interface UnitCategory {
    units: UnitDef[];
}

function linear(factor: number): Pick<UnitDef, "toBase" | "fromBase"> {
    return {
        toBase: v => v * factor,
        fromBase: v => v / factor,
    };
}

const CATEGORIES: UnitCategory[] = [
    // ── Length (base: meters) ──
    {
        units: [
            { names: ["m", "meter", "meters", "metre", "metres"], ...linear(1) },
            { names: ["km", "kilometer", "kilometers", "kilometre", "kilometres"], ...linear(1000) },
            { names: ["cm", "centimeter", "centimeters", "centimetre", "centimetres"], ...linear(0.01) },
            { names: ["mm", "millimeter", "millimeters", "millimetre", "millimetres"], ...linear(0.001) },
            { names: ["um", "micrometer", "micrometers", "micrometre", "micrometres", "micron", "microns"], ...linear(1e-6) },
            { names: ["nm", "nanometer", "nanometers", "nanometre", "nanometres"], ...linear(1e-9) },
            { names: ["mi", "mile", "miles"], ...linear(1609.344) },
            { names: ["yd", "yard", "yards"], ...linear(0.9144) },
            { names: ["ft", "foot", "feet"], ...linear(0.3048) },
            { names: ["in", "inch", "inches"], ...linear(0.0254) },
            { names: ["nmi", "nautical mile", "nautical miles"], ...linear(1852) },
            { names: ["ly", "light year", "light years", "lightyear", "lightyears"], ...linear(9.461e15) },
            { names: ["au", "astronomical unit", "astronomical units"], ...linear(1.496e11) },
        ]
    },
    // ── Mass (base: grams) ──
    {
        units: [
            { names: ["g", "gram", "grams", "gramme", "grammes"], ...linear(1) },
            { names: ["kg", "kilogram", "kilograms", "kilo", "kilos"], ...linear(1000) },
            { names: ["mg", "milligram", "milligrams"], ...linear(0.001) },
            { names: ["ug", "microgram", "micrograms"], ...linear(1e-6) },
            { names: ["t", "tonne", "tonnes", "metric ton", "metric tons"], ...linear(1e6) },
            { names: ["lb", "lbs", "pound", "pounds"], ...linear(453.592) },
            { names: ["oz", "ounce", "ounces"], ...linear(28.3495) },
            { names: ["st", "stone", "stones"], ...linear(6350.29) },
            { names: ["ct", "carat", "carats"], ...linear(0.2) },
        ]
    },
    // ── Temperature (special) ──
    {
        units: [
            {
                names: ["c", "celsius", "°c"],
                toBase: v => v,
                fromBase: v => v,
            },
            {
                names: ["f", "fahrenheit", "°f"],
                toBase: v => (v - 32) * 5 / 9,
                fromBase: v => v * 9 / 5 + 32,
            },
            {
                names: ["k", "kelvin"],
                toBase: v => v - 273.15,
                fromBase: v => v + 273.15,
            },
        ]
    },
    // ── Time (base: seconds) ──
    {
        units: [
            { names: ["s", "sec", "second", "seconds"], ...linear(1) },
            { names: ["ms", "millisecond", "milliseconds"], ...linear(0.001) },
            { names: ["us", "microsecond", "microseconds"], ...linear(1e-6) },
            { names: ["ns", "nanosecond", "nanoseconds"], ...linear(1e-9) },
            { names: ["min", "minute", "minutes"], ...linear(60) },
            { names: ["h", "hr", "hour", "hours"], ...linear(3600) },
            { names: ["d", "day", "days"], ...linear(86400) },
            { names: ["wk", "week", "weeks"], ...linear(604800) },
            { names: ["mo", "month", "months"], ...linear(2629746) },
            { names: ["yr", "year", "years"], ...linear(31556952) },
        ]
    },
    // ── Volume (base: liters) ──
    {
        units: [
            { names: ["l", "liter", "liters", "litre", "litres"], ...linear(1) },
            { names: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"], ...linear(0.001) },
            { names: ["cl", "centiliter", "centiliters"], ...linear(0.01) },
            { names: ["dl", "deciliter", "deciliters"], ...linear(0.1) },
            { names: ["gal", "gallon", "gallons"], ...linear(3.78541) },
            { names: ["qt", "quart", "quarts"], ...linear(0.946353) },
            { names: ["pt", "pint", "pints"], ...linear(0.473176) },
            { names: ["cup", "cups"], ...linear(0.236588) },
            { names: ["floz", "fl oz", "fluid ounce", "fluid ounces"], ...linear(0.0295735) },
            { names: ["tbsp", "tablespoon", "tablespoons"], ...linear(0.0147868) },
            { names: ["tsp", "teaspoon", "teaspoons"], ...linear(0.00492892) },
            { names: ["m3", "cubic meter", "cubic meters", "cubic metre", "cubic metres"], ...linear(1000) },
            { names: ["cm3", "cubic centimeter", "cubic centimeters", "cc"], ...linear(0.001) },
        ]
    },
    // ── Speed (base: m/s) ──
    {
        units: [
            { names: ["m/s", "meters per second", "metres per second"], ...linear(1) },
            { names: ["km/h", "kph", "kilometers per hour", "kmh"], ...linear(1 / 3.6) },
            { names: ["mph", "miles per hour"], ...linear(0.44704) },
            { names: ["knot", "knots", "kn", "kt"], ...linear(0.514444) },
            { names: ["ft/s", "feet per second", "fps"], ...linear(0.3048) },
            { names: ["mach"], ...linear(343) },
        ]
    },
    // ── Area (base: m²) ──
    {
        units: [
            { names: ["m2", "sq m", "square meter", "square meters", "square metre"], ...linear(1) },
            { names: ["km2", "sq km", "square kilometer", "square kilometers"], ...linear(1e6) },
            { names: ["cm2", "sq cm", "square centimeter", "square centimeters"], ...linear(1e-4) },
            { names: ["mm2", "sq mm", "square millimeter", "square millimeters"], ...linear(1e-6) },
            { names: ["ha", "hectare", "hectares"], ...linear(10000) },
            { names: ["acre", "acres", "ac"], ...linear(4046.86) },
            { names: ["sq ft", "square foot", "square feet", "ft2"], ...linear(0.092903) },
            { names: ["sq in", "square inch", "square inches", "in2"], ...linear(0.00064516) },
            { names: ["sq mi", "square mile", "square miles", "mi2"], ...linear(2.59e6) },
            { names: ["sq yd", "square yard", "square yards", "yd2"], ...linear(0.836127) },
        ]
    },
    // ── Data (base: bytes) ──
    {
        units: [
            { names: ["b", "byte", "bytes"], ...linear(1) },
            { names: ["kb", "kilobyte", "kilobytes"], ...linear(1024) },
            { names: ["mb", "megabyte", "megabytes"], ...linear(1024 ** 2) },
            { names: ["gb", "gigabyte", "gigabytes"], ...linear(1024 ** 3) },
            { names: ["tb", "terabyte", "terabytes"], ...linear(1024 ** 4) },
            { names: ["pb", "petabyte", "petabytes"], ...linear(1024 ** 5) },
            { names: ["bit", "bits"], ...linear(1 / 8) },
            { names: ["kbit", "kilobit", "kilobits"], ...linear(1024 / 8) },
            { names: ["mbit", "megabit", "megabits"], ...linear(1024 ** 2 / 8) },
            { names: ["gbit", "gigabit", "gigabits"], ...linear(1024 ** 3 / 8) },
        ]
    },
    // ── Energy (base: joules) ──
    {
        units: [
            { names: ["j", "joule", "joules"], ...linear(1) },
            { names: ["kj", "kilojoule", "kilojoules"], ...linear(1000) },
            { names: ["cal", "calorie", "calories"], ...linear(4.184) },
            { names: ["kcal", "kilocalorie", "kilocalories"], ...linear(4184) },
            { names: ["wh", "watt hour", "watt hours"], ...linear(3600) },
            { names: ["kwh", "kilowatt hour", "kilowatt hours"], ...linear(3.6e6) },
            { names: ["ev", "electronvolt", "electronvolts"], ...linear(1.602e-19) },
            { names: ["btu", "british thermal unit", "british thermal units"], ...linear(1055.06) },
        ]
    },
    // ── Pressure (base: pascals) ──
    {
        units: [
            { names: ["pa", "pascal", "pascals"], ...linear(1) },
            { names: ["kpa", "kilopascal", "kilopascals"], ...linear(1000) },
            { names: ["mpa", "megapascal", "megapascals"], ...linear(1e6) },
            { names: ["bar", "bars"], ...linear(100000) },
            { names: ["atm", "atmosphere", "atmospheres"], ...linear(101325) },
            { names: ["psi", "pounds per square inch"], ...linear(6894.76) },
            { names: ["mmhg", "torr"], ...linear(133.322) },
        ]
    },
    // ── Angle (base: radians) ──
    {
        units: [
            { names: ["rad", "radian", "radians"], ...linear(1) },
            { names: ["deg", "degree", "degrees", "°"], ...linear(Math.PI / 180) },
            { names: ["grad", "gradian", "gradians", "gon"], ...linear(Math.PI / 200) },
            { names: ["turn", "turns", "rev", "revolution", "revolutions"], ...linear(Math.PI * 2) },
        ]
    },
];

// Build lookup: unit name → { category index, unit index }
interface UnitLookup {
    catIdx: number;
    unitIdx: number;
}

const unitMap = new Map<string, UnitLookup>();

for (let ci = 0; ci < CATEGORIES.length; ci++) {
    const cat = CATEGORIES[ci];
    for (let ui = 0; ui < cat.units.length; ui++) {
        for (const name of cat.units[ui].names) {
            unitMap.set(name.toLowerCase(), { catIdx: ci, unitIdx: ui });
        }
    }
}

// Regex to match: <number> <unit> to/in/as <unit>
const CONVERT_RE = /^\s*(-?\d+(?:\.\d+)?)\s+(.+?)\s+(?:to|in|as)\s+(.+?)\s*$/i;

export function tryConvertUnits(input: string): string | null {
    const match = CONVERT_RE.exec(input);
    if (!match) return null;

    const value = parseFloat(match[1]);
    const fromName = match[2].toLowerCase().trim();
    const toName = match[3].toLowerCase().trim();

    const from = unitMap.get(fromName);
    const to = unitMap.get(toName);

    if (!from || !to) return null;
    if (from.catIdx !== to.catIdx) return null;

    const fromUnit = CATEGORIES[from.catIdx].units[from.unitIdx];
    const toUnit = CATEGORIES[to.catIdx].units[to.unitIdx];

    const baseValue = fromUnit.toBase(value);
    const result = toUnit.fromBase(baseValue);

    const formatted = Number.isInteger(result) ? result.toString() : result.toPrecision(10).replace(/\.?0+$/, "");
    return `${value} ${match[2].trim()} = ${formatted} ${match[3].trim()}`;
}
