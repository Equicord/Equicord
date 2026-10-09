/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import { proxyLazy } from "@utils/lazy";
import { classes } from "@utils/misc";
import { React, zustandCreate } from "@webpack/common";

import { type BlurOptions, blurOptions } from "./targets";

export interface PrivacyOptions extends BlurOptions {
    revealKey: string;
    blur: number;
    opaque: boolean;
    revealDelay: number;
}

interface PrivacyState {
    active: boolean;
    held: boolean;
    epoch: number;
    options: PrivacyOptions;
    protectionMessage: string;
}

interface PrivacyStore {
    <Value>(selector: (state: PrivacyState) => Value): Value;
    getState(): PrivacyState;
    setState(value: Partial<PrivacyState>): void;
}

export const usePrivacyState = proxyLazy((): PrivacyStore => zustandCreate(() => ({
    active: false,
    held: false,
    epoch: 0,
    protectionMessage: "Ordinary masking. Hold the reveal key and hover to peek.",
    options: { revealKey: "Shift", blur: 16, opaque: false, revealDelay: 150 }
})));

const cl = classNameFactory("vc-private-streaming-");
const heldKeys = new Set<string>();
export interface PrivacyContextValue {
    allowed: boolean;
    masked: boolean;
    invalidate?: () => void;
    media?: boolean;
    imageKind?: "blurAvatars" | "blurServerIcons";
    profile?: boolean;
    activity?: boolean;
    names?: boolean;
    dm?: boolean;
    channelTitle?: boolean;
    serverHeader?: boolean;
    nav?: boolean;
    text?: boolean;
}

export const PrivacyContext = proxyLazy(() => React.createContext<PrivacyContextValue>({ allowed: true, masked: false }));
const WHOLE_ITEM_OPTIONS = Object.keys(blurOptions).filter(key => key !== "hideWindowTitle") as (keyof BlurOptions)[];

function resetReveal(release = false) {
    if (release) heldKeys.clear();
    const { epoch } = usePrivacyState.getState();
    usePrivacyState.setState({ epoch: epoch + 1, held: heldKeys.size > 0 });
}

function onlyRevealModifier(event: KeyboardEvent | React.PointerEvent) {
    const { revealKey } = usePrivacyState.getState().options;
    if (event.metaKey) return false;
    if (revealKey === "Shift") return event.shiftKey && !event.ctrlKey && !event.altKey;
    if (revealKey.startsWith("Control")) return event.ctrlKey && !event.shiftKey && !event.altKey;
    return event.altKey && !event.shiftKey && !event.ctrlKey;
}

