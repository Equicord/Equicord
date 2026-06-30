/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { ChannelStore, useEffect, useLayoutEffect, useMemo, useRef, useState } from "@webpack/common";
import type { KeyboardEvent } from "react";

import type { FormField, FormFieldOption, FormPageSpec, FormSubmitExtras, FormValues, PaletteContext } from "../../api/types";
import { tryMaskedLinkPaste } from "../markdownPaste";
import { MessageMarkdownPreview } from "../MessageMarkdownPreview";
import { PaletteIcon } from "../PaletteIcon";

const cl = classNameFactory("vc-cmdpal-");

export interface FormHandle {
    submit(): void;
}

interface FieldState {
    text: string;
    selected?: FormFieldOption;
}

interface FormPageProps {
    spec: FormPageSpec;
    ctx: PaletteContext;
    formRef: { current: FormHandle | null };
}

function stopModalCapture(e: { stopPropagation(): void }) {
    e.stopPropagation();
}

function getValues(states: Record<string, FieldState>, fields: FormField[]): FormValues {
    const values: FormValues = {};
    for (const field of fields) {
        const state = states[field.key];
        if (!state) continue;
        values[field.key] = state.selected?.value ?? state.text;
    }
    return values;
}

function shouldSubmitOnEnter(e: KeyboardEvent) {
    return e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
}

