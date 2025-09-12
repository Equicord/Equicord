import definePlugin from "@utils/types";

const SELECTORS = [
    '[class^="name_"]',
    '[class*=" name_"]'
].join(", ");

const OPTIONS = {
    enforceLowerCase: false as const,
    sepText: " " as const,
    sepCategoryOrVoice: " " as const,
};

const SMALL_CAPS_MAP: Record<string, string> = {
    "ᴀ":"a","ʙ":"b","ᴄ":"c","ᴅ":"d","ᴇ":"e","ꜰ":"f","ɢ":"g","ʜ":"h","ɪ":"i","ᴊ":"j","ᴋ":"k","ʟ":"l","ᴍ":"m","ɴ":"n",
    "ᴏ":"o","ᴘ":"p","ǫ":"q","ʀ":"r","ꜱ":"s","ᴛ":"t","ᴜ":"u","ᴠ":"v","ᴡ":"w","x":"x","ʏ":"y","ᴢ":"z",
    "ℍ":"H","𝙷":"H","ℌ":"H","𝖍":"h","ℭ":"C","𝖈":"c","𝖆":"a","𝖊":"e","𝖔":"o","𝖘":"s","𝖙":"t",
    "Ⅰ":"I","Ⅱ":"II","Ⅲ":"III","Ⅳ":"IV","Ⅴ":"V","Ⅵ":"VI","Ⅶ":"VII","Ⅷ":"VIII","Ⅸ":"IX","Ⅹ":"X"
};

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function foldWeirdLetters(s: string): string {
    return s
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .split("")
        .map(ch => SMALL_CAPS_MAP[ch] ?? ch)
        .join("");
}

function looksCleanEnough(s: string): boolean {
    return /^[A-Za-z0-9 \-]+$/.test(s);
}

function capitalizeFirst(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function sanitizeLabel(text: string, isCategory: boolean): string {
    // Minimal: replace dashes with space and capitalize only the first character. Keep emojis and other characters.
    let n = text;
    // Replace hyphens with spaces
    n = n.replace(/-/g, " ");
    // Trim excessive spaces
    n = n.replace(/\s+/g, " ").trim();
    n = capitalizeFirst(n);
    if (!n) n = "Channel";
    return n;
}

let observer: MutationObserver | null = null;
const pending = new Set<HTMLElement>();
let rafHandle: number | null = null;

function scheduleFlush() {
    if (rafHandle != null) return;
    rafHandle = requestAnimationFrame(() => {
        rafHandle = null;
        flush();
    });
}

function queue(el: HTMLElement) {
    pending.add(el);
    scheduleFlush();
}

function tryClean(el: HTMLElement) {
    const raw = el.textContent ?? "";
    if (!raw) return;

    const isCategory = el.classList.contains("name__29444");
    const cleaned = sanitizeLabel(raw, isCategory);

    if (!el.dataset.cleanOrig) {
        el.dataset.cleanOrig = raw;
    }
    if (cleaned !== raw) {
        el.textContent = cleaned;
        if (el.getAttribute("aria-label")) el.setAttribute("aria-label", cleaned);
        if (el.getAttribute("title")) el.setAttribute("title", cleaned);
    }
}

function flush() {
    for (const el of pending) {
        try {
            tryClean(el);
        } catch {}
    }
    pending.clear();
}

function scanExisting() {
    document.querySelectorAll<HTMLElement>(SELECTORS).forEach(el => queue(el));
}

export default definePlugin({
    name: "CleanerChannelNames",
    authors: [{ name: "7xeh", id: 785035260852830219n }],
    description: "Replace hyphens with spaces and capitalize only the first letter; leaves emojis intact",
    start() {
        scanExisting();
        observer = new MutationObserver(muts => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (node.matches?.(SELECTORS)) queue(node);
                    node.querySelectorAll?.(SELECTORS).forEach(el => queue(el as HTMLElement));
                }
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },
    stop() {
        observer?.disconnect();
        observer = null;
        document.querySelectorAll<HTMLElement>(SELECTORS).forEach(el => {
            const orig = el.dataset.cleanOrig;
            if (orig != null) {
                el.textContent = orig;
                if (el.getAttribute("aria-label")) el.setAttribute("aria-label", orig);
                if (el.getAttribute("title")) el.setAttribute("title", orig);
                delete el.dataset.cleanOrig;
            }
        });
        pending.clear();
    }
});
// Yo
