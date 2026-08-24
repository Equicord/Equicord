import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

let styleElement: HTMLStyleElement | null = null;
let messages: any[] = [];

let onMouseOver: ((e: MouseEvent) => void) | null = null;
let onMouseOut: ((e: MouseEvent) => void) | null = null;
let hoverObserver: MutationObserver | null = null;

const HOVER_GATED_MEDIA_SELECTOR =
    "[class*=\"stickersAnimated\"] video, " +
    "[class*=\"sticker\"][class*=\"animated\"] video, " +
    "[data-type=\"sticker\"] video, " +
    "[class*=\"emojiItem\"] video, " +
    "[class*=\"markup\"] video[class*=\"emoji\"], " +
    "video[class*=\"gif\"]";

function pauseMedia(el: Element) {
    if (el instanceof HTMLVideoElement && !el.paused) {
        el.pause();
        el.currentTime = 0;
    }
}

function playMedia(el: Element) {
    if (el instanceof HTMLVideoElement) {
        el.play().catch(() => {});
    }
}

function initHoverGating() {
    const pauseAllMatching = (root: ParentNode) => {
        root.querySelectorAll(HOVER_GATED_MEDIA_SELECTOR).forEach(pauseMedia);
    };
    pauseAllMatching(document);

    hoverObserver = new MutationObserver(mutations => {
        for (const m of mutations) {
            m.addedNodes.forEach(node => {
                if (!(node instanceof Element)) return;
                if (node.matches?.(HOVER_GATED_MEDIA_SELECTOR)) pauseMedia(node);
                pauseAllMatching(node);
            });
        }
    });
    hoverObserver.observe(document.body, { childList: true, subtree: true });

    onMouseOver = (e: MouseEvent) => {
        const target = (e.target as Element)?.closest?.(HOVER_GATED_MEDIA_SELECTOR);
        if (target) playMedia(target);
    };
    onMouseOut = (e: MouseEvent) => {
        const target = (e.target as Element)?.closest?.(HOVER_GATED_MEDIA_SELECTOR);
        if (target) pauseMedia(target);
    };

    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
}

function teardownHoverGating() {
    hoverObserver?.disconnect();
    hoverObserver = null;
    if (onMouseOver) document.removeEventListener("mouseover", onMouseOver, true);
    if (onMouseOut) document.removeEventListener("mouseout", onMouseOut, true);
    onMouseOver = null;
    onMouseOut = null;
}

const css = `
[class*="messageListItem"] [class*="buttonContainer"],
[class*="messageListItem"] [class*="button"][class*="hover"],
[class*="channelItem"] [class*="hoverBar"],
[class*="member"][class*="hover"] {
    transition: none !important;
}

[class*="avatarDecoration"] img,
[class*="avatarDecoration"] video,
[class*="avatarDecoration"] canvas {
    animation: none !important;
    animation-play-state: paused !important;
}

[class*="profileEffects"] video,
[class*="profileEffects"] canvas,
[class*="profileEffectPreview"] video,
[class*="profileEffectPreview"] canvas {
    animation: none !important;
    animation-play-state: paused !important;
}

[class*="premiumBadge"] svg animate,
[class*="premiumBadge"] svg animateTransform,
[class*="guildBoostBadge"] svg animate,
[class*="animatedBanner"] video {
    animation: none !important;
    animation-play-state: paused !important;
}

[class*="superReactionExplosion"],
[class*="reactionExplosion"],
[class*="burstReaction"],
[class*="premiumReactionEffect"] {
    display: none !important;
}

[class*="reactionInner"] {
    animation: none !important;
    transition: none !important;
}

[class*="confettiCanvas"],
[class*="celebrationOverlay"] {
    display: none !important;
}

[class*="menu"][role="menu"],
[class*="contextMenu"],
[class*="popout"][class*="layer"],
[class*="autocomplete"][class*="wrapper"],
[class*="tooltip"][role="tooltip"] {
    background-color: var(--background-floating, var(--background-elevated-high)) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

[class*="typing"] [class*="dots"] {
    animation: none !important;
}
`;

function addMessage(event: any) {
    const msg = event?.message;
    if (!msg) return;
    messages.push({
        id: msg.id,
        author: msg.author?.username ?? "Unknown",
        content: msg.content ?? "",
        channel: msg.channel_id,
        timestamp: Date.now()
    });
    if (messages.length > 20) {
        messages.shift();
    }
}

export default definePlugin({
    name: "ZXTUltraPerformance",
    description: "Discord performance mode: pauses cosmetic animations without hiding content or breaking menus/media viewer.",
    authors: [{ name: "ZXT", id: 1531412914005606513n }],

    start() {
        styleElement = document.createElement("style");
        styleElement.id = "zxt-ultra-performance";
        styleElement.textContent = css;
        document.head.appendChild(styleElement);

        initHoverGating();

        FluxDispatcher.subscribe("MESSAGE_CREATE", addMessage);
        (window as any).ZXTMessages = messages;

        console.log("%c[ZXT] Ultra Performance Enabled", "color:#00ff88;font-weight:bold");
    },

    stop() {
        styleElement?.remove();
        styleElement = null;

        teardownHoverGating();

        FluxDispatcher.unsubscribe("MESSAGE_CREATE", addMessage);
        messages = [];
        delete (window as any).ZXTMessages;

        console.log("%c[ZXT] Ultra Performance Disabled", "color:#ff5555;font-weight:bold");
    }
});