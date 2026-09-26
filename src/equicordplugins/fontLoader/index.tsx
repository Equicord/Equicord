/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings, migratePluginSetting } from "@api/Settings";
import { Card } from "@components/Card";
import { HeadingSecondary, HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { debounce } from "@shared/debounce";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { React, TextInput } from "@webpack/common";

const logger = new Logger("FontLoader");

interface GoogleFontMetadata {
    family: string;
    displayName: string;
    authors: string[];
    category?: number;
    popularity?: number;
    variants: Array<{
        axes: Array<{
            tag: string;
            min: number;
            max: number;
        }>;
    }>;
}

const createGoogleFontUrl = (family: string, options = "") =>
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}${options}&display=swap`;

const appliedLinks: HTMLLinkElement[] = [];
const previewLinks: HTMLLinkElement[] = [];
let searchAbort: AbortController | null = null;

function addFontLink(url: string, bucket: HTMLLinkElement[]) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
    bucket.push(link);
    return link;
}

function clearLinks(bucket: HTMLLinkElement[]) {
    for (const el of bucket.splice(0)) el.remove();
}

async function searchGoogleFonts(query: string, signal?: AbortSignal) {
    try {
        const response = await fetch("https://fonts.google.com/$rpc/fonts.fe.catalog.actions.metadata.MetadataService/FontSearch", {
            method: "POST",
            headers: {
                "content-type": "application/json+protobuf",
                "x-user-agent": "grpc-web-javascript/0.1"
            },
            body: JSON.stringify([[query, null, null, null, null, null, 1], [5], null, 16]),
            signal
        });

        if (!response.ok) return [];
        const data: unknown = await response.json();
        const rows = Array.isArray((data as unknown[])?.[1]) ? (data as unknown[][])[1] as unknown[] : [];
        const fonts: GoogleFontMetadata[] = [];

        for (const row of rows) {
            if (!Array.isArray(row) || !Array.isArray((row as unknown[])[1])) continue;
            const fontData = (row as unknown[])[1] as unknown[];
            const family = typeof fontData[0] === "string" ? fontData[0] : "";
            if (!family) continue;
            const displayName = typeof fontData[1] === "string" ? fontData[1] : family;
            const authors = Array.isArray(fontData[2])
                ? (fontData[2] as unknown[]).filter((a): a is string => typeof a === "string")
                : [];
            const category = typeof fontData[3] === "number" ? fontData[3] : undefined;
            const variants = Array.isArray(fontData[6])
                ? (fontData[6] as unknown[])
                    .filter((v): v is unknown[] => Array.isArray(v))
                    .map(v => ({
                        axes: (Array.isArray(v[0]) ? v[0] as unknown[] : [])
                            .filter((a): a is unknown[] => Array.isArray(a))
                            .map(a => (typeof a[0] === "string" && typeof a[1] === "number" && typeof a[2] === "number"
                                ? { tag: a[0], min: a[1], max: a[2] }
                                : null))
                            .filter((a): a is NonNullable<typeof a> => a !== null)
                    }))
                : [];
            fonts.push({ family, displayName, authors, category, variants });
        }

        return fonts;
    } catch (err) {
        if ((err as Error)?.name === "AbortError") return [];
        logger.error("Failed to fetch fonts:", err);
        return [];
    }
}

const preloadFont = (family: string) =>
    addFontLink(createGoogleFontUrl(family, ":wght@400;700"), previewLinks);

let styleElement: HTMLStyleElement | null = null;

const applyFont = (fontFamily: string) => {
    if (!fontFamily) {
        styleElement?.remove();
        styleElement = null;
        clearLinks(appliedLinks);
        return;
    }

    try {
        clearLinks(appliedLinks);

        if (!styleElement) {
            styleElement = document.createElement("style");
            document.head.appendChild(styleElement);
        }

        const escaped = fontFamily.replace(/'/g, "\\'");
        addFontLink(createGoogleFontUrl(fontFamily, ":wght@300;400;500;600;700"), appliedLinks);
        styleElement.textContent = `
            :root {
                --font-primary: '${escaped}', sans-serif !important;
                --font-display: '${escaped}', sans-serif !important;
                --font-headline: '${escaped}', sans-serif !important;
                ${settings.store.applyOnCodeBlocks ? `--font-code: '${escaped}', monospace !important;` : ""}
            }
        `;
    } catch (err) {
        logger.error("Failed to load font:", err);
    }
};

function GoogleFontSearch({ onSelect }: { onSelect: (font: GoogleFontMetadata) => void; }) {
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<GoogleFontMetadata[]>([]);
    const [loading, setLoading] = React.useState(false);
    const requestId = React.useRef(0);

    React.useEffect(() => () => {
        clearLinks(previewLinks);
    }, []);

    const debouncedSearch = React.useMemo(() => debounce(async (value: string, id: number) => {
        if (!value) {
            if (requestId.current === id) {
                clearLinks(previewLinks);
                setResults([]);
                setLoading(false);
            }
            return;
        }

        searchAbort?.abort();
        searchAbort = new AbortController();
        const fonts = await searchGoogleFonts(value, searchAbort.signal);
        if (requestId.current !== id) return;
        clearLinks(previewLinks);
        for (const f of fonts.slice(0, 8)) preloadFont(f.family);
        setResults(fonts);
        setLoading(false);
    }, 300), []);

    const handleSearch = (value: string) => {
        setQuery(value);
        setLoading(true);
        debouncedSearch(value, ++requestId.current);
    };

    return (
        <section>
            <HeadingSecondary>Search Google Fonts</HeadingSecondary>
            <Paragraph className={Margins.bottom8}>Click on any font to apply it.</Paragraph>

            <TextInput
                value={query}
                onChange={handleSearch}
                placeholder="Search fonts..."
            />
            {loading ? <Paragraph className={Margins.top8} style={{ opacity: 0.7 }}>Loading...</Paragraph> : null}

            {results.length ? (
                <div className={classes(Margins.top8, "eq-googlefonts-results")}>
                    {results.map(font => (
                        <Card
                            key={font.family}
                            className={classes("eq-googlefonts-card", Margins.bottom8)}
                            onClick={() => onSelect(font)}
                        >
                            <div className="eq-googlefonts-preview" style={{ fontFamily: font.family }}>
                                <HeadingTertiary>{font.displayName}</HeadingTertiary>
                                <Paragraph>The quick brown fox jumps over the lazy dog</Paragraph>
                            </div>
                            {font.authors?.length ? (
                                <Paragraph className={Margins.top8} style={{ opacity: 0.7 }}>
                                    by {font.authors.join(", ")}
                                </Paragraph>
                            ) : null}
                        </Card>
                    ))}
                </div>
            ) : null}
            {!loading && query && !results.length ? (
                <Paragraph className={Margins.top8} style={{ opacity: 0.7 }}>No fonts found.</Paragraph>
            ) : null}
        </section>
    );
}

function FontSearchSetting() {
    return (
        <GoogleFontSearch
            onSelect={font => {
                settings.store.selectedFont = font.family;
                applyFont(font.family);
            }}
        />
    );
}

migratePluginSetting("FontLoader", "applyOnCodeBlocks", "applyOnClodeBlocks");
const settings = definePluginSettings({
    selectedFont: {
        type: OptionType.STRING,
        description: "Currently selected font.",
        default: "",
        hidden: true
    },
    fontSearch: {
        type: OptionType.COMPONENT,
        description: "Search and select Google Fonts.",
        component: FontSearchSetting
    },
    applyOnCodeBlocks: {
        type: OptionType.BOOLEAN,
        description: "Apply the font to code blocks.",
        default: false,
        onChange: () => {
            const font = settings.store.selectedFont;
            if (font) applyFont(font);
        }
    }
});

export default definePlugin({
    name: "FontLoader",
    description: "Loads any font from Google Fonts.",
    tags: ["Appearance", "Customisation"],
    authors: [EquicordDevs.vmohammad],
    settings,

    start() {
        const savedFont = settings.store.selectedFont;
        if (savedFont) {
            applyFont(savedFont);
        }
    },

    stop() {
        searchAbort?.abort();
        searchAbort = null;
        clearLinks(appliedLinks);
        clearLinks(previewLinks);
        if (styleElement) {
            styleElement.remove();
            styleElement = null;
        }
    }
});
