/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { createRoot, React } from "@webpack/common";
import type { Root } from "react-dom/client";

const SnowfallCSS = `
#snowfield {
    pointer-events: none;
    user-select: none;
    z-index: 100000;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
}
.snowflake {
    position: absolute;
    color: #fff;
    line-height: 1;
    -webkit-font-smoothing: antialiased;
}
.snowflake-solid {
    border-radius: 50%;
    background: #ffffff;
}
`;

class CopleSnow {
    private static winWidth = window.innerWidth;
    private static winHeight = window.innerHeight;

    private static readonly defaultOptions = {
        minSize: 10,
        maxSize: 30,
        type: "text" as "text" | "solid" | "image",
        content: "&#10052;" as string | string[],
        fadeOut: true,
        autoplay: true,
        interval: 200
    };

    private static cssPrefix(propertyName: string): string | null {
        const capitalize = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
        const tempDiv = document.createElement("div");
        const { style } = tempDiv;
        const prefixes = ["Webkit", "Moz", "ms", "O"];

        if (propertyName in style) return propertyName;
        for (const prefix of prefixes) {
            const name = prefix + capitalize;
            if (name in style) return name;
        }
        return null;
    }

    private static readonly cssPrefixedNames = {
        transform: this.cssPrefix("transform"),
        transition: this.cssPrefix("transition")
    };

    private static readonly transitionEndEvent =
        { WebkitTransition: "webkitTransitionEnd", OTransition: "oTransitionEnd", Moztransition: "transitionend", transition: "transitionend" }[
        this.cssPrefixedNames.transition ?? "transition"
        ] ?? "transitionend";

