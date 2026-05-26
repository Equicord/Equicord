/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";
import { useEffect, useState } from "@webpack/common";
import type { FocusEventHandler, MouseEventHandler } from "react";

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
    className?: string;
    "data-vc-surface-classes"?: string;
    [dataAttribute: `data-${string}`]: string | undefined;
    onFocusCapture?: FocusEventHandler<HTMLElement>;
    onBlurCapture?: FocusEventHandler<HTMLElement>;
    onMouseOverCapture?: MouseEventHandler<HTMLElement>;
    onMouseOutCapture?: MouseEventHandler<HTMLElement>;
}

export type SurfaceClassProvider = () => string | undefined;
export type SurfacePropsProvider = () => SurfaceProvidedProps | undefined;

interface SurfaceInstance {
    forceUpdate(callback?: () => void): void;
}

const providers = new Map<SurfaceId, Set<SurfaceClassProvider>>();
const propsProviders = new Map<SurfaceId, Set<SurfacePropsProvider>>();
const listeners = new Map<SurfaceId, Set<() => void>>();
const surfaceInstances = new Map<SurfaceId, WeakRef<SurfaceInstance>>();

/**
 * Adds semantic class/state props to stable Discord-owned layout surfaces.
 *
 * This is not for plugin-local components or a generic prop bus. It exists so
 * plugins do not patch compiled Discord JSX layout directly.
 *
 * Prop providers are intentionally limited to small hover/focus state handoff
 * props needed to support semantic surface classes.
 */

function getProviderSet(surfaceId: SurfaceId) {
    let set = providers.get(surfaceId);

    if (set == null) {
        set = new Set();
        providers.set(surfaceId, set);
    }

    return set;
}

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

function composeClassNames(...values: Array<string | undefined>) {
    return classes(...values.flatMap(value => value?.split(/\s+/).filter(Boolean) ?? []));
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

export function getSurfaceClasses(surfaceId: SurfaceId) {
    return composeClassNames(...Array.from(providers.get(surfaceId) ?? [], provider => provider()));
}

function mergeSurfaceProvidedProps(target: SurfaceProvidedProps, source: SurfaceProvidedProps) {
    const mergedClass = composeClassNames(target.className, source.className);
    if (mergedClass) target.className = mergedClass;
    const onFocusCapture = chainHandlers(target.onFocusCapture, source.onFocusCapture);
    if (onFocusCapture) target.onFocusCapture = onFocusCapture;
    const onBlurCapture = chainHandlers(target.onBlurCapture, source.onBlurCapture);
    if (onBlurCapture) target.onBlurCapture = onBlurCapture;
    const onMouseOverCapture = chainHandlers(target.onMouseOverCapture, source.onMouseOverCapture);
    if (onMouseOverCapture) target.onMouseOverCapture = onMouseOverCapture;
    const onMouseOutCapture = chainHandlers(target.onMouseOutCapture, source.onMouseOutCapture);
    if (onMouseOutCapture) target.onMouseOutCapture = onMouseOutCapture;

    for (const [key, value] of Object.entries(source)) {
        if (key.startsWith("data-") && typeof value === "string") {
            target[key as `data-${string}`] = value;
        }
    }

    return target;
}

export function getSurfaceProps(surfaceId: SurfaceId) {
    const className = getSurfaceClasses(surfaceId);
    const props: SurfaceProvidedProps = {};

    if (className) {
        props["data-vc-surface-classes"] = className;

        for (const token of className.split(/\s+/)) {
            if (token) {
                props[`data-${token}` as `data-${string}`] = "";
            }
        }
    }

    for (const provider of propsProviders.get(surfaceId) ?? []) {
        const providedProps = provider();

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

export function addSurfaceClassProvider(surfaceId: SurfaceId, provider: SurfaceClassProvider) {
    getProviderSet(surfaceId).add(provider);
    notifyOneSurface(surfaceId);

    return () => {
        providers.get(surfaceId)?.delete(provider);
        notifyOneSurface(surfaceId);
    };
}

export function addSurfacePropsProvider(surfaceId: SurfaceId, provider: SurfacePropsProvider) {
    getPropsProviderSet(surfaceId).add(provider);
    notifyOneSurface(surfaceId);

    return () => {
        propsProviders.get(surfaceId)?.delete(provider);
        notifyOneSurface(surfaceId);
    };
}

export function notifySurfaceClassesChanged(surfaceId: SurfaceId) {
    notifyOneSurface(surfaceId);
}

/** @internal Injected by SurfaceClassesAPI patch (do NOT call directly) */
export function _getSurfaceProps(surfaceId: SurfaceId) {
    return getSurfaceProps(surfaceId);
}

/** @internal Injected by SurfaceClassesAPI patch (do NOT call directly) */
export function _useSurfaceProps(surfaceId: SurfaceId) {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(version => version + 1);

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
    surfaceInstances.set(surfaceId, new WeakRef(instance));
}
