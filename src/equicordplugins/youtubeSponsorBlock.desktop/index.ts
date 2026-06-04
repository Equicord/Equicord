/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { React, useEffect, useRef, useState } from "@webpack/common";

type Category =
    | "sponsor"
    | "selfpromo"
    | "interaction"
    | "intro"
    | "outro"
    | "preview"
    | "filler"
    | "music_offtopic";

type Segment = {
    segment: [number, number];
    category: Category;
};

type CategoryAction = "skip" | "progress" | "manual" | "none";
type CategorySetting =
    | "sponsorAction"
    | "selfPromoAction"
    | "interactionAction"
    | "introAction"
    | "outroAction"
    | "previewAction"
    | "fillerAction"
    | "musicOfftopicAction";

type IframeProps = {
    src?: unknown;
    onLoad?: (event: Event) => void;
    onMouseEnter?: (event: React.MouseEvent<HTMLIFrameElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<HTMLIFrameElement>) => void;
    onMouseMove?: (event: React.MouseEvent<HTMLIFrameElement>) => void;
    onPointerMove?: (event: React.PointerEvent<HTMLIFrameElement>) => void;
    [key: string]: unknown;
};

type Controller = {
    iframe: HTMLIFrameElement;
    videoId: string;
    segments: Segment[];
    interval: number;
    skipTimeout: number | undefined;
    currentTime: number;
    duration: number;
    lastTimeUpdate: number;
    playing: boolean;
    lastSkipAt: number;
    lastSkippedSegment: Segment | null;
    skippedSegments: Set<string>;
    listeners: Set<() => void>;
};

const categorySettings = [
    ["sponsor", "sponsorAction"],
    ["selfpromo", "selfPromoAction"],
    ["interaction", "interactionAction"],
    ["intro", "introAction"],
    ["outro", "outroAction"],
    ["preview", "previewAction"],
    ["filler", "fillerAction"],
    ["music_offtopic", "musicOfftopicAction"]
] as const satisfies readonly (readonly [Category, CategorySetting])[];

const controllers = new Map<HTMLIFrameElement, Controller>();
const cl = classNameFactory("vc-youtube-sponsorblock-");
const skipBuffer = 0.003;
const categoryLabels: Record<Category, string> = {
    sponsor: "Sponsor",
    selfpromo: "Self-promotion",
    interaction: "Interaction reminder",
    intro: "Intro",
    outro: "Outro",
    preview: "Preview",
    filler: "Filler",
    music_offtopic: "Non-music"
};
const defaultActionOptions = [
    { label: "Skip automatically", value: "skip", default: true },
    { label: "Show in progress bar", value: "progress" },
    { label: "Manual skip button", value: "manual" },
    { label: "None", value: "none" }
] as const;
const disabledActionOptions = [
    { label: "Skip automatically", value: "skip" },
    { label: "Show in progress bar", value: "progress" },
    { label: "Manual skip button", value: "manual" },
    { label: "None", value: "none", default: true }
] as const;

const settings = definePluginSettings({
    sponsorAction: {
        type: OptionType.SELECT,
        description: "Sponsor segments.",
        options: defaultActionOptions
    },
    selfPromoAction: {
        type: OptionType.SELECT,
        description: "Unpaid/self promotion segments.",
        options: defaultActionOptions
    },
    interactionAction: {
        type: OptionType.SELECT,
        description: "Interaction reminder segments.",
        options: defaultActionOptions
    },
    introAction: {
        type: OptionType.SELECT,
        description: "Intro segments.",
        options: disabledActionOptions
    },
    outroAction: {
        type: OptionType.SELECT,
        description: "Endcard and credits segments.",
        options: disabledActionOptions
    },
    previewAction: {
        type: OptionType.SELECT,
        description: "Preview and recap segments.",
        options: disabledActionOptions
    },
    fillerAction: {
        type: OptionType.SELECT,
        description: "Filler tangent and joke segments.",
        options: disabledActionOptions
    },
    musicOfftopicAction: {
        type: OptionType.SELECT,
        description: "Non-music sections in music videos.",
        options: disabledActionOptions
    }
});

