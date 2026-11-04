/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { lodash, showToast, TextInput, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { resetCredentialWarning } from "./credentials";

interface ApiKeyInputProps {
    id: string;
    value: string;
    label?: string;
    autoFocus?: boolean;
    onChange(value: string): void;
    check(signal: AbortSignal): Promise<unknown>;
    disabled: boolean;
}

export function ApiKeyInput({ id, value, label = "API key", autoFocus, onChange, check, disabled }: ApiKeyInputProps) {
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState("");
    const controller = useRef<AbortController | null>(null);
    const checkRef = useRef(check);
    checkRef.current = check;
    const disabledRef = useRef(disabled);
    disabledRef.current = disabled;
    const scheduleCheck = useMemo(() => lodash.debounce(() => validate(false), 600), []);
    useEffect(() => () => {
        scheduleCheck.cancel();
        controller.current?.abort();
    }, [scheduleCheck]);

    async function validate(manual: boolean) {
        scheduleCheck.cancel();
        if (disabledRef.current) return;
        controller.current?.abort();
        const request = new AbortController();
        controller.current = request;
        setError("");
        setChecking(true);
        try {
            await checkRef.current(AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]));
            if (manual && !request.signal.aborted)
                showToast({ text: "API key works.", variant: "success" });
        } catch (error) {
            if (!request.signal.aborted)
                setError(error instanceof Error ? error.message : typeof error === "string" ? error : "Could not check the API key. Try again.");
        } finally {
            if (!request.signal.aborted) setChecking(false);
        }
    }

    return (
        <div className="vc-trans-provider-content">
            <label htmlFor={`${id}-api-key`}>{label}</label>
            <TextInput
                id={`${id}-api-key`}
                type="password"
                value={value}
                autoFocus={autoFocus}
                error={error}
                aria-invalid={!!error}
                onChange={(newValue: string) => {
                    scheduleCheck.cancel();
                    controller.current?.abort();
                    setChecking(false);
                    setError("");
                    resetCredentialWarning(id);
                    onChange(newValue);
                    if (newValue.trim()) scheduleCheck();
                }}
            />
            <Button size="small" variant="secondary" disabled={disabled || checking} onClick={() => validate(true)}>
                {checking ? "Checking…" : "Check API key"}
            </Button>
        </div>
    );
}
