/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { managedStyleRootNode } from "@api/Styles";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { HeadingSecondary, HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { debounce } from "@shared/debounce";
import { EquicordDevs } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { React, TextInput } from "@webpack/common";

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

const fontImport = (family: string, weights: string) =>
    `@import url("https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights}&display=swap");`;

async function searchGoogleFonts(query: string) {
    try {
        const response = await fetch("https://fonts.google.com/$rpc/fonts.fe.catalog.actions.metadata.MetadataService/FontSearch", {
            method: "POST",
            headers: {
                "content-type": "application/json+protobuf",
                "x-user-agent": "grpc-web-javascript/0.1"
            },
            body: JSON.stringify([[query, null, null, null, null, null, 1], [5], null, 16])
        });

        const data = await response.json();
        if (!data?.[1]) return [];
        return data[1].map(([_, fontData]: [string, any[]]) => ({
            family: fontData[0],
            displayName: fontData[1],
            authors: fontData[2],
            category: fontData[3],
            variants: fontData[6].map((variant: any[]) => ({
                axes: variant[0].map(([tag, min, max]: [string, number, number]) => ({
                    tag, min, max
                }))
            }))
        }));
    } catch (err) {
        console.error("Failed to fetch fonts:", err);
        return [];
    }
}

let fontStyle: HTMLStyleElement | null = null;

function applyFont(fontFamily: string) {
    if (!fontFamily) {
        fontStyle?.remove();
        fontStyle = null;
        return;
    }

    fontStyle ??= createAndAppendStyle("vc-fontloader", managedStyleRootNode);
    fontStyle.textContent = `
        ${fontImport(fontFamily, "300;400;500;600;700")}
        * {
            --font-primary: '${fontFamily}', sans-serif !important;
            --font-display: '${fontFamily}', sans-serif !important;
            --font-headline: '${fontFamily}', sans-serif !important;
            ${settings.store.applyOnCodeBlocks ? `--font-code: '${fontFamily}', monospace !important;` : ""}
        }
    `;
}

function GoogleFontSearch({ onSelect }: { onSelect: (font: GoogleFontMetadata) => void; }) {
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<GoogleFontMetadata[]>([]);
    const [loading, setLoading] = React.useState(false);
    const previewStyle = React.useRef<HTMLStyleElement | null>(null);
    const { selectedFont } = settings.use(["selectedFont"]);

    React.useEffect(() => () => previewStyle.current?.remove(), []);

    const debouncedSearch = debounce(async (value: string) => {
        setLoading(true);
        if (!value) {
            setResults([]);
            setLoading(false);
            return;
        }

        const fonts = await searchGoogleFonts(value);
        previewStyle.current ??= createAndAppendStyle("vc-fontloader-previews", managedStyleRootNode);
        previewStyle.current.textContent = fonts.map(f => fontImport(f.family, "400;700")).join("\n");
        setResults(fonts);
        setLoading(false);
    }, 300);

    const handleSearch = (e: string) => {
        setQuery(e);
        debouncedSearch(e);
    };

    return (
        <section>
            <HeadingSecondary>Search Google Fonts</HeadingSecondary>
            <Paragraph className={Margins.bottom8}>Click on any font to apply it.</Paragraph>

            {selectedFont && (
                <div className={classes(Margins.bottom8, "eq-googlefonts-current")}>
                    <Paragraph>Current font: <strong>{selectedFont}</strong></Paragraph>
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                            settings.store.selectedFont = "";
                            applyFont("");
                        }}
                    >
                        Reset Font
                    </Button>
                </div>
            )}

            <TextInput
                value={query}
                onChange={e => handleSearch(e)}
                placeholder="Search fonts..."
                disabled={loading}
            />

            {results.length > 0 && (
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
                            {font.authors?.length && (
                                <Paragraph className={Margins.top8} style={{ opacity: 0.7 }}>
                                    by {font.authors.join(", ")}
                                </Paragraph>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </section>
    );
}

const settings = definePluginSettings({
    selectedFont: {
        type: OptionType.STRING,
        description: "Currently selected font",
        default: "",
        hidden: true
    },
    fontSearch: {
        type: OptionType.COMPONENT,
        description: "Search and select Google Fonts",
        component: () => (
            <GoogleFontSearch
                onSelect={font => {
                    settings.store.selectedFont = font.family;
                    if (isPluginEnabled("FontLoader")) applyFont(font.family);
                }}
            />
        )
    },
    applyOnCodeBlocks: {
        type: OptionType.BOOLEAN,
        description: "Apply the font to code blocks",
        default: false
    }
});

export default definePlugin({
    name: "FontLoader",
    description: "Loads any font from Google Fonts",
    tags: ["Appearance", "Customisation"],
    authors: [EquicordDevs.vmohammad],
    settings,

    start() {
        applyFont(settings.store.selectedFont);
    },

    stop() {
        applyFont("");
    }
});