function getCategoryAction(category: Category): CategoryAction {
    const setting = categorySettings.find(([candidate]) => candidate === category)?.[1];
    return setting ? settings.store[setting] as CategoryAction : "none";
}

function getEnabledCategories() {
    return categorySettings
        .filter(([, setting]) => settings.store[setting] !== "none")
        .map(([category]) => category);
}

function getYoutubeVideoId(src: string) {
    try {
        const url = new URL(src);
        if (!/(^|\.)youtube(?:-nocookie)?\.com$/.test(url.hostname)) return null;

        return url.searchParams.get("v") ?? url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
    } catch {
        return null;
    }
}

function withYoutubeApi(src: string) {
    const url = new URL(src);
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("origin", location.origin);
    return url.toString();
}

function sendCommand(iframe: HTMLIFrameElement, func: string, args: unknown[] = []) {
    iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), new URL(iframe.src).origin);
}

function startListening(iframe: HTMLIFrameElement) {
    iframe.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "vc-youtube-sponsorblock" }), new URL(iframe.src).origin);
}

function emit(controller: Controller) {
    for (const listener of controller.listeners) listener();
}

function getVirtualTime(controller: Controller) {
    if (!controller.playing) return controller.currentTime;

    return controller.currentTime + (performance.now() - controller.lastTimeUpdate) / 1000;
}

function getSegmentKey({ category, segment }: Segment) {
    return `${category}:${segment[0]}-${segment[1]}`;
}

function getActiveSegment({ currentTime, segments }: Controller, action?: CategoryAction) {
    return segments.find(({ segment, category }) =>
        (!action || getCategoryAction(category) === action) &&
        currentTime >= segment[0] &&
        currentTime < segment[1] - 0.1
    );
}

function getNextSkipSegment(controller: Controller) {
    const currentTime = getVirtualTime(controller);

    return controller.segments
        .filter(segment => getCategoryAction(segment.category) === "skip" && !controller.skippedSegments.has(getSegmentKey(segment)))
        .find(({ segment }) => currentTime >= segment[0] - 1 && currentTime < segment[1] - 0.1);
}

function skipSegment(controller: Controller, segment: Segment) {
    if (performance.now() - controller.lastSkipAt < 500) return;

    controller.skippedSegments.add(getSegmentKey(segment));
    controller.lastSkipAt = performance.now();
    controller.lastSkippedSegment = segment;
    controller.currentTime = segment.segment[1] + 0.01;
    controller.lastTimeUpdate = performance.now();
    sendCommand(controller.iframe, "seekTo", [segment.segment[1] + 0.01, true]);
    scheduleNextSkip(controller);
    emit(controller);
}

function scheduleNextSkip(controller: Controller) {
    if (controller.skipTimeout !== undefined) {
        window.clearTimeout(controller.skipTimeout);
        controller.skipTimeout = undefined;
    }

    const nextSegment = getNextSkipSegment(controller);
    if (!nextSegment) return;

    const currentTime = getVirtualTime(controller);
    if (currentTime >= nextSegment.segment[0] - skipBuffer) {
        skipSegment(controller, nextSegment);
        return;
    }

    controller.skipTimeout = window.setTimeout(
        () => skipSegment(controller, nextSegment),
        Math.max(0, (nextSegment.segment[0] - currentTime - skipBuffer) * 1000)
    );
}

function tick(controller: Controller) {
    if (!controller.iframe.isConnected) {
        unregisterIframe(controller.iframe);
        return;
    }

    startListening(controller.iframe);
    sendCommand(controller.iframe, "getCurrentTime");
    sendCommand(controller.iframe, "getDuration");
    scheduleNextSkip(controller);
}

