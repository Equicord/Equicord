/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button, TextButton } from "@components/Button";
import { ChevronSmallDownIcon, ChevronSmallUpIcon, CopyIcon, DeleteIcon, WarningIcon } from "@components/Icons";
import { Checkbox, ColorPicker, TextArea, TextInput, useEffect, useState } from "@webpack/common";

import { Counter, IconButton, LabeledInput, Section } from "./components";
import { WebhookAuthor, WebhookEmbed, WebhookField, WebhookFooter } from "./types";
import { cl, EmbedLimits, getUsage, hexToInt, intToHex, intToRgb, newFieldKey, validateEmbed } from "./utils";

interface EmbedEditorProps {
    embed: WebhookEmbed;
    onChange: (embed: WebhookEmbed) => void;
}

function ColorEditor({ color, onChange }: { color: number | undefined; onChange: (color: number | undefined) => void; }) {
    const [hexText, setHexText] = useState(color !== undefined ? intToHex(color) : "");

    useEffect(() => {
        setHexText(color !== undefined ? intToHex(color) : "");
    }, [color]);

    const rgb = color !== undefined ? intToRgb(color) : undefined;

    return (
        <div className={cl("row")}>
            <ColorPicker
                color={color ?? null}
                onChange={value => onChange(value ?? undefined)}
                showEyeDropper={false}
            />
            <TextInput
                value={hexText}
                placeholder="#5865f2"
                aria-label="Hex colour"
                onChange={value => {
                    setHexText(value);
                    const parsed = hexToInt(value);
                    if (parsed !== undefined) onChange(parsed);
                }}
            />
            <TextInput
                value={color !== undefined ? String(color) : ""}
                placeholder="Decimal"
                aria-label="Decimal colour"
                onChange={value => {
                    if (!value) return onChange(undefined);
                    const parsed = Number(value);
                    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 0xffffff) onChange(parsed);
                }}
            />
            {rgb && (
                <BaseText size="sm" color="text-muted" tag="span">
                    rgb({rgb.r}, {rgb.g}, {rgb.b})
                </BaseText>
            )}
            {color !== undefined && <TextButton variant="secondary" onClick={() => onChange(undefined)}>Clear</TextButton>}
        </div>
    );
}

