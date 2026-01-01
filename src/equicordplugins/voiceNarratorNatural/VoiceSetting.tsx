/*
 * VoiceNarratorNatural - TTS plugin with Windows Natural Voices support
 * Copyright (c) 2026 SrMoon (https://github.com/srmooon)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { PluginNative } from "@utils/types";
import { Button, SearchableSelect, showToast, Toasts, useMemo, useState } from "@webpack/common";
import { useEffect } from "@webpack/common";

import { getSAPI5Voices, isServerRunning, SAPI5Voice, shutdownServer } from "./sapi5Server";
import { settings } from "./settings.tsx";

const Native = VencordNative.pluginHelpers.VoiceNarratorNatural as PluginNative<typeof import("./native")>;

// Agrupa vozes por idioma
function groupBy<T extends object, K extends PropertyKey>(arr: T[], fn: (obj: T) => K) {
    return arr.reduce((acc, obj) => {
        const value = fn(obj);
        acc[value] ??= [];
        acc[value].push(obj);
        return acc;
    }, {} as Record<K, T[]>);
}

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

// Picker simples
function SimplePicker({ voice, voices }: { voice: string | undefined; voices: SpeechSynthesisVoice[]; }) {
    const options = voices.map(v => ({
        label: v.name,
        value: v.voiceURI,
        default: v.default,
    }));

    return (
        <SearchableSelect
            placeholder="Select a voice"
            maxVisibleItems={5}
            options={options}
            value={options.find(o => o.value === voice)}
            onChange={v => settings.store.voice = v}
            closeOnSelect
        />
    );
}

// Picker com seleção de idioma primeiro
function ComplexPicker({ voice, voices }: { voice: string | undefined; voices: SpeechSynthesisVoice[]; }) {
    const groupedVoices = useMemo(() => groupBy(voices, v => v.lang), [voices]);

    const languageNameMapping = useMemo(() => {
        const list = [] as { name: string; friendlyName: string; }[];
        for (const name in groupedVoices) {
            try {
                const friendlyName = languageNames.of(name);
                if (friendlyName) list.push({ name, friendlyName });
            } catch { }
        }
        return list;
    }, [groupedVoices]);

    const currentVoice = voices.find(v => v.voiceURI === voice);
    const [selectedLanguage, setSelectedLanguage] = useState(() => currentVoice?.lang ?? languageNameMapping[0]?.name);

    if (languageNameMapping.length === 1) {
        return <SimplePicker voice={voice} voices={groupedVoices[languageNameMapping[0].name]} />;
    }

    const voicesForLanguage = groupedVoices[selectedLanguage] || [];
    const languageOptions = languageNameMapping.map(l => ({ label: l.friendlyName, value: l.name }));

    return (
        <>
            <SearchableSelect
                placeholder="Select language"
                options={languageOptions}
                value={languageOptions.find(l => l.value === selectedLanguage)}
                onChange={v => setSelectedLanguage(v)}
                maxVisibleItems={5}
                closeOnSelect
            />
            <div style={{ marginTop: 8 }}>
                <SimplePicker voice={voice} voices={voicesForLanguage} />
            </div>
        </>
    );
}

// Componente de seleção de voz do sistema
export function SystemVoiceSection() {
    const voices = useMemo(() => window.speechSynthesis?.getVoices() ?? [], []);
    const { voice } = settings.use(["voice"]);

    if (!voices.length) return <Paragraph>No system voices found.</Paragraph>;

    const Picker = voices.length > 20 ? ComplexPicker : SimplePicker;

    return (
        <section>
            <Heading>System Voice</Heading>
            <Picker voice={voice} voices={voices} />
        </section>
    );
}

// Componente de setup e seleção de voz SAPI5
export function SAPI5Section() {
    const githubLink = "https://github.com/gexgd0419/NaturalVoiceSAPIAdapter";
    const [status, setStatus] = useState("Checking...");
    const [voices, setVoices] = useState<SAPI5Voice[]>([]);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const { sapi5Voice } = settings.use(["sapi5Voice"]);

    const checkStatus = async () => {
        if (await isServerRunning()) {
            setStatus("✓ Running");
            const v = await getSAPI5Voices();
            setVoices(v);
            setReady(true);
        } else {
            const s = await Native.checkSetupStatus();
            if (s.ready) {
                setStatus("Starting...");
                const r = await Native.startServer();
                if (r.success) {
                    await new Promise(r => setTimeout(r, 1500));
                    await checkStatus();
                } else {
                    setStatus("Failed to start");
                    setReady(false);
                }
            } else {
                setStatus("Not installed");
                setReady(false);
            }
        }
    };

    useEffect(() => { checkStatus(); }, []);

    const handleSetup = async () => {
        setLoading(true);
        setStatus("Downloading...");
        const result = await Native.performSetup();
        if (result.success) {
            setStatus("Starting...");
            const r = await Native.startServer();
            if (r.success) {
                await new Promise(r => setTimeout(r, 1500));
                await checkStatus();
            } else {
                setStatus("Failed to start");
            }
        } else {
            setStatus("Failed: " + result.error);
        }
        setLoading(false);
    };

    const handleCleanup = async () => {
        setLoading(true);
        await shutdownServer();
        await Native.cleanupData();
        setStatus("Not installed");
        setVoices([]);
        setReady(false);
        setLoading(false);
        showToast("SAPI5 removed", Toasts.Type.SUCCESS);
    };

    const voiceOptions = voices.map(v => ({ label: v.name, value: v.id }));

    return (
        <section>
            <Heading>SAPI5 Natural Voices</Heading>
            <Paragraph>
                To use natural voices, install them from{" "}
                <a href={githubLink} target="_blank" rel="noreferrer" style={{ color: "#00AFF4" }}>
                    NaturalVoiceSAPIAdapter
                </a>
                {" "}first.
            </Paragraph>
            <Paragraph>Status: {status}</Paragraph>

            {!ready && !loading && (
                <Button onClick={handleSetup} size={Button.Sizes.SMALL} style={{ marginTop: 8 }}>
                    Install SAPI5 (~20MB)
                </Button>
            )}

            {loading && <Paragraph>Please wait...</Paragraph>}

            {ready && voices.length > 0 && (
                <div style={{ marginTop: 8 }}>
                    <SearchableSelect
                        placeholder="Select SAPI5 voice"
                        maxVisibleItems={5}
                        options={voiceOptions}
                        value={voiceOptions.find(o => o.value === sapi5Voice)}
                        onChange={v => settings.store.sapi5Voice = v}
                        closeOnSelect
                    />
                </div>
            )}

            {ready && (
                <Button
                    onClick={handleCleanup}
                    color={Button.Colors.RED}
                    look={Button.Looks.OUTLINED}
                    size={Button.Sizes.SMALL}
                    style={{ marginTop: 8 }}
                    disabled={loading}
                >
                    Uninstall SAPI5
                </Button>
            )}
        </section>
    );
}