function PickerField({ field, state, onChange, onSubmit, inputRef }: {
    field: FormField;
    state: FieldState;
    onChange(next: FieldState): void;
    onSubmit(): void;
    inputRef?: { current: HTMLInputElement | null };
}) {
    const [focused, setFocused] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const suggestions = focused && field.suggestions
        ? field.suggestions(state.selected ? "" : state.text)
        : [];

    useEffect(() => {
        itemRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
    }, [highlight, suggestions.length]);

    useEffect(() => {
        if (highlight >= suggestions.length) setHighlight(Math.max(0, suggestions.length - 1));
    }, [highlight, suggestions.length]);

    const choose = (option: FormFieldOption) => {
        onChange({ text: option.label, selected: option });
        setFocused(false);
        inputRef?.current?.blur();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (suggestions.length > 0) {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight(h => Math.min(h + 1, suggestions.length - 1));
                return;
            }
            if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight(h => Math.max(h - 1, 0));
                return;
            }
            if (shouldSubmitOnEnter(event)) {
                event.preventDefault();
                choose(suggestions[Math.min(highlight, suggestions.length - 1)]);
                return;
            }
        }
        if (shouldSubmitOnEnter(event)) {
            event.preventDefault();
            onSubmit();
        }
    };

    return (
        <div className={cl("picker")}>
            <div className={cl("picker-input", { "picker-input-focused": focused })}>
                {state.selected?.icon && (
                    <PaletteIcon icon={state.selected.icon} className={cl("picker-icon")} />
                )}
                <input
                    ref={inputRef}
                    className={cl("picker-input-field")}
                    value={state.text}
                    placeholder={field.placeholder}
                    autoComplete="off"
                    onChange={e => {
                        onChange({ text: e.target.value, selected: undefined });
                        setHighlight(0);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => window.setTimeout(() => setFocused(false), 0)}
                    onMouseDown={stopModalCapture}
                    onKeyDown={onKeyDown}
                />
            </div>
            {suggestions.length > 0 && (
                <div className={cl("picker-list")} onWheel={stopModalCapture}>
                    {suggestions.map((option, i) => (
                        <div
                            key={option.value}
                            ref={el => { itemRefs.current[i] = el; }}
                            className={cl("picker-item", { "picker-item-selected": i === highlight })}
                            onMouseMove={() => setHighlight(i)}
                            onMouseDown={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                choose(option);
                            }}
                        >
                            <PaletteIcon icon={option.icon} className={cl("picker-icon")} />
                            <span>{option.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function FormPage({ spec, ctx, formRef }: FormPageProps) {
    const [states, setStates] = useState<Record<string, FieldState>>(() => {
        const initial: Record<string, FieldState> = {};
        for (const field of spec.fields) {
            const value = field.initial ?? "";
            initial[field.key] = field.type === "select" && field.options
                ? { text: value, selected: field.options.find(o => o.value === value) }
                : { text: value };
        }
        return initial;
    });
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [files, setFiles] = useState<Record<string, File[]>>({});
    const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const statesRef = useRef(states);
    statesRef.current = states;
    const filesRef = useRef(files);
    filesRef.current = files;

    const values = getValues(states, spec.fields);
    const visibleFields = spec.fields.filter(f => !f.visible || f.visible(values));

    const submit = async () => {
        if (submitting) return;

        const currentValues = getValues(statesRef.current, spec.fields);
        const extras: FormSubmitExtras = { files: filesRef.current };
        const validationError = spec.validate?.(currentValues, extras) ?? null;
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        setSubmitting(true);
        try {
            await spec.submit(currentValues, ctx, extras);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    useLayoutEffect(() => {
        formRef.current = { submit: () => void submit() };
        return () => { formRef.current = null; };
    });

    useEffect(() => {
        firstInputRef.current?.focus();
    }, []);

    const setField = (key: string, next: FieldState) => {
        setStates(prev => ({ ...prev, [key]: next }));
        setError(null);
    };

    const setFieldFiles = (key: string, next: File[]) => {
        setFiles(prev => ({ ...prev, [key]: next }));
        setError(null);
    };

    const onFieldEnter = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.stopPropagation();
        if (shouldSubmitOnEnter(e)) {
            e.preventDefault();
            void submit();
        }
    };

    let firstAssigned = false;

    const previewChannelId = useMemo(() => {
        const { recipient } = values;
        if (typeof recipient !== "string" || !recipient) return null;
        return ChannelStore.getDMFromUserId(recipient) ?? null;
    }, [values.recipient]);

    return (
        <div className={cl("form")} onMouseDown={stopModalCapture}>
            {visibleFields.map(field => {
                const state = states[field.key];
                const takeRef = !firstAssigned;
                if (takeRef) firstAssigned = true;

                return (
                    <div key={field.key} className={cl("field")}>
                        <label className={cl("field-label")}>{field.label}</label>
                        {field.type === "text" && (
                            <input
                                ref={takeRef ? (firstInputRef as { current: HTMLInputElement | null }) : undefined}
                                className={cl("field-input")}
                                value={state.text}
                                placeholder={field.placeholder}
                                autoComplete="off"
                                onChange={e => setField(field.key, { text: e.target.value })}
                                onMouseDown={stopModalCapture}
                                onKeyDown={onFieldEnter}
                            />
                        )}
                        {field.type === "textarea" && (
                            <div className={cl("textarea-stack")}>
                                <textarea
                                    ref={takeRef ? (firstInputRef as { current: HTMLTextAreaElement | null }) : undefined}
                                    className={cl("field-textarea")}
                                    value={state.text}
                                    placeholder={field.placeholder}
                                    rows={field.markdown ? 4 : 3}
                                    onChange={e => setField(field.key, { text: e.target.value })}
                                    onMouseDown={stopModalCapture}
                                    onKeyDown={onFieldEnter}
                                    onPaste={field.markdown ? e => {
                                        tryMaskedLinkPaste(e, state.text, next => setField(field.key, { text: next }));
                                    } : undefined}
                                />
                                {field.attachments && (
                                    <div className={cl("attachments")}>
                                        <label className={cl("attachments-label")}>
                                            <input
                                                type="file"
                                                multiple
                                                className={cl("attachments-input")}
                                                onChange={e => {
                                                    const picked = e.target.files ? Array.from(e.target.files) : [];
                                                    if (picked.length) {
                                                        setFieldFiles(field.key, [...(files[field.key] ?? []), ...picked]);
                                                    }
                                                    e.target.value = "";
                                                }}
                                                onMouseDown={stopModalCapture}
                                            />
                                            Add file
                                        </label>
                                        {(files[field.key]?.length ?? 0) > 0 && (
                                            <div className={cl("attachments-list")}>
                                                {files[field.key]?.map((file, index) => (
                                                    <span key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className={cl("attachments-item")}>
                                                        {file.name}
                                                        <button
                                                            type="button"
                                                            className={cl("attachments-remove")}
                                                            onClick={() => setFieldFiles(field.key, files[field.key]?.filter((_, i) => i !== index) ?? [])}
                                                        >
                                                            Remove
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {field.markdown && (
                                    <MessageMarkdownPreview
                                        content={state.text}
                                        channelId={previewChannelId}
                                        files={files[field.key]}
                                    />
                                )}
                            </div>
                        )}
                        {field.type === "select" && field.options && (
                            <div className={cl("chips")}>
                                {field.options.map(option => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={cl("chip", { "chip-selected": state.selected?.value === option.value })}
                                        onClick={() => setField(field.key, { text: option.label, selected: option })}
                                    >
                                        <PaletteIcon icon={option.icon} className={cl("chip-icon")} />
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {field.type === "picker" && (
                            <PickerField
                                field={field}
                                state={state}
                                onChange={next => setField(field.key, next)}
                                onSubmit={() => void submit()}
                                inputRef={takeRef ? (firstInputRef as { current: HTMLInputElement | null }) : undefined}
                            />
                        )}
                    </div>
                );
            })}
            {error && <div className={cl("form-error")}>{error}</div>}
        </div>
    );
}