export function EmbedEditor({ embed, onChange }: EmbedEditorProps) {
    const update = (patch: Partial<WebhookEmbed>) => onChange({ ...embed, ...patch });
    const updateAuthor = (patch: Partial<WebhookAuthor>) => update({ author: { name: "", ...embed.author, ...patch } });
    const updateFooter = (patch: Partial<WebhookFooter>) => update({ footer: { text: "", ...embed.footer, ...patch } });

    const updateField = (index: number, patch: Partial<WebhookField>) =>
        update({ fields: embed.fields.map((f, i) => i === index ? { ...f, ...patch } : f) });

    const moveField = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= embed.fields.length) return;
        const fields = [...embed.fields];
        [fields[index], fields[target]] = [fields[target], fields[index]];
        update({ fields });
    };

    const duplicateField = (index: number) => {
        const fields = [...embed.fields];
        fields.splice(index + 1, 0, { ...embed.fields[index], key: newFieldKey() });
        update({ fields });
    };

    const deleteField = (index: number) => update({ fields: embed.fields.filter((_, i) => i !== index) });

    const addField = () => update({ fields: [...embed.fields, { key: newFieldKey(), name: "", value: "", inline: false }] });

    const usage = getUsage(embed);
    const warnings = validateEmbed(embed);

    return (
        <div>
            <div className={cl("usage")}>
                <UsageStat label="Characters" used={usage.total} max={EmbedLimits.total} />
                <UsageStat label="Fields" used={embed.fields.length} max={EmbedLimits.fields} />
                <UsageStat label="Title" used={usage.title} max={EmbedLimits.title} />
                <UsageStat label="Description" used={usage.description} max={EmbedLimits.description} />
                <UsageStat label="Footer" used={usage.footer} max={EmbedLimits.footerText} />
            </div>

            {warnings.length > 0 && (
                <div className={cl("warnings")} role="alert">
                    {warnings.map(warning => (
                        <div className={cl("warning")} key={warning}>
                            <WarningIcon width={16} height={16} />
                            {warning}
                        </div>
                    ))}
                </div>
            )}

            <Section title="Basic">
                <LabeledInput label="Title" value={embed.title ?? ""} maxLength={EmbedLimits.title} onChange={v => update({ title: v || undefined })} />
                <LabeledInput label="URL" value={embed.url ?? ""} placeholder="https://example.com" onChange={v => update({ url: v || undefined })} />
                <div className={cl("input")}>
                    <div className={cl("input-label")}>
                        <span>Description</span>
                        <Counter used={embed.description?.length ?? 0} max={EmbedLimits.description} />
                    </div>
                    <div className={cl("description")}>
                        <TextArea
                            value={embed.description ?? ""}
                            rows={10}
                            aria-label="Description"
                            onChange={v => update({ description: v || undefined })}
                        />
                    </div>
                </div>
            </Section>

            <Section title="Colour">
                <ColorEditor color={embed.color} onChange={color => update({ color })} />
            </Section>

            <Section title="Author">
                <div className={cl("grid")}>
                    <LabeledInput label="Author Name" value={embed.author?.name ?? ""} maxLength={EmbedLimits.authorName} onChange={v => updateAuthor({ name: v })} />
                    <LabeledInput label="Author URL" value={embed.author?.url ?? ""} placeholder="https://example.com" onChange={v => updateAuthor({ url: v || undefined })} />
                    <LabeledInput label="Author Icon URL" value={embed.author?.icon_url ?? ""} placeholder="https://example.com/icon.png" onChange={v => updateAuthor({ icon_url: v || undefined })} />
                </div>
            </Section>

            <Section title="Images">
                <div className={cl("grid")}>
                    <LabeledInput label="Thumbnail URL" value={embed.thumbnail?.url ?? ""} placeholder="https://example.com/thumbnail.png" onChange={v => update({ thumbnail: v ? { url: v } : undefined })} />
                    <LabeledInput label="Main Image URL" value={embed.image?.url ?? ""} placeholder="https://example.com/image.png" onChange={v => update({ image: v ? { url: v } : undefined })} />
                </div>
            </Section>

            <Section title="Footer">
                <div className={cl("grid")}>
                    <LabeledInput label="Footer Text" value={embed.footer?.text ?? ""} maxLength={EmbedLimits.footerText} onChange={v => updateFooter({ text: v })} />
                    <LabeledInput label="Footer Icon URL" value={embed.footer?.icon_url ?? ""} placeholder="https://example.com/icon.png" onChange={v => updateFooter({ icon_url: v || undefined })} />
                </div>
                <div className={cl("row")}>
                    <LabeledInput label="Timestamp" value={embed.timestamp ?? ""} placeholder="2026-07-18T12:00:00.000Z" onChange={v => update({ timestamp: v || undefined })} />
                    <Button size="small" variant="secondary" onClick={() => update({ timestamp: new Date().toISOString() })}>Now</Button>
                    {embed.timestamp && <TextButton variant="secondary" onClick={() => update({ timestamp: undefined })}>Clear</TextButton>}
                </div>
            </Section>

            <Section title={`Fields (${embed.fields.length} / ${EmbedLimits.fields})`}>
                {embed.fields.map((field, i) => (
                    <div className={cl("field")} key={field.key}>
                        <div className={cl("row")}>
                            <TextInput
                                value={field.name}
                                placeholder="Field name"
                                aria-label={`Field ${i + 1} name`}
                                maxLength={null}
                                onChange={v => updateField(i, { name: v })}
                            />
                            <IconButton tooltip="Move field up" icon={ChevronSmallUpIcon} disabled={i === 0} onClick={() => moveField(i, -1)} />
                            <IconButton tooltip="Move field down" icon={ChevronSmallDownIcon} disabled={i === embed.fields.length - 1} onClick={() => moveField(i, 1)} />
                            <IconButton tooltip="Duplicate field" icon={CopyIcon} disabled={embed.fields.length >= EmbedLimits.fields} onClick={() => duplicateField(i)} />
                            <IconButton tooltip="Delete field" icon={DeleteIcon} variant="dangerSecondary" onClick={() => deleteField(i)} />
                        </div>
                        <TextArea
                            value={field.value}
                            placeholder="Field value"
                            rows={2}
                            aria-label={`Field ${i + 1} value`}
                            onChange={v => updateField(i, { value: v })}
                        />
                        <Checkbox value={field.inline} onChange={(_event, checked) => updateField(i, { inline: checked })} size={20}>
                            <BaseText size="sm">Inline</BaseText>
                        </Checkbox>
                    </div>
                ))}
                <Button size="small" variant="secondary" disabled={embed.fields.length >= EmbedLimits.fields} onClick={addField}>
                    Add Field
                </Button>
            </Section>
        </div>
    );
}

function UsageStat({ label, used, max }: { label: string; used: number; max: number; }) {
    return (
        <div className={cl("usage-stat")}>
            <BaseText size="sm" color="text-muted" tag="span">{label}</BaseText>
            <Counter used={used} max={max} />
        </div>
    );
}