    private static random(min: number, max: number, deviation?: number): number {
        if (deviation !== undefined) {
            deviation *= max;
            max += deviation;
            min = max - deviation;
        } else {
            min = min || 0;
        }
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    private static setStyle(element: HTMLElement, rules: Record<string, string | number>) {
        for (const [name, value] of Object.entries(rules)) {
            const cssName = CopleSnow.cssPrefixedNames[name as keyof typeof CopleSnow.cssPrefixedNames] || name;
            (element.style as any)[cssName] = value;
        }
    }

    private options = { ...CopleSnow.defaultOptions };
    private queue: HTMLElement[] = [];
    private $snowfield: HTMLDivElement;
    private timer: number | null = null;
    public playing = false;

    constructor(newOptions: Partial<typeof CopleSnow.defaultOptions> = {}) {
        Object.assign(this.options, newOptions);

        this.$snowfield = document.createElement("div");
        this.$snowfield.id = "snowfield";
        document.body.appendChild(this.$snowfield);

        const updateSize = () => {
            CopleSnow.winHeight = window.innerHeight;
            CopleSnow.winWidth = window.innerWidth;
        };
        window.addEventListener("resize", updateSize);
        (this as any)._resizeHandler = updateSize;

        this.$snowfield.addEventListener(CopleSnow.transitionEndEvent, e => {
            const snowflake = e.target as HTMLElement;
            if (snowflake.classList.contains("snowflake")) {
                this.$snowfield.removeChild(snowflake);
                this.queue.push(snowflake);
            }
        });

        const handleVisibilityChange = () => {
            if (document.hidden) this.stop();
            else this.play();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        (this as any)._visibilityHandler = handleVisibilityChange;

        if (this.options.autoplay) this.play();
    }

    private createSnowflake(): HTMLElement {
        const { type, content } = this.options as { type: "text" | "image" | "solid"; content: string | string[]; };
        const cntLength = Array.isArray(content) ? content.length : 1;

        let snowflake: HTMLElement;

        if (type === "image") {
            snowflake = document.createElement("img");
            (snowflake as HTMLImageElement).src = typeof content === "string"
                ? content
                : content[Math.floor(Math.random() * cntLength)];
        } else {
            snowflake = document.createElement("div");
            if (type === "text") {
                snowflake.innerHTML = typeof content === "string"
                    ? content
                    : content[Math.floor(Math.random() * cntLength)];
            }
            // if type is solid we don't need to set content
        }

        snowflake.className = `snowflake snowflake-${type}`;
        (snowflake as any).dataset.type = type;

        return snowflake;
    }

    private animateSnowflake() {
        const { winWidth, winHeight } = CopleSnow;
        const size = CopleSnow.random(this.options.minSize, this.options.maxSize);
        const top = -2 * size;
        const left = CopleSnow.random(0, winWidth - size);
        const opacity = CopleSnow.random(5, 10) / 10;
        const angle = CopleSnow.random(0, winHeight * 0.8, 1);
        const translateX = CopleSnow.random(-100, 100);
        const translateY = winHeight + size * 2;
        const duration = CopleSnow.random(0, winHeight * 20, 0.2);

        let snowflake: HTMLElement;
        if (this.queue.length > 0) {
            snowflake = this.queue.shift()!;
            if ((snowflake.dataset.type as string) !== this.options.type) {
                snowflake = this.createSnowflake();
            }
        } else {
            snowflake = this.createSnowflake();
        }

        const styleRules: Record<string, string | number> = {
            top: `${top}px`,
            left: `${left}px`,
            opacity: opacity,
            transform: "none",
            transition: `${duration}ms linear`
        };

        switch (this.options.type) {
            case "solid":
                styleRules.width = styleRules.height = `${size}px`;
                break;
            case "text":
                styleRules.fontSize = `${size}px`;
                break;
            case "image":
                styleRules.width = `${size}px`;
                break;
        }

        CopleSnow.setStyle(snowflake, styleRules);
        this.$snowfield.appendChild(snowflake);

        setTimeout(() => {
            CopleSnow.setStyle(snowflake, {
                transform: `translate(${translateX}px, ${translateY}px) rotate(${angle}deg)`,
                opacity: this.options.fadeOut ? 0 : opacity
            });
        }, 100);
    }

    play() {
        if (this.playing) return;
        this.timer = window.setInterval(() => this.animateSnowflake(), this.options.interval);
        this.playing = true;
    }

    stop() {
        if (!this.playing) return;
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.playing = false;
    }

    destroy() {
        this.stop();
        if (this.$snowfield.parentNode) {
            this.$snowfield.remove();
        }
        window.removeEventListener("resize", (this as any)._resizeHandler);
        document.removeEventListener("visibilitychange", (this as any)._visibilityHandler);
    }
}

const SnowfallManager: React.FC = () => {
    const snowRef = React.useRef<CopleSnow | null>(null);
    const styleRef = React.useRef<HTMLStyleElement | null>(null);

    React.useEffect(() => {
        // Inject CSS
        const styleEl = document.createElement("style");
        styleEl.id = "snowfall-styles";
        styleEl.textContent = SnowfallCSS;
        document.head.appendChild(styleEl);
        styleRef.current = styleEl;

        // Create snow instance
        const snow = new CopleSnow({ autoplay: false });
        snowRef.current = snow;

        const blurHandler = () => snow.stop();
        const focusHandler = () => {
            if (document.hasFocus()) snow.play();
        };

        window.addEventListener("blur", blurHandler);
        window.addEventListener("focus", focusHandler);

        if (document.hasFocus()) {
            snow.play();
        }

        return () => {
            snow.destroy();
            snowRef.current = null;

            window.removeEventListener("blur", blurHandler);
            window.removeEventListener("focus", focusHandler);

            if (styleEl.parentNode) {
                styleEl.remove();
            }
            styleRef.current = null;

            const snowfield = document.getElementById("snowfield");
            if (snowfield) snowfield.remove();
        };
    }, []);

    return null;
};

let snowRoot: Root | null = null;
let container: HTMLDivElement | null = null;

export default definePlugin({
    name: "Snowfall",
    description: "Let it snow on Discord! Ported from the BetterDiscord plugin by square.",
    authors: [EquicordDevs.ZcraftElite, EquicordDevs.square],

    start() {
        container = document.createElement("div");
        container.id = "snowfall-plugin-container";
        document.body.appendChild(container);

        snowRoot = createRoot(container);
        snowRoot.render(React.createElement(SnowfallManager));
    },

    stop() {
        if (snowRoot) {
            snowRoot.unmount();
            snowRoot = null;
        }
        if (container) {
            if (container.parentNode) container.remove();
            container = null;
        }
    }
});