function onMessage(event: MessageEvent) {
    const controller = [...controllers.values()].find(({ iframe }) => iframe.contentWindow === event.source);
    if (!controller) return;

    let data: { event?: string; info?: { currentTime?: number; duration?: number; playerState?: number; } | number; };
    try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    } catch {
        return;
    }

    if (data?.event === "onStateChange" && typeof data.info === "number") {
        controller.playing = data.info === 1;
        scheduleNextSkip(controller);
        emit(controller);
        return;
    }

    if (data?.event !== "infoDelivery" || typeof data.info !== "object") return;

    if (typeof data.info.currentTime === "number") {
        const previousTime = controller.currentTime;
        controller.currentTime = data.info.currentTime;
        controller.lastTimeUpdate = performance.now();
        for (const segment of controller.segments) {
            if (previousTime - controller.currentTime > 2 && controller.currentTime < segment.segment[0] - 1) {
                controller.skippedSegments.delete(getSegmentKey(segment));
            }
        }
    }
    if (typeof data.info.duration === "number") controller.duration = data.info.duration;
    if (typeof data.info.playerState === "number") controller.playing = data.info.playerState === 1;
    scheduleNextSkip(controller);
    emit(controller);
}

async function loadSegments(videoId: string) {
    const categories = getEnabledCategories();
    if (!categories.length) return [];

    const url = new URL("https://sponsor.ajay.app/api/skipSegments");
    url.searchParams.set("videoID", videoId);
    url.searchParams.set("categories", JSON.stringify(categories));

    const response = await fetch(url.toString());
    if (!response.ok) return [];

    const segments = await response.json() as Segment[];
    return segments.filter(({ segment }) => Array.isArray(segment) && segment.length === 2);
}

function unregisterIframe(iframe: HTMLIFrameElement) {
    const controller = controllers.get(iframe);
    if (!controller) return;

    window.clearInterval(controller.interval);
    if (controller.skipTimeout !== undefined) window.clearTimeout(controller.skipTimeout);
    controllers.delete(iframe);
}

async function registerIframe(iframe: HTMLIFrameElement, videoId: string) {
    unregisterIframe(iframe);

    const controller: Controller = {
        iframe,
        videoId,
        segments: [],
        interval: window.setInterval(() => tick(controller), 250),
        skipTimeout: undefined,
        currentTime: 0,
        duration: 0,
        lastTimeUpdate: performance.now(),
        playing: true,
        lastSkipAt: 0,
        lastSkippedSegment: null,
        skippedSegments: new Set(),
        listeners: new Set()
    };

    controllers.set(iframe, controller);
    startListening(iframe);
    sendCommand(iframe, "addEventListener", ["onStateChange"]);
    controller.segments = await loadSegments(videoId);
    tick(controller);
    emit(controller);
}

function useController(iframe: HTMLIFrameElement | null) {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        if (!iframe) return;

        const controller = controllers.get(iframe);
        if (!controller) return;

        const listener = () => forceUpdate(value => value + 1);
        controller.listeners.add(listener);
        listener();

        return () => {
            controller.listeners.delete(listener);
        };
    }, [iframe]);

    return iframe ? controllers.get(iframe) : undefined;
}

