export type DetectedMoney = {
    from: string;
    amount: number;
    raw: string;
};

const SYMBOL_TO_ISO: Record<string, string> = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "₹": "INR",
    "₩": "KRW",
    "₺": "TRY",
    "₽": "RUB",
    "฿": "THB"
};

function parseNumber(s: string): number | null {
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}

/**
 * Finds ALL currency values in text
 */
export function detectAllMoney(text: string): DetectedMoney[] {
    const results: DetectedMoney[] = [];

    const symbolPattern = Object.keys(SYMBOL_TO_ISO)
        .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");

    const regex = new RegExp(
        `(${symbolPattern}|\\b[A-Z]{3}\\b)\\s*([0-9][0-9.,]*)|([0-9][0-9.,]*)\\s*(\\b[A-Z]{3}\\b)`,
        "g"
    );

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
        const from =
            match[1] && SYMBOL_TO_ISO[match[1]]
                ? SYMBOL_TO_ISO[match[1]]
                : match[1] || match[4];

        const amountRaw = match[2] || match[3];
        const amount = parseNumber(amountRaw);

        if (!from || amount == null) continue;

        results.push({
            from: from.toUpperCase(),
            amount,
            raw: match[0]
        });
    }

    return results;
}

export async function convertCurrency(from: string, to: string, amount: number) {
    if (from === to) return amount;

    const url = new URL("https://api.frankfurter.app/latest");
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("amount", String(amount));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("API error");

    const data = await res.json();
    if (!data?.rates?.[to]) throw new Error("Invalid currency");

    return data.rates[to];
}

export function format(amount: number, currency: string, precision: number) {
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
            maximumFractionDigits: precision
        }).format(amount);
    } catch {
        return `${amount.toFixed(precision)} ${currency}`;
    }
}
