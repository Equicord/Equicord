/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { copyWithToast } from "@utils/discord";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, showToast, TextArea, TextInput, Toasts, useEffect, useState } from "@webpack/common";

import { Section } from "./components";
import { settings } from "./settings";
import { WebhookEmbed } from "./types";
import { cl, deleteTemplate, downloadTextFile, generateJavaScript, generatePython, getTemplates, parseEmbedJson, saveTemplate, webhookJson, withFreshFieldKeys } from "./utils";

interface EmbedJsonTabProps {
    embed: WebhookEmbed;
    raw: unknown;
    onChange: (embed: WebhookEmbed) => void;
}

const SETTINGS_KEYS: "prettyPrintJson"[] = ["prettyPrintJson"];

export function EmbedJsonTab({ embed, raw, onChange }: EmbedJsonTabProps) {
    const { prettyPrintJson } = settings.use(SETTINGS_KEYS);
    const [text, setText] = useState(() => webhookJson(embed, prettyPrintJson));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setText(webhookJson(embed, prettyPrintJson));
        setError(null);
    }, [embed, prettyPrintJson]);

    const validate = () => {
        const result = parseEmbedJson(text);
        if ("error" in result) {
            setError(result.error);
            return;
        }
        setError(null);
        onChange(result.embed);
        showToast("JSON is valid and has been applied", Toasts.Type.SUCCESS);
    };

    const reformat = (pretty: boolean) => {
        const result = parseEmbedJson(text);
        if ("error" in result) {
            setError(result.error);
            return;
        }
        setError(null);
        setText(webhookJson(result.embed, pretty));
    };

    return (
        <div>
            <div className={cl("row", "wrap")}>
                <Button size="small" onClick={validate}>Validate JSON</Button>
                <Button size="small" variant="secondary" onClick={() => reformat(true)}>Pretty Print</Button>
                <Button size="small" variant="secondary" onClick={() => reformat(false)}>Minify</Button>
                <Button size="small" variant="secondary" onClick={() => copyWithToast(text, "Webhook JSON copied to clipboard")}>Copy JSON</Button>
                <Button size="small" variant="secondary" onClick={() => downloadTextFile("embed.json", text)}>Download JSON</Button>
            </div>
            <div className={cl("json")}>
                <TextArea
                    value={text}
                    rows={14}
                    aria-label="Webhook JSON"
                    onChange={setText}
                />
            </div>
            {error && <Paragraph className={cl("error")}>{error}</Paragraph>}

            <Section title="Export">
                <div className={cl("row", "wrap")}>
                    <Button size="small" variant="secondary" onClick={() => copyWithToast(JSON.stringify(raw, null, 2), "Raw embed copied to clipboard")}>Copy Raw Embed</Button>
                    <Button size="small" variant="secondary" onClick={() => copyWithToast(generateJavaScript(embed, false), "discord.js example copied to clipboard")}>Copy JavaScript</Button>
                    <Button size="small" variant="secondary" onClick={() => copyWithToast(generateJavaScript(embed, true), "TypeScript example copied to clipboard")}>Copy TypeScript</Button>
                    <Button size="small" variant="secondary" onClick={() => copyWithToast(generatePython(embed), "discord.py example copied to clipboard")}>Copy Python</Button>
                    <Button size="small" variant="secondary" onClick={() => openModal(props => <SaveTemplateModal {...props} embed={embed} />)}>Save Template</Button>
                    <Button size="small" variant="secondary" onClick={() => openModal(props => <LoadTemplateModal {...props} onLoad={onChange} />)}>Load Template</Button>
                </div>
            </Section>
        </div>
    );
}

function SaveTemplateModal({ embed, ...props }: RenderModalProps & { embed: WebhookEmbed; }) {
    const [name, setName] = useState("");

    return (
        <Modal
            {...props}
            size="sm"
            title="Save Template"
            actions={[{
                text: "Save",
                variant: "primary",
                disabled: !name.trim(),
                onClick: async () => {
                    await saveTemplate(name.trim(), embed);
                    showToast(`Saved template "${name.trim()}"`, Toasts.Type.SUCCESS);
                    props.onClose();
                }
            }]}
        >
            <TextInput
                value={name}
                placeholder="Template name"
                aria-label="Template name"
                autoFocus
                onChange={setName}
            />
        </Modal>
    );
}

function LoadTemplateModal({ onLoad, ...props }: RenderModalProps & { onLoad: (embed: WebhookEmbed) => void; }) {
    const [templates, setTemplates] = useState<Record<string, WebhookEmbed> | null>(null);

    useEffect(() => {
        getTemplates().then(setTemplates);
    }, []);

    return (
        <Modal {...props} size="sm" title="Load Template">
            {templates && !Object.keys(templates).length && <Paragraph>No templates saved yet.</Paragraph>}
            {templates && Object.keys(templates).sort().map(name => (
                <div className={cl("template")} key={name}>
                    <BaseText size="md">{name}</BaseText>
                    <div className={cl("row")}>
                        <Button
                            size="small"
                            onClick={() => {
                                onLoad(withFreshFieldKeys(templates[name]));
                                showToast(`Loaded template "${name}"`, Toasts.Type.SUCCESS);
                                props.onClose();
                            }}
                        >
                            Load
                        </Button>
                        <Button
                            size="small"
                            variant="dangerSecondary"
                            onClick={async () => {
                                await deleteTemplate(name);
                                setTemplates(await getTemplates());
                            }}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            ))}
        </Modal>
    );
}