function SponsorBlockOverlay({ iframe, visible, fakeFullscreen, setFakeFullscreen }: {
    iframe: HTMLIFrameElement | null;
    visible: boolean;
    fakeFullscreen: boolean;
    setFakeFullscreen: (fakeFullscreen: boolean) => void;
}) {
    const controller = useController(iframe);
    if (!controller) return null;

    const manualSegment = getActiveSegment(controller, "manual");
    const unskipSegment = controller.lastSkippedSegment && getVirtualTime(controller) < controller.lastSkippedSegment.segment[1] + 5
        ? controller.lastSkippedSegment
        : null;
    const visibleSegments = controller.segments.filter(({ category }) => getCategoryAction(category) !== "none" && controller.duration > 0);

    return (
        React.createElement("div", { className: cl("overlay", { "overlay-hidden": !visible }) },
            controller.duration > 0 && visibleSegments.length > 0
                ? React.createElement("div", { className: cl("bar") },
                    visibleSegments.map(({ segment, category }) =>
                        React.createElement("div", {
                            className: cl("segment", category.replace("_", "-")),
                            key: `${category}-${segment[0]}-${segment[1]}`,
                            style: {
                                left: `${segment[0] / controller.duration * 100}%`,
                                width: `${(segment[1] - segment[0]) / controller.duration * 100}%`
                            }
                        })
                    )
                )
                : null,
            manualSegment
                ? React.createElement("button", {
                    className: cl("skip"),
                    onClick: () => skipSegment(controller, manualSegment)
                }, `Skip ${categoryLabels[manualSegment.category]}`)
                : null,
            unskipSegment
                ? React.createElement("button", {
                    className: cl("unskip"),
                    onClick: () => {
                        controller.lastSkippedSegment = null;
                        controller.currentTime = unskipSegment.segment[0];
                        controller.lastTimeUpdate = performance.now();
                        sendCommand(controller.iframe, "seekTo", [unskipSegment.segment[0], true]);
                        scheduleNextSkip(controller);
                        emit(controller);
                    }
                }, `Unskip ${categoryLabels[unskipSegment.category]}`)
                : null,
            React.createElement("button", {
                className: cl("fullscreen"),
                onClick: () => setFakeFullscreen(!fakeFullscreen),
                title: fakeFullscreen ? "Exit fullscreen" : "Fullscreen",
                "aria-label": fakeFullscreen ? "Exit fullscreen" : "Fullscreen"
            },
                React.createElement("svg", {
                    xmlns: "http://www.w3.org/2000/svg",
                    height: "24",
                    viewBox: "0 0 24 24",
                    width: "24",
                    focusable: "false",
                    "aria-hidden": "true"
                },
                    React.createElement("path", {
                        d: fakeFullscreen
                            ? "M5 5h4c.265 0 .52.105.707.293.188.187.293.442.293.707 0 .265-.105.52-.293.707C9.52 6.895 9.265 7 9 7H7v2c0 .265-.105.52-.293.707C6.52 9.895 6.265 10 6 10c-.265 0-.52-.105-.707-.293C5.105 9.52 5 9.265 5 9V5Zm14 14h-4c-.265 0-.52-.105-.707-.293C14.105 18.52 14 18.265 14 18c0-.265.105-.52.293-.707C14.48 17.105 14.735 17 15 17h2v-2c0-.265.105-.52.293-.707.187-.188.442-.293.707-.293.265 0 .52.105.707.293.188.187.293.442.293.707v4Z"
                            : "M10 3H3v7c0 .265.105.52.293.707.187.188.442.293.707.293.265 0 .52-.105.707-.293C4.895 10.52 5 10.265 5 10V6.414l4.293 4.293.076.068c.192.155.435.233.68.22.247-.014.48-.118.654-.292.174-.174.278-.407.291-.653.014-.246-.064-.489-.219-.681l-.068-.076L6.414 5H10c.265 0 .52-.105.707-.293C10.895 4.52 11 4.265 11 4c0-.265-.105-.52-.293-.707C10.52 3.105 10.265 3 10 3Zm10 10c-.265 0-.52.105-.707.293-.188.187-.293.442-.293.707v3.586l-4.293-4.293-.076-.068c-.192-.155-.435-.233-.68-.22-.247.014-.48.118-.654.292-.174.174-.278.407-.291.653-.014.246.064.489.219.681l.068.076L17.586 19H14c-.265 0-.52.105-.707.293-.188.187-.293.442-.293.707 0 .265.105.52.293.707.187.188.442.293.707.293h7v-7c0-.265-.105-.52-.293-.707C20.52 13.105 20.265 13 20 13Z"
                    })
                )
            )
        )
    );
}

