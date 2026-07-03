/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { useForceUpdater } from "@utils/react";
import { useEffect } from "@webpack/common";
import type { CSSProperties, FocusEventHandler, MouseEventHandler, RefCallback } from "react";

/**
 * Adds plugin-owned semantic data attributes and a limited set of props to
 * stable Discord-owned layout surfaces, so plugins can style/track layout
 * state without patching compiled Discord JSX directly.
 *
 * This is not a generic prop bus and not for plugin-local components. It
 * intentionally does not expose className: injected props land before or
 * after Discord's own props depending on the surface, so class merging
 * cannot be guaranteed. Use data attributes as CSS hooks instead.
 */

export type SurfaceId =
    | "base"
    | "sidebar"
    | "guildBar"
    | "channelList"
    | "membersList"
    | "titleBar"
    | "headerBar"
    | "userArea";

export interface SurfaceProvidedProps {
    ref?: RefCallback<HTMLElement>;
    style?: CSSProperties;
    [dataAttribute: `data-${string}`]: string | undefined;
    onFocusCapture?: FocusEventHandler<HTMLElement>;
    onBlurCapture?: FocusEventHandler<HTMLElement>;
    onMouseDownCapture?: MouseEventHandler<HTMLElement>;
    onMouseOverCapture?: MouseEventHandler<HTMLElement>;
    onMouseOutCapture?: MouseEventHandler<HTMLElement>;
}

export type SurfacePropsProvider = () => SurfaceProvidedProps | undefined;

interface SurfaceInstance {
    forceUpdate(callback?: () => void): void;
}

const propsProviders = new Map<SurfaceId, Set<SurfacePropsProvider>>();
const listeners = new Map<SurfaceId, Set<() => void>>();
const surfaceInstances = new Map<SurfaceId, WeakRef<SurfaceInstance>>();
const failedPropsProviders = new WeakSet<SurfacePropsProvider>();
const logger = new Logger("SurfaceClasses");

function getPropsProviderSet(surfaceId: SurfaceId) {
    let set = propsProviders.get(surfaceId);

    if (set == null) {
        set = new Set();
        propsProviders.set(surfaceId, set);
    }

    return set;
}

function getListenerSet(surfaceId: SurfaceId) {
    let set = listeners.get(surfaceId);

    if (set == null) {
        set = new Set();
        listeners.set(surfaceId, set);
    }

    return set;
}

function chainHandlers<E>(
    first?: (event: E) => void,
    second?: (event: E) => void
) {
    if (!first) return second;
    if (!second) return first;

    return (event: E) => {
        first(event);
        second(event);
    };
}

function chainRefs<T>(first?: RefCallback<T>, second?: RefCallback<T>) {
    if (!first) return second;
    if (!second) return first;

    return (instance: T | null) => {
        first(instance);
        second(instance);
    };
}

function mergeSurfaceProvidedProps(target: SurfaceProvidedProps, source: SurfaceProvidedProps) {
    const ref = chainRefs(target.ref, source.ref);
    if (ref) target.ref = ref;
    const onFocusCapture = chainHandlers(target.onFocusCapture, source.onFocusCapture);
    if (onFocusCapture) target.onFocusCapture = onFocusCapture;
    const onBlurCapture = chainHandlers(target.onBlurCapture, source.onBlurCapture);
    if (onBlurCapture) target.onBlurCapture = onBlurCapture;
    const onMouseDownCapture = chainHandlers(target.onMouseDownCapture, source.onMouseDownCapture);
    if (onMouseDownCapture) target.onMouseDownCapture = onMouseDownCapture;
    const onMouseOverCapture = chainHandlers(target.onMouseOverCapture, source.onMouseOverCapture);
    if (onMouseOverCapture) target.onMouseOverCapture = onMouseOverCapture;
    const onMouseOutCapture = chainHandlers(target.onMouseOutCapture, source.onMouseOutCapture);
    if (onMouseOutCapture) target.onMouseOutCapture = onMouseOutCapture;

    if (source.style) {
        target.style = { ...target.style, ...source.style };
    }

    // Copy only string data-* attributes so providers cannot smuggle in
    // arbitrary props (className in particular is deliberately unsupported).
    for (const [key, value] of Object.entries(source)) {
        if (key.startsWith("data-") && typeof value === "string") {
            target[key as `data-${string}`] = value;
        }
    }

    return target;
}

function getSurfaceProps(surfaceId: SurfaceId) {
    const props: SurfaceProvidedProps = {};

    for (const provider of propsProviders.get(surfaceId) ?? []) {
        let providedProps: SurfaceProvidedProps | undefined;

        try {
            providedProps = provider();
        } catch (error) {
            if (!failedPropsProviders.has(provider)) {
                failedPropsProviders.add(provider);
                logger.error(`Surface props provider failed for ${surfaceId}`, error);
            }
            continue;
        }

        if (providedProps) {
            mergeSurfaceProvidedProps(props, providedProps);
        }
    }

    return props;
}

function notifyOneSurface(surfaceId: SurfaceId) {
    const surfaceInstance = surfaceInstances.get(surfaceId)?.deref();
    if (surfaceInstance) {
        surfaceInstance.forceUpdate();
    } else {
        surfaceInstances.delete(surfaceId);
    }

    for (const listener of listeners.get(surfaceId) ?? []) {
        listener();
    }
}

export function addSurfacePropsProvider(surfaceId: SurfaceId, provider: SurfacePropsProvider) {
    getPropsProviderSet(surfaceId).add(provider);
    notifyOneSurface(surfaceId);

    return () => {
        propsProviders.get(surfaceId)?.delete(provider);
        notifyOneSurface(surfaceId);
    };
}

/** Re-renders a surface after the state backing one of its providers changed. */
export function notifySurfaceClassesChanged(surfaceId: SurfaceId) {
    notifyOneSurface(surfaceId);
}

/** @internal Injected by SurfaceClassesAPI patch (do NOT call directly) */
export function _getSurfaceProps(surfaceId: SurfaceId) {
    return getSurfaceProps(surfaceId);
}

/** @internal Injected by SurfaceClassesAPI patch (do NOT call directly) */
export function _useSurfaceProps(surfaceId: SurfaceId) {
    const forceUpdate = useForceUpdater();

    useEffect(() => {
        const listener = () => forceUpdate();

        getListenerSet(surfaceId).add(listener);
        return () => { listeners.get(surfaceId)?.delete(listener); };
    }, [surfaceId]);

    return getSurfaceProps(surfaceId);
}

/**
 * @internal Injected by SurfaceClassesAPI patch (do NOT call directly).
 * Only used for class component surfaces where hooks cannot be injected into render().
 * Function component surfaces use _useSurfaceProps instead.
 */
export function _trackSurfaceInstance(surfaceId: SurfaceId, instance: SurfaceInstance) {
    if (surfaceInstances.get(surfaceId)?.deref() !== instance) {
        surfaceInstances.set(surfaceId, new WeakRef(instance));
    }
}
