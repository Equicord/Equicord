/*
 * VoiceNarratorNatural - TTS plugin with Windows Natural Voices support
 * Copyright (c) 2026 SrMoon (https://github.com/srmooon)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import { PluginNative } from "@utils/types";
import { Button, SearchableSelect, showToast, Toasts, useMemo, useState } from "@webpack/common";
import { useEffect } from "@webpack/common";

import { getSAPI5Voices, isServerRunning, SAPI5Voice, shutdownServer } from "./sapi5Server";
import { settings } from "./settings.tsx";

const Native = VencordNative.pluginHelpers.VoiceNarratorNatural as PluginNative<typeof import("./native")>;

let sapi5InstalledGlobal = false;
let sapi5Listeners: (() => void)[] = [];

export function setSapi5Installed(value: boolean) {
    sapi5InstalledGlobal = value;
    sapi5Listeners.forEach(fn => fn());
}

function groupBy<T extends object, K extends PropertyKey>(arr: T[], fn: (obj: T) => K) {
    return arr.reduce((acc, obj) => {
        const value = fn(obj);
        acc[value] ??= [];
        acc[value].push(obj);
        return acc;
    }, {} as Record<K, T[]>);
}

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

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

export function TTSProviderSection() {
    const [sapi5Ready, setSapi5Ready] = useState(sapi5InstalledGlobal);
    const { ttsProvider } = settings.use(["ttsProvider"]);

    useEffect(() => {
        const check = async () => {
            const running = await isServerRunning();
            if (running) {
                setSapi5Ready(true);
                sapi5InstalledGlobal = true;
            } else {
                const s = await Native.checkSetupStatus();
                setSapi5Ready(s.ready);
                sapi5InstalledGlobal = s.ready;
            }
        };
        check();

        const listener = () => setSapi5Ready(sapi5InstalledGlobal);
        sapi5Listeners.push(listener);
        return () => {
            sapi5Listeners = sapi5Listeners.filter(l => l !== listener);
        };
    }, []);

    const options = [
        { label: "System (Browser voices)", value: "system" },
        { label: sapi5Ready ? "SAPI5 (Windows Natural Voices)" : "SAPI5 (Not installed)", value: "sapi5" }
    ];

    const handleChange = (value: string) => {
        if (value === "sapi5" && !sapi5Ready) {
            showToast("Install SAPI5 first in the section below", Toasts.Type.FAILURE);
            return;
        }
        settings.store.ttsProvider = value;
    };

    return (
        <section>
            <Heading>TTS Provider</Heading>
            <SearchableSelect
                placeholder="Select TTS Provider"
                maxVisibleItems={5}
                options={options}
                value={options.find(o => o.value === ttsProvider)}
                onChange={handleChange}
                closeOnSelect
            />
        </section>
    );
}

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
            setSapi5Installed(true);
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
                    setSapi5Installed(false);
                    if (settings.store.ttsProvider === "sapi5") {
                        settings.store.ttsProvider = "system";
                    }
                }
            } else {
                setStatus("Not installed");
                setReady(false);
                setSapi5Installed(false);
                if (settings.store.ttsProvider === "sapi5") {
                    settings.store.ttsProvider = "system";
                }
            }
        }
    };

    useEffect(() => { checkStatus(); }, []);

    const handleSetup = async () => {
        const confirmed = await new Promise<boolean>(resolve => {
            openModal(props => (
                <ModalRoot {...props}>
                    <ModalHeader>
                        <Heading>Security Notice</Heading>
                        <ModalCloseButton onClick={() => { props.onClose(); resolve(false); }} />
                    </ModalHeader>
                    <ModalContent>
                        <Paragraph style={{ marginBottom: 12 }}>
                            This will download and install the following components:
                        </Paragraph>
                        <ul style={{ marginLeft: 20, marginBottom: 12, color: "var(--text-normal)" }}>
                            <li><Paragraph>• Python Embedded (~20MB) - Required to run SAPI5</Paragraph></li>
                            <li><Paragraph>• pyttsx3 library - Python text-to-speech library</Paragraph></li>
                        </ul>
                        <Paragraph style={{ marginBottom: 12 }}>
                            A local server will run on your machine to communicate with Windows SAPI5 voices.
                            No data is sent to external servers - everything runs locally.
                        </Paragraph>
                        <Paragraph style={{ fontWeight: "bold" }}>
                            Do you want to continue?
                        </Paragraph>
                    </ModalContent>
                    <ModalFooter>
                        <Button onClick={() => { props.onClose(); resolve(true); }}>
                            Yes, Install
                        </Button>
                        <Button
                            onClick={() => { props.onClose(); resolve(false); }}
                            color={Button.Colors.TRANSPARENT}
                            look={Button.Looks.LINK}
                            style={{ marginRight: 16 }}
                        >
                            Cancel
                        </Button>
                    </ModalFooter>
                </ModalRoot>
            ));
        });

        if (!confirmed) return;

        setLoading(true);
        setStatus("Downloading...");
        const result = await Native.performSetup();
        if (result.success) {
            setStatus("Starting...");
            const r = await Native.startServer();
            if (r.success) {
                await new Promise(r => setTimeout(r, 1500));
                await checkStatus();
                setSapi5Installed(true);
                settings.store.ttsProvider = "sapi5";
                showToast("SAPI5 installed! Provider switched to SAPI5.", Toasts.Type.SUCCESS);
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
        setSapi5Installed(false);
        settings.store.ttsProvider = "system";
        setLoading(false);
        showToast("SAPI5 removed. Provider switched to System.", Toasts.Type.SUCCESS);
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