function YoutubeSponsorBlockEmbed({ Component, props }: { Component: React.ComponentType<IframeProps>; props: IframeProps; }) {
    const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null);
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [fakeFullscreen, setFakeFullscreen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const pointerInOverlay = useRef(false);
    const hideTimeout = useRef<number | undefined>(undefined);

    const showOverlay = () => {
        setOverlayVisible(true);
        if (hideTimeout.current !== undefined) window.clearTimeout(hideTimeout.current);
        hideTimeout.current = window.setTimeout(() => {
            if (!pointerInOverlay.current) setOverlayVisible(false);
        }, 5200);
    };

    useEffect(() => {
        showOverlay();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setFakeFullscreen(false);
        };
        const onFullscreenChange = () => {
            if (document.fullscreenElement !== rootRef.current) setFakeFullscreen(false);
        };

        window.addEventListener("keydown", onKeyDown);
        document.addEventListener("fullscreenchange", onFullscreenChange);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("fullscreenchange", onFullscreenChange);
            if (hideTimeout.current !== undefined) window.clearTimeout(hideTimeout.current);
        };
    }, []);

    useEffect(() => {
        if (!fakeFullscreen) {
            if (document.fullscreenElement === rootRef.current) void document.exitFullscreen();
            return;
        }

        if (document.fullscreenElement !== rootRef.current) {
            void rootRef.current?.requestFullscreen?.();
        }
    }, [fakeFullscreen]);

    const patchedProps = plugin.patchIframeProps({
        ...props,
        onLoad: event => {
            props.onLoad?.(event);
            if (event.currentTarget instanceof HTMLIFrameElement) setIframe(event.currentTarget);
        },
        onMouseMove: event => {
            props.onMouseMove?.(event);
            showOverlay();
        },
        onPointerMove: event => {
            props.onPointerMove?.(event);
            showOverlay();
        }
    });

    return React.createElement("div", { className: cl("root", { "root-fullscreen": fakeFullscreen }), ref: rootRef },
        React.createElement(Component, patchedProps),
        React.createElement("div", {
            className: cl("activity"),
            onMouseEnter: () => {
                pointerInOverlay.current = true;
                showOverlay();
            },
            onMouseLeave: () => {
                pointerInOverlay.current = false;
                showOverlay();
            },
            onMouseMove: showOverlay,
            onPointerMove: showOverlay
        },
            React.createElement(SponsorBlockOverlay, { iframe, visible: overlayVisible, fakeFullscreen, setFakeFullscreen })
        )
    );
}

const WrappedYoutubeSponsorBlockEmbed = ErrorBoundary.wrap(YoutubeSponsorBlockEmbed, { noop: true });

const plugin = definePlugin({
    name: "YoutubeSponsorBlock",
    description: "Adds SponsorBlock skipping to YouTube embeds.",
    tags: ["Media", "Utility"],
    authors: [EquicordDevs.Ape],
    settings,

    patches: [{
        find: "stripParams:[\"parent\"],appendParams:{parent",
        replacement: [
            {
                match: /allowFullScreen:(\i),\.\.\.(\i)\}\)/,
                replace: "allowFullScreen:$1,...$self.patchIframeProps($2)})"
            },
            {
                match: /return\(0,\i\.jsx\)\((\i),\{ref:(\i),src:(\i),\.\.\.(\i)\}\)/,
                replace: "return $self.renderYoutubeEmbed($1,{ref:$2,src:$3,...$4})"
            }
        ]
    }],

    start() {
        window.addEventListener("message", onMessage);
    },

    stop() {
        window.removeEventListener("message", onMessage);
        for (const { iframe } of controllers.values()) {
            unregisterIframe(iframe);
        }
    },

    patchIframeProps(props: IframeProps) {
        if (typeof props.src !== "string") return props;

        const videoId = getYoutubeVideoId(props.src);
        if (!videoId) return props;

        const originalOnLoad = props.onLoad;
        return {
            ...props,
            src: withYoutubeApi(props.src),
            allowFullScreen: false,
            onLoad: (event: Event) => {
                originalOnLoad?.(event);

                if (event.currentTarget instanceof HTMLIFrameElement) {
                    void registerIframe(event.currentTarget, videoId);
                }
            }
        };
    },

    renderYoutubeEmbed(Component: React.ComponentType<IframeProps>, props: IframeProps) {
        if (typeof props.src !== "string" || !getYoutubeVideoId(props.src)) {
            return React.createElement(Component, props);
        }

        return React.createElement(WrappedYoutubeSponsorBlockEmbed, { Component, props });
    }
});

export default plugin;
