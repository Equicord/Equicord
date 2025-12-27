import { Message } from "@vencord/discord-types";
import { Parser, useEffect, useState } from "@webpack/common";

import { settings } from "./settings";
import { detectAllMoney, convertCurrency, format } from "./converter";
import { SmallIcon } from "./icon";

const setters = new Map<string, Function>();

export function Accessory({ message }: { message: Message }) {
    const [text, setText] = useState<string | null>(null);

    useEffect(() => {
        setters.set(message.id, setText);
        return () => void setters.delete(message.id);
    }, []);

    if (!text) return null;

    return (
        <span className="eq-currency-accessory">
            <SmallIcon />
            {Parser.parse(text)}{" "}
            <button className="eq-currency-dismiss" onClick={() => setText(null)}>
                Dismiss
            </button>
        </span>
    );
}

export async function handleConvert(message: Message) {
    const set = setters.get(message.id);
    if (!set) return;

    const detected = detectAllMoney(message.content);
    if (!detected.length) {
        set("No currency values found.");
        return;
    }

    const target = settings.store.targetCurrency.toUpperCase();
    const precision = settings.store.precision;

    const lines: string[] = [];

    for (const d of detected) {
        try {
            const converted = await convertCurrency(d.from, target, d.amount);
            lines.push(
                `${format(d.amount, d.from, precision)} → ${format(converted, target, precision)}`
            );
        } catch {
            lines.push(`${d.raw} → conversion failed`);
        }
    }

    set(lines.join("\n"));
}