function keyDown(event: KeyboardEvent) {
    const { active, options } = usePrivacyState.getState();
    if (!active) return;
    const matches = options.revealKey === "Shift"
        ? event.code === "ShiftLeft" || event.code === "ShiftRight"
        : event.code === options.revealKey;
    if (!matches || !onlyRevealModifier(event) || event.isComposing || event.getModifierState("AltGraph")) {
        resetReveal(true);
        return;
    }
    if (event.repeat) return;
    heldKeys.add(event.code);
    if (event.target instanceof HTMLElement && (event.target.isContentEditable
        || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        resetReveal();
        return;
    }
    usePrivacyState.setState({ held: true });
}

function keyUp(event: KeyboardEvent) {
    heldKeys.delete(event.code);
    if (!heldKeys.size) usePrivacyState.setState({ held: false });
}

function loseFocus() {
    resetReveal(true);
}

function invalidateReveal() {
    resetReveal();
}

function focusIn(event: FocusEvent) {
    if (event.target instanceof HTMLElement && (event.target.isContentEditable
        || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) loseFocus();
}

function pointerOut(event: PointerEvent) {
    if (!event.relatedTarget) loseFocus();
}

export function startPrivacy() {
    window.addEventListener("keydown", keyDown, true);
    window.addEventListener("keyup", keyUp, true);
    window.addEventListener("blur", loseFocus, true);
    window.addEventListener("pagehide", loseFocus, true);
    window.addEventListener("resize", invalidateReveal, true);
    window.addEventListener("scroll", invalidateReveal, true);
    window.addEventListener("wheel", invalidateReveal, { capture: true, passive: true });
    window.addEventListener("compositionstart", loseFocus, true);
    window.addEventListener("dragstart", loseFocus, true);
    window.addEventListener("contextmenu", loseFocus, true);
    window.addEventListener("focusin", focusIn, true);
    window.addEventListener("pointerout", pointerOut, true);
    window.addEventListener("pointercancel", loseFocus, true);
    document.addEventListener("visibilitychange", loseFocus, true);
}

export function configurePrivacy(options: PrivacyOptions) {
    resetReveal(true);
    usePrivacyState.setState({ options });
}

export function setPrivacyActive(active: boolean) {
    if (active === usePrivacyState.getState().active) return;
    resetReveal(true);
    usePrivacyState.setState({ active });
}

export function stopPrivacy() {
    setPrivacyActive(false);
    resetReveal(true);
    window.removeEventListener("keydown", keyDown, true);
    window.removeEventListener("keyup", keyUp, true);
    window.removeEventListener("blur", loseFocus, true);
    window.removeEventListener("pagehide", loseFocus, true);
    window.removeEventListener("resize", invalidateReveal, true);
    window.removeEventListener("scroll", invalidateReveal, true);
    window.removeEventListener("wheel", invalidateReveal, true);
    window.removeEventListener("compositionstart", loseFocus, true);
    window.removeEventListener("dragstart", loseFocus, true);
    window.removeEventListener("contextmenu", loseFocus, true);
    window.removeEventListener("focusin", focusIn, true);
    window.removeEventListener("pointerout", pointerOut, true);
    window.removeEventListener("pointercancel", loseFocus, true);
    document.removeEventListener("visibilitychange", loseFocus, true);
}

export function usePrivateTitleProps(title: string, skipDefault?: boolean): [string, boolean | undefined] {
    const hidden = usePrivacyState(state => state.active && state.options.hideWindowTitle !== false);
    const previous = React.useRef(hidden);
    React.useLayoutEffect(() => { previous.current = hidden; }, [hidden]);
    return [hidden ? "Discord | Private Streaming" : title, hidden || previous.current ? false : skipDefault];
}

interface RegionProps {
    children?: React.ReactNode;
    area?: keyof BlurOptions;
    ownAccount?: boolean;
}

export function PrivacyRegion({ children, area, ownAccount }: RegionProps) {
    const options = usePrivacyState(state => state.options);
    const parent = React.useContext(PrivacyContext);
    const allowed = parent.allowed && (!area || options[area] !== false) && (!ownAccount || options.blurOwnAccount === true);
    return <PrivacyContext.Provider value={{ ...parent, allowed }}>{children}</PrivacyContext.Provider>;
}

interface MaskProps extends React.HTMLAttributes<HTMLElement> {
    as?: keyof React.JSX.IntrinsicElements;
    kind?: keyof BlurOptions | "wholeItem";
    identity?: unknown;
}

function Mask({ as: Tag = "span", kind, children, identity = children, className, style, title, onPointerEnter, onPointerMove, onPointerLeave, onPointerDown, onFocus, ...props }: MaskProps) {
    const active = usePrivacyState(state => state.active);
    const options = usePrivacyState(state => state.options);
    const parent = React.useContext(PrivacyContext);
    const [hovered, setHovered] = React.useState(false);
    const [hoverIdentity, setHoverIdentity] = React.useState<{ epoch: number; identity: unknown; } | null>(null);
    const [revealed, setRevealed] = React.useState<{ epoch: number; identity: unknown; } | null>(null);
    const previous = React.useRef(identity);
    const selected = kind === "wholeItem" ? WHOLE_ITEM_OPTIONS.every(key => options[key] !== false) : kind !== undefined && options[kind] !== false;
    const masked = active && selected && parent.allowed && !parent.masked;
    const held = usePrivacyState(state => masked && state.held);
    const epoch = usePrivacyState(state => masked ? state.epoch : 0);
    const eligible = hoverIdentity?.epoch === epoch && hoverIdentity.identity === identity;
    const show = masked && held && eligible && hovered && revealed?.epoch === epoch && revealed.identity === identity;
    const invalidate = React.useCallback(() => { setHoverIdentity(null); setRevealed(null); }, []);
    const context = React.useMemo(() => ({ ...parent, masked: parent.masked || masked, invalidate: masked ? invalidate : parent.invalidate }), [parent, masked, invalidate]);

    React.useLayoutEffect(() => {
        if (previous.current !== identity) parent.invalidate?.();
        previous.current = identity;
    }, [identity, parent.invalidate]);

    React.useEffect(() => {
        if (!masked || !held || !eligible || !hovered) {
            setRevealed(null);
            return;
        }
        const timer = setTimeout(() => setRevealed({ epoch, identity }), Math.max(0, Math.min(1000, options.revealDelay)));
        return () => clearTimeout(timer);
    }, [masked, held, eligible, hovered, epoch, identity, options.revealDelay]);

    function move(event: React.PointerEvent<HTMLElement>) {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") {
            setHovered(false);
            setHoverIdentity(null);
            return;
        }
        setHovered(true);
        if (event.buttons || (held && !onlyRevealModifier(event)) || (event.target instanceof HTMLElement && (event.target.isContentEditable
            || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement))) {
            setHoverIdentity(null);
            setRevealed(null);
            return;
        }
        setHoverIdentity(previous => previous?.epoch === epoch && previous.identity === identity ? previous : { epoch, identity });
    }

    return (
        <PrivacyContext.Provider value={context}>
            {React.createElement(Tag, {
                ...props,
                "data-vc-private-streaming": true,
                className: classes(className, cl({ mask: masked, opaque: masked && options.opaque, revealed: show })),
                style: { ...style, "--vc-private-streaming-blur": `${Number.isFinite(options.blur) ? Math.max(12, Math.min(32, options.blur)) : 16}px` },
                title: active && options.blurTooltips !== false ? undefined : title,
                onPointerEnter: (event: React.PointerEvent<HTMLElement>) => { onPointerEnter?.(event); move(event); },
                onPointerMove: (event: React.PointerEvent<HTMLElement>) => { onPointerMove?.(event); move(event); },
                onPointerLeave: (event: React.PointerEvent<HTMLElement>) => { onPointerLeave?.(event); setHovered(false); setHoverIdentity(null); setRevealed(null); },
                onPointerDown: (event: React.PointerEvent<HTMLElement>) => { onPointerDown?.(event); setHoverIdentity(null); setRevealed(null); },
                onFocus: (event: React.FocusEvent<HTMLElement>) => { onFocus?.(event); resetReveal(true); }
            }, children)}
        </PrivacyContext.Provider>
    );
}

export const PrivacyMask = ErrorBoundary.wrap(Mask, { noop: true });
export const PrivateRegion = ErrorBoundary.wrap(PrivacyRegion, { noop: true });
