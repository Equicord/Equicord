/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { OptionComponentMap } from "@components/settings/tabs/plugins/components";
import { RenderModalProps } from "@vencord/discord-types";
import { closeModal, Modal, openModal, SearchableSelect, Select, useEffect } from "@webpack/common";

import { AIProviderPresets, checkApiKey, ConfiguredAIProvider, getAIProviderPreset } from "./ai";
import { ApiKeyInput } from "./ApiKeyInput";
import { resetCredentialWarning } from "./credentials";
import { ProviderModels } from "./ProviderModels";
import { getAIModels, getAIProviders, getMixedSources, settings } from "./settings";
import { deeplTranslate, kagiTranslate } from "./utils";

const SubscriptionKeys = ["service", "aiProviders", "aiSelected", "mixedSources", "mixedJudge", "deeplApiKey", "kagiSession"] as const;
const Subscriptions = [...SubscriptionKeys];
const ProviderOptions = [
    { label: "OpenAI", value: "openai" },
    { label: "OpenRouter", value: "openrouter" },
    { label: "Anthropic", value: "anthropic" },
    { label: "Custom", value: "custom" }
] as const;
const Fields = [
    ["aiProviderName", "name"],
    ["aiApiKey", "apiKey"],
    ["aiBaseUrl", "baseUrl"], ["aiFormat", "format"], ["aiAuthorizationHeader", "authorizationHeader"]
] as const;
const BuiltinCredentials = [{ key: "deeplApiKey", name: "DeepL" }, { key: "kagiSession", name: "Kagi" }] as const;
const ProviderSubscriptionKeys: ["aiProviders"] = ["aiProviders"];
const BuiltinSubscriptionKeys: (typeof BuiltinCredentials[number]["key"])[] = ["deeplApiKey", "kagiSession"];

interface BuiltinProviderEditorProps {
    credential: typeof BuiltinCredentials[number];
    rootProps: RenderModalProps;
    autoFocus?: boolean;
}

function BuiltinProviderEditor({ credential: { key, name }, rootProps, autoFocus }: BuiltinProviderEditorProps) {
    const values = settings.use(BuiltinSubscriptionKeys);
    return (
        <Modal {...rootProps} title={name}>
            <ApiKeyInput
                id={key}
                value={values[key]}
                label={key === "kagiSession" ? "Kagi session" : "API key"}
                autoFocus={autoFocus}
                onChange={(value: string) => settings.store[key] = value}
                disabled={!values[key].trim()}
                check={signal => key === "deeplApiKey"
                    ? deeplTranslate("Hello.", "EN", "FR", undefined, !settings.store.deeplApiKey.endsWith(":fx"), false, false, signal)
                    : kagiTranslate("Hello.", "en_us", "fr", undefined, false, signal)}
            />
        </Modal>
    );
}

interface ProviderEditorProps {
    providerId: string;
    modalKey: string;
    rootProps: RenderModalProps;
    closePluginSettings(): void;
    autoFocus?: boolean;
}

function ProviderEditor({ providerId, modalKey, rootProps, closePluginSettings, autoFocus }: ProviderEditorProps) {
    settings.use(ProviderSubscriptionKeys);
    const provider = getAIProviders().find(entry => entry.id === providerId);
    useEffect(() => {
        if (provider) return;
        closeModal(`${modalKey}-remove`);
        closeModal(modalKey);
    }, [provider?.id, modalKey]);
    if (!provider) return null;

    const preset = getAIProviderPreset(provider.baseUrl);
    const pluginSettings = { enabled: isPluginEnabled("Translate"), ...Object.fromEntries(Fields.map(([key, field]) => [key, provider[field]])) };

    return (
        <Modal {...rootProps} title={provider.name}>
            <div className="vc-trans-provider-content">
                <div className="vc-trans-ai-settings">
                    {Fields.map(([key, field]) => {
                        if ((field === "format" || field === "authorizationHeader") && preset) return null;
                        const setting = settings.def[key];
                        const Component = OptionComponentMap[setting.type];
                        return (
                            <div key={field} className={field === "name" || field === "baseUrl" || field === "apiKey" ? "vc-trans-ai-settings-wide" : undefined}>
                                {field === "apiKey" ? <ApiKeyInput
                                    id={provider.id}
                                    value={provider.apiKey}
                                    autoFocus={autoFocus}
                                    onChange={value => {
                                        settings.store.aiProviders = getAIProviders().map(entry => entry.id === provider.id ? { ...entry, apiKey: value } : entry);
                                    }}
                                    disabled={!provider.apiKey.trim() || !provider.model.trim() || !provider.baseUrl.trim()}
                                    check={signal => checkApiKey(provider, signal)}
                                /> : <Component
                                    id={`${provider.id}-${field}`}
                                    setting={{ ...setting, description: "" }}
                                    pluginSettings={{ ...pluginSettings, [`${provider.id}-${field}`]: provider[field] }}
                                    definedSettings={settings}
                                    closePluginSettings={closePluginSettings}
                                    onChange={(value: string | number) => {
                                        settings.store.aiProviders = getAIProviders().map(entry => entry.id === provider.id ? { ...entry, [field]: value } : entry);
                                    }}
                                />}
                            </div>
                        );
                    })}
                </div>
                <ProviderModels provider={provider} closePluginSettings={closePluginSettings} />
                <Button size="small" variant="dangerSecondary" onClick={() => {
                    const confirmKey = `${modalKey}-remove`;
                    openModal(confirmProps => (
                        <Modal
                            {...confirmProps}
                            title="Remove provider?"
                            subtitle={`Remove ${provider.name}, its models, and saved API key?`}
                            actions={[
                                { text: "Cancel", variant: "secondary", onClick: () => closeModal(confirmKey) },
                                {
                                    text: "Remove",
                                    variant: "critical-primary",
                                    onClick() {
                                        const sources = getMixedSources();
                                        const removedIds = new Set([provider.id, ...(provider.models ?? []).map(model => model.id)]);
                                        const remaining = getAIProviders().filter(entry => entry.id !== provider.id);
                                        settings.store.aiProviders = remaining;
                                        resetCredentialWarning(provider.id);
                                        settings.store.mixedSources = sources.filter(id => !removedIds.has(id));
                                        if (settings.store.aiSelected && removedIds.has(settings.store.aiSelected)) settings.store.aiSelected = remaining[0]?.id;
                                        if (settings.store.mixedJudge && removedIds.has(settings.store.mixedJudge)) settings.store.mixedJudge = remaining[0]?.id;
                                        closeModal(confirmKey);
                                        closeModal(modalKey);
                                    }
                                }
                            ]}
                        />
                    ), { modalKey: confirmKey });
                }}>Remove provider</Button>
            </div>
        </Modal>
    );
}

