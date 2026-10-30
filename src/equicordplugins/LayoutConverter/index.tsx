import definePlugin from "@utils/types";
import { EquicordDevs } from "@utils/constants";
import { Message } from "@vencord/discord-types";
import { ChannelStore, useEffect, useState } from "@webpack/common";
import { settings } from "./settings";
// uhh lang import (cuz its fast to load ik)
import data from "./maps/data.json";
import ar from "./maps/ar.json";
import ru from "./maps/ru.json";

type LangMap = {
    map: Record<string, string>;
    range: number[][];
};

const maps: Record<string, LangMap> = {
    ar: ar as LangMap,
    ru: ru as LangMap
};

const EN_RANGE: number[][] = [[65, 90], [97, 122]];

const revCache: Record<string, Record<string, string>> = {};

function getRange(lang: string): number[][] {
    return maps[lang]?.range ?? EN_RANGE;
}

function inRange(char: string, ranges: number[][]): boolean {
    const code = char.charCodeAt(0);
    for (const [s, e] of ranges) {
        if (code >= s && code <= e) return true;
    }
    return false;
}

function buildReverse(m: Record<string, string>): Record<string, string> {
    const rev: Record<string, string> = {};
    for (const [k, v] of Object.entries(m)) {
        if (rev[v] === undefined) {
            rev[v] = k;
        } else {
            const existing = rev[v];
            const kIsLower = k === k.toLowerCase() && k !== k.toUpperCase();
            const exIsLower = existing === existing.toLowerCase() && existing !== existing.toUpperCase();
            if (kIsLower && !exIsLower) rev[v] = k;
        }
    }
    return rev;
}

function getReverse(lang: string): Record<string, string> {
    if (!revCache[lang]) {
        revCache[lang] = buildReverse(maps[lang].map);
    }
    return revCache[lang];
}

function convertText(text: string): string {
    const target = settings.store.language ?? data.deflang;
    if (!maps[target]) return text;

    const fwd = maps[target].map;
    const rev = getReverse(target);
    const tRange = getRange(target);

    let out = "";
    let i = 0;
    while (i < text.length) {
        if (i + 1 < text.length) {
            const pair = text.substring(i, i + 2);
            if (
                rev[pair] !== undefined &&
                inRange(text[i], tRange) &&
                inRange(text[i + 1], tRange)
            ) {
                out += rev[pair];
                i += 2;
                continue;
            }
        }

        const char = text[i];

        if (inRange(char, tRange)) {
            out += rev[char] ?? char;
            i++;
            continue;
        }

        if (inRange(char, EN_RANGE)) {
            out += fwd[char] ?? char;
            i++;
            continue;
        }

        const inFwd = fwd[char] !== undefined;
        const inRev = rev[char] !== undefined;
        if (inFwd && !inRev) {
            out += fwd[char];
        } else if (inRev && !inFwd) {
            out += rev[char];
        } else {
            out += char;
        }
        i++;
    }
    return out;
}

const ConvertIcon = ({ height = 20, width = 20, className, style }: { height?: string | number; width?: string | number; className?: string; style?: React.CSSProperties; }) => (
// DO NOT EDIT THE SVG PATH PLS
    <svg viewBox="0 0 24 24" fill="currentColor" width={width} height={height} className={className} style={style}>
        <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
    </svg>
);

const setters = new Map<string, (v: string) => void>();

export function handleConvert(id: string, text: string) {
    setters.get(id)?.(text);
}

function Dismiss({ onDismiss }: { onDismiss: () => void; }) {
    return (
        <button
            onClick={onDismiss}
            style={{
                all: "unset",
                cursor: "pointer",
                color: "var(--text-link)"
            }}
        >
            Dismiss
        </button>
    );
}

export function ConvertAccessory({ message }: { message: Message; }) {
    const [converted, setConverted] = useState<string>();

    useEffect(() => {
        setters.set(message.id, setConverted);
        return () => void setters.delete(message.id);
    }, [message.id]);

    if (!converted || converted === message.content) return null;

    return (
        <span style={{
            color: "var(--text-muted)",
            marginTop: "0.5em",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: "1.2rem",
            whiteSpace: "break-spaces"
        }}>
            <ConvertIcon width={16} height={16} style={{ marginRight: "0.25em" }} /><br />
            {converted}
            <br />
            (Converted - <Dismiss onDismiss={() => setConverted(undefined)} />)
        </span>
    );
}

export default definePlugin({
    name: "LayoutConverter",
    description: "converts text between keyboard layouts (arabic and russian only)",
    authors: [EquicordDevs.coder],
    dependencies: ["MessagePopoverAPI", "MessageAccessoriesAPI"],
    settings,

    renderMessageAccessory: props => <ConvertAccessory message={props.message} />,

    messagePopoverButton: {
        icon: ConvertIcon,
        render(msg: Message) {
            if (!msg.content || msg.content.trim().length === 0) return null;

            return {
                label: "Convert",
                icon: ConvertIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => {
                    const out = convertText(msg.content);
                    handleConvert(msg.id, out);
                }
            };
        }
    }
});
