import definePlugin from "@utils/types";

const SELECTORS = [".name__2ea32", ".name__29444"].join(", ");

const OPTIONS = {
    enforceLowerCase: true as const,
    sepText: " " as const,
    sepCategoryOrVoice: " " as const,
};

const SMALL_CAPS_MAP: Record<string, string> = {
    "ᴀ":"a","ʙ":"b","ᴄ":"c","ᴅ":"d","ᴇ":"e","ꜰ":"f","ɢ":"g","ʜ":"h","ɪ":"i","ᴊ":"j","ᴋ":"k","ʟ":"l","ᴍ":"m","ɴ":"n",
    "ᴏ":"o","ᴘ":"p","ǫ":"q","ʀ":"r","ꜱ":"s","ᴛ":"t","ᴜ":"u","ᴠ":"v","ᴡ":"w","x":"x","ʏ":"y","ᴢ":"z",
    "ℍ":"H","𝙷":"H","ℌ":"H","𝖍":"h","ℭ":"C","𝖈":"c","𝖆":"a","𝖊":"e","𝖔":"o","𝖘":"s","𝖙":"t",
    "Ⅰ":"I","Ⅱ":"II","Ⅲ":"III","Ⅳ":"IV","Ⅴ":"V","Ⅵ":"VI","Ⅶ":"VII","Ⅷ":"VIII","Ⅸ":"IX","Ⅹ":"X"
};

function foldWeirdLetters(s: string): string {
    let out = s.normalize("NFKD").replace(/\p{M}+/gu, "");
    out = out.replace(
        /[\u{1D400}-\u{1D7FF}ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢℍℌℭⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ𝙷𝖍𝖈𝖆𝖊𝖔𝖘𝖙]/gu,
        m => SMALL_CAPS_MAP[m] ?? m
    );
    return out;
}

function stripAllEmoji(s: string): string {
    return s.replace(/\p{Extended_Pictographic}/gu, "").replace(/[\uFE0F\u200D]/g, "");
}

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapseSeparators(s: string, sep: string): string {
    let out = s.replace(/^[\p{Punctuation}\s]+|[\p{Punctuation}\s]+$/gu, "");
    out = out.replace(/-?[^\p{Letter}\p{Number}\u0020-\u007E]-?/gu, sep);
    out = out.replace(/[\s\-]+/g, sep).replace(new RegExp(`${escapeRegExp(sep)}+`, "g"), sep);
    out = out.trim();
    return out;
}

function looksCleanEnough(s: string): boolean {
    return /^[A-Za-z0-9 \-]+$/.test(s);
}

function capitalizeFirst(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function sanitizeLabel(text: string, isCategory: boolean): string {
    const sep = isCategory ? OPTIONS.sepCategoryOrVoice : OPTIONS.sepText;
    let n = text;

    if (!looksCleanEnough(n)) {
        n = foldWeirdLetters(n);
        n = stripAllEmoji(n);
        n = n.replace(/[^\u0020-\u007E]/g, "");
    }
    n = collapseSeparators(n, sep);

    if (OPTIONS.enforceLowerCase) n = n.toLowerCase();

    n = capitalizeFirst(n);

    if (!n) n = "Channel";
    return n;
}

let observer: MutationObserver | null = null;
const pending = new Set<HTMLElement>();
let rafScheduled = false;

function scheduleFlush() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
        rafScheduled = false;
        for (const el of pending) {
            pending.delete(el);
            tryClean(el);
        }
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

function scanExisting() {
    document.querySelectorAll<HTMLElement>(SELECTORS).forEach(el => queue(el));
}

export default definePlugin({
    name: "CleanerChannelNames",
    authors: [{ name: "7xeh", id: 785035260852830219n }],
    description: "Cleans channel & category labels: strips fancy text/emoji, replaces dashes with spaces, and capitalizes the first letter",
    start() {
        scanExisting();
        observer = new MutationObserver(muts => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (node.matches?.(SELECTORS)) queue(node);
                    node.querySelectorAll?.(SELECTORS).forEach(el => queue(el as HTMLElement));
                }
                if (m.type === "characterData" && m.target instanceof CharacterData) {
                    const host = m.target.parentElement;
                    if (host && host.matches(SELECTORS)) queue(host);
                }
            }
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
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