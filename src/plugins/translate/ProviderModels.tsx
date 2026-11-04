/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { OptionComponentMap } from "@components/settings/tabs/plugins/components";

import { ConfiguredAIProvider } from "./ai";
import { getAIProviders, getMixedSources, settings } from "./settings";

const ModelFields = [["aiModel", "model"], ["aiMaxTokens", "maxTokens"]] as const;

interface ProviderModelsProps {
    provider: ConfiguredAIProvider;
    closePluginSettings(): void;
}

export function ProviderModels({ provider, closePluginSettings }: ProviderModelsProps) {
    return (
        <div className="vc-trans-provider-content">
            <Heading>Models</Heading>
            {[provider, ...(provider.models ?? [])].map(model => (
                <div key={model.id} className="vc-trans-ai-settings">
                    {ModelFields.map(([key, field]) => {
                        const setting = settings.def[key];
                        const Component = OptionComponentMap[setting.type];
                        const id = `${model.id}-${field}`;
                        return (
                            <div key={field}>
                                <Component
                                    id={id}
                                    setting={{ ...setting, description: "" }}
                                    pluginSettings={{ enabled: isPluginEnabled("Translate"), [id]: model[field] }}
                                    definedSettings={settings}
                                    closePluginSettings={closePluginSettings}
                                    onChange={(value: string | number) => {
                                        settings.store.aiProviders = getAIProviders().map(entry => {
                                            if (entry.id !== provider.id) return entry;
                                            if (model.id === provider.id) return { ...entry, [field]: value };
                                            return { ...entry, models: entry.models?.map(existing => existing.id === model.id ? { ...existing, [field]: value } : existing) };
                                        });
                                    }}
                                />
                            </div>
                        );
                    })}
                    {model.id !== provider.id ? <Button size="small" variant="dangerSecondary" onClick={() => {
                        const sources = getMixedSources();
                        settings.store.aiProviders = getAIProviders().map(entry => entry.id === provider.id
                            ? { ...entry, models: entry.models?.filter(existing => existing.id !== model.id) }
                            : entry);
                        settings.store.mixedSources = sources.filter(id => id !== model.id);
                        if (settings.store.aiSelected === model.id) settings.store.aiSelected = provider.id;
                        if (settings.store.mixedJudge === model.id) settings.store.mixedJudge = provider.id;
                    }}>Remove model</Button> : null}
                </div>
            ))}
            <Button size="small" variant="secondary" onClick={() => {
                settings.store.aiProviders = getAIProviders().map(entry => entry.id === provider.id
                    ? { ...entry, models: [...(entry.models ?? []), { id: crypto.randomUUID(), model: "", maxTokens: entry.maxTokens }] }
                    : entry);
            }}>Add model</Button>
        </div>
    );
}
