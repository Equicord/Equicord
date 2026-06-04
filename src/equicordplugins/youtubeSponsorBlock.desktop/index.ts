/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { useForceUpdater } from "@utils/react";
import definePlugin from "@utils/types";
import { Button, React, useEffect, useRef, useState } from "@webpack/common";

import { getCategoryAction, getEnabledCategories, settings } from "./settings";
import type { Category, CategoryAction, Controller, IframeProps, Segment } from "./types";

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
    hook: "Hook/Greeting",
    filler: "Tangents/Jokes",
    music_offtopic: "Non-music"
};
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

    try {
        const response = await fetch(url.toString());
        if (!response.ok) return [];

        const segments = await response.json() as Segment[];
        return segments.filter(({ segment }) => Array.isArray(segment) && segment.length === 2);
    } catch {
        return [];
    }
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
    const forceUpdate = useForceUpdater();

    useEffect(() => {
        if (!iframe) return;

        const controller = controllers.get(iframe);
        if (!controller) return;

        const listener = () => forceUpdate();
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
                ? React.createElement(Button, {
                    className: cl("skip"),
                    color: Button.Colors.TRANSPARENT,
                    look: Button.Looks.FILLED,
                    size: Button.Sizes.SMALL,
                    onClick: () => skipSegment(controller, manualSegment)
                }, `Skip ${categoryLabels[manualSegment.category]}`)
                : null,
            unskipSegment
                ? React.createElement(Button, {
                    className: cl("unskip"),
                    color: Button.Colors.TRANSPARENT,
                    look: Button.Looks.FILLED,
                    size: Button.Sizes.SMALL,
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
            })
        )
    );
}

function YoutubeSponsorBlockEmbed({ Component, props, patchIframeProps }: {
    Component: React.ComponentType<IframeProps>;
    props: IframeProps;
    patchIframeProps: (props: IframeProps) => IframeProps;
}) {
    const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null);
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [fakeFullscreen, setFakeFullscreen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const hideTimeout = useRef<number | undefined>(undefined);

    const showOverlay = () => {
        setOverlayVisible(true);
        if (hideTimeout.current !== undefined) window.clearTimeout(hideTimeout.current);
        hideTimeout.current = window.setTimeout(() => setOverlayVisible(false), 5200);
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

    const patchedProps = patchIframeProps({
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
            className: cl("activity", { "activity-active": fakeFullscreen && !overlayVisible }),
            onMouseEnter: showOverlay,
            onMouseLeave: showOverlay,
            onMouseMove: showOverlay,
            onPointerMove: showOverlay
        },
            React.createElement(SponsorBlockOverlay, { iframe, visible: overlayVisible, fakeFullscreen, setFakeFullscreen })
        )
    );
}

const WrappedYoutubeSponsorBlockEmbed = ErrorBoundary.wrap(YoutubeSponsorBlockEmbed, { noop: true });

export default definePlugin({
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

        return React.createElement(WrappedYoutubeSponsorBlockEmbed, { Component, props, patchIframeProps: this.patchIframeProps });
    }
});