function openProviderEditor(providerId: string, closePluginSettings: () => void, autoFocus = false) {
    const modalKey = `translate-provider-${providerId}-${crypto.randomUUID()}`;
    openModal(rootProps => <ProviderEditor providerId={providerId} modalKey={modalKey} rootProps={rootProps} closePluginSettings={closePluginSettings} autoFocus={autoFocus} />, { modalKey });
}

export function openCredentialEditor(id: string) {
    const credential = BuiltinCredentials.find(entry => entry.key === id);
    if (credential)
        openModal(rootProps => <BuiltinProviderEditor credential={credential} rootProps={rootProps} autoFocus />);
    else if (getAIProviders().some(provider => provider.id === id))
        openProviderEditor(id, () => {}, true);
}

export function AISettings({ closePluginSettings }: { closePluginSettings: () => void; }) {
    const { service, aiSelected, mixedJudge } = settings.use(Subscriptions);
    const providers = getAIProviders();
    const models = getAIModels();
    const options = models.map(model => ({ label: `${model.name} / ${model.model}`, value: model.id }));
    const selected = models.some(model => model.id === aiSelected) ? aiSelected : models[0]?.id;
    const judge = models.some(model => model.id === mixedJudge) ? mixedJudge : selected;

    return (
        <div className="vc-trans-provider-settings">
            {service === "mixed" ? <>
                <Heading>Translation sources</Heading>
                <SearchableSelect
                    multi
                    clearable
                    closeOnSelect={false}
                    options={[
                        { label: "Google Translate", value: "google" },
                        { label: "DeepL Free", value: "deepl" },
                        { label: "DeepL Pro", value: "deepl-pro" },
                        { label: "Kagi", value: "kagi" },
                        ...options
                    ]}
                    value={getMixedSources()}
                    placeholder="Choose at least two sources"
                    onChange={(value: string[]) => settings.store.mixedSources = value}
                />
                <Heading>Judge model</Heading>
                <Select
                    options={options}
                    placeholder="Choose a judge"
                    select={(value: string) => settings.store.mixedJudge = value}
                    isSelected={(value: string) => value === judge}
                    serialize={(value: string) => value}
                    closeOnSelect
                />
            </> : <>
                <Heading>Model</Heading>
                <Select
                    options={options}
                    placeholder="Add a provider below"
                    select={(value: string) => settings.store.aiSelected = value}
                    isSelected={(value: string) => value === selected}
                    serialize={(value: string) => value}
                    closeOnSelect
                />
            </>}
            <details className="vc-trans-provider-list">
                <summary>{service === "mixed" ? `Providers (${providers.length + 3})` : "Manage AI providers"}</summary>
                <div className="vc-trans-provider-list-content">
                    {service === "mixed" ? BuiltinCredentials.map(credential => (
                        <Button variant="secondary" className="vc-trans-provider" key={credential.key} onClick={() => openModal(rootProps => (
                            <BuiltinProviderEditor credential={credential} rootProps={rootProps} />
                        ))}>{credential.name}</Button>
                    )) : null}
                    {providers.map(provider => (
                        <Button variant="secondary" className="vc-trans-provider" key={provider.id} onClick={() => openProviderEditor(provider.id, closePluginSettings)}>
                            {provider.name}<span className="vc-trans-provider-model">{provider.models?.length ? `${provider.models.length + 1} models` : provider.model}</span>
                        </Button>
                    ))}
                    <SearchableSelect
                        options={ProviderOptions}
                        placeholder="Add provider…"
                        value={null}
                        closeOnSelect
                        onChange={(value: keyof typeof AIProviderPresets | "custom") => {
                            const preset = value === "custom" ? AIProviderPresets.openai : AIProviderPresets[value];
                            const provider: ConfiguredAIProvider = {
                                ...preset,
                                id: crypto.randomUUID(),
                                name: ProviderOptions.find(option => option.value === value)?.label ?? "Custom",
                                baseUrl: value === "custom" ? "" : preset.baseUrl,
                                apiKey: "",
                                maxTokens: 128_000
                            };
                            settings.store.aiProviders = [...getAIProviders(), provider];
                            openProviderEditor(provider.id, closePluginSettings);
                        }}
                    />
                </div>
            </details>
        </div>
    );
}
