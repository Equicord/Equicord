/*
 * Equicord Plugin
 * Copyright (c) 2024 Equicord and contributors
 */

import { addPreSendListener, removePreSendListener, MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { DataStore } from "@api/index";

const logger = new Logger("Gibberish");
3const CUSTOM_DICT_KEY = "Gibberish_CustomDict";

const transformationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

const memoizedTransform = (word: string, transformFn: (w: string) => string): string => {
    const cacheKey = word + transformFn.name;
    if (transformationCache.has(cacheKey)) {
        return transformationCache.get(cacheKey)!;
    }

    const result = transformFn(word);

    if (transformationCache.size >= MAX_CACHE_SIZE) {
        const entries = Array.from(transformationCache.entries());
        const halfSize = Math.floor(entries.length / 2);
        transformationCache.clear();
        entries.slice(halfSize).forEach(([k, v]) => transformationCache.set(k, v));
    }

    transformationCache.set(cacheKey, result);
    return result;
};

const GIBBERISH_DICT: Record<string, string[]> = {
    "hello": ["hewwo", "henlo", "heyo", "greetingz", "hoi", "hai"],
    "hi": ["hai", "heyo", "henlo", "howdy"],
    "hey": ["heyo", "hai", "hewwo", "oi"],
    "goodbye": ["bai", "cya", "farewell-eth", "toodles"],
    "bye": ["bai", "cya", "toodles", "peace"],
    "yes": ["yus", "yesh", "yep", "yeperz"],
    "no": ["nuu", "nope", "nah", "nein"],
    "what": ["wut", "whut", "wat", "nani"],
    "why": ["y tho", "whyyyy", "for why", "how come"],
    "how": ["howz", "in wat way", "by wat means"],
    "good": ["gud", "noice", "amazeballs", "epic"],
    "bad": ["nawt gud", "terrible-eth", "sadge", "oof"],
    "okay": ["okie", "okies", "oki doki", "aight"],
    "please": ["pwease", "pweety pwease", "plz", "pwetty pwease"],
    "thanks": ["thankies", "tanku", "much thank", "gratitude++"],
    "thank you": ["thankies", "tanku", "much thank", "gratitude++"],
    "happy": ["happ", "joyed", "much happy", "blessed"],
    "sad": ["sadge", "much sad", "depression++", "le sad"],
    "angry": ["angy", "mad++", "rage", "fury"],
    "tired": ["sleepy++", "exhausted-eth", "need nap", "zzz"],
    "excited": ["hype", "much excite", "cant wait", "anticipation++"],
    "love": ["wuv", "adore", "much like", "heart"],
    "hate": ["much dislike", "no like", "anti-love", "despise-eth"],
    "want": ["desire++", "need", "must have", "gimmie"],
    "need": ["require-eth", "must obtain", "desperate for", "pls give"],
    "think": ["thonk", "process", "compute", "brain.exe"],
    "food": ["noms", "snackies", "sustenance", "foodstuffs"],
    "drink": ["sippy", "beverage", "liquid-eth", "thirst--"],
    "computer": ["puter", "machine", "tech-box", "compute-inator"],
    "phone": ["mobile-eth", "handheld", "pocket-puter", "comm-device"],
    "today": ["dis day", "currently", "present-time", "now-eth"],
    "tomorrow": ["next-day", "future-time", "soon++", "later-eth"],
    "later": ["after-time", "not-now", "future-eth", "soon™"],
    "now": ["currently", "present-time", "dis moment", "right-meow"]
};

interface TransformStats {
    totalMessages: number;
    totalWordsTransformed: number;
    transformationTimes: number[];
    cacheHits: number;
    cacheMisses: number;
}

const stats: TransformStats = {
    totalMessages: 0,
    totalWordsTransformed: 0,
    transformationTimes: [],
    cacheHits: 0,
    cacheMisses: 0
};

const settings = definePluginSettings({
    mode: {
        type: OptionType.SELECT,
        description: "Text transformation mode",
        options: [
            { label: "Random Gibberish", value: "gibberish" },
            { label: "Word Swap", value: "wordswap" },
            { label: "Word Scramble", value: "scramble" },
            { label: "Chaos", value: "chaos" },
            { label: "UwU", value: "uwu" },
            { label: "L33t", value: "leet" }
        ],
        default: "gibberish"
    },
    intensity: {
        type: OptionType.SLIDER,
        description: "Transformation intensity (% of words affected)",
        default: 50,
        markers: [0, 25, 50, 75, 100]
    },
    preserveCase: {
        type: OptionType.BOOLEAN,
        description: "Preserve original capitalization",
        default: true
    },
    preservePunctuation: {
        type: OptionType.BOOLEAN,
        description: "Preserve punctuation",
        default: true
    },
    enableCache: {
        type: OptionType.BOOLEAN,
        description: "Enable word transformation caching (improves performance)",
        default: true
    },
    customReplacements: {
        type: OptionType.STRING,
        description: "Custom word replacements (format: word=replacement,word2=replacement2)",
        default: ""
    },
    showStats: {
        type: OptionType.BOOLEAN,
        description: "Show transformation statistics in console",
        default: false
    }
});

const generateGibberish = (word: string): string => {
    try {
        const consonants = 'bcdfghjklmnpqrstvwxyz';
        const vowels = 'aeiou';
        let result = '';
        let useConsonant = Math.random() > 0.5;

        for (let i = 0; i < word.length; i++) {
            if (useConsonant) {
                result += consonants[Math.floor(Math.random() * consonants.length)];
            } else {
                result += vowels[Math.floor(Math.random() * vowels.length)];
            }
            useConsonant = !useConsonant;
        }

        return result;
    } catch (error) {
        logger.error("Error in generateGibberish:", error);
        return word;
    }
};

const swapWord = (word: string, customDict: Record<string, string[]>): string => {
    try {
        const lowerWord = word.toLowerCase();
        const combined = { ...GIBBERISH_DICT, ...customDict };

        if (combined[lowerWord]) {
            const alternatives = combined[lowerWord];
            return alternatives[Math.floor(Math.random() * alternatives.length)];
        }
        return word;
    } catch (error) {
        logger.error("Error in swapWord:", error);
        return word;
    }
};

const parseCustomReplacements = async (): Promise<Record<string, string[]>> => {
    try {
        const stored = await DataStore.get(CUSTOM_DICT_KEY) || {};
        const custom = settings.store.customReplacements;

        if (!custom) return stored;

        const dict: Record<string, string[]> = { ...stored };
        custom.split(',').forEach(pair => {
            const [word, replacement] = pair.split('=').map(s => s.trim());
            if (word && replacement) {
                dict[word.toLowerCase()] = dict[word.toLowerCase()] || [];
                if (!dict[word.toLowerCase()].includes(replacement)) {
                    dict[word.toLowerCase()].push(replacement);
                }
            }
        });

        await DataStore.set(CUSTOM_DICT_KEY, dict);
        return dict;
    } catch (error) {
        logger.error("Error parsing custom replacements:", error);
        return {};
    }
};

const scrambleWord = (word: string): string => {
    try {
        if (word.length <= 3) return word;

        const first = word[0];
        const last = word[word.length - 1];
        const middle = word.slice(1, -1).split('');

        for (let i = middle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [middle[i], middle[j]] = [middle[j], middle[i]];
        }

        return first + middle.join('') + last;
    } catch (error) {
        logger.error("Error in scrambleWord:", error);
        return word;
    }
};

const leetSpeak = (word: string): string => {
    try {
        return word
            .replace(/a/gi, '4')
            .replace(/e/gi, '3')
            .replace(/i/gi, '1')
            .replace(/o/gi, '0')
            .replace(/s/gi, '5')
            .replace(/t/gi, '7')
            .replace(/l/gi, '1')
            .replace(/z/gi, '2');
    } catch (error) {
        logger.error("Error in leetSpeak:", error);
        return word;
    }
};

const uwuify = (word: string): string => {
    try {
        return word
            .replace(/[lr]/g, 'w')
            .replace(/[LR]/g, 'W')
            .replace(/n([aeiou])/g, 'ny$1')
            .replace(/N([aeiou])/g, 'Ny$1')
            .replace(/th/g, 'd')
            .replace(/ove/g, 'uv');
    } catch (error) {
        logger.error("Error in uwuify:", error);
        return word;
    }
};

const transformText = async (text: string): Promise<string> => {
    if (!text) return text;

    const startTime = performance.now();
    try {
        const words = text.split(/(\s+|[.,!?]+)/);
        const customDict = await parseCustomReplacements();

        let transformedWords = await Promise.all(words.map(async word => {
            if (!word || /^\s+$/.test(word)) return word;
            if (settings.store.preservePunctuation && /^[.,!?]+$/.test(word)) return word;

            if (Math.random() * 100 > settings.store.intensity) return word;

            let transformFn: (w: string) => string;
            switch (settings.store.mode) {
                case "gibberish":
                    transformFn = generateGibberish;
                    break;
                case "wordswap":
                    transformFn = w => swapWord(w, customDict);
                    break;
                case "scramble":
                    transformFn = scrambleWord;
                    break;
                case "leet":
                    transformFn = leetSpeak;
                    break;
                case "uwu":
                    transformFn = uwuify;
                    break;
                case "chaos":
                    const methods = [generateGibberish, w => swapWord(w, customDict), scrambleWord, leetSpeak, uwuify];
                    transformFn = methods[Math.floor(Math.random() * methods.length)];
                    break;
                default:
                    return word;
            }

            let transformed = settings.store.enableCache
                ? memoizedTransform(word, transformFn)
                : transformFn(word);

            if (settings.store.preserveCase) {
                if (word === word.toUpperCase()) {
                    transformed = transformed.toUpperCase();
                } else if (word[0] === word[0].toUpperCase()) {
                    transformed = transformed[0].toUpperCase() + transformed.slice(1).toLowerCase();
                }
            }

            stats.totalWordsTransformed++;
            return transformed;
        }));

        const endTime = performance.now();
        stats.transformationTimes.push(endTime - startTime);
        stats.totalMessages++;

        if (settings.store.showStats && stats.totalMessages % 10 === 0) {
            const avgTime = stats.transformationTimes.reduce((a, b) => a + b, 0) / stats.transformationTimes.length;
            logger.info(`
                Transformation Stats:
                Messages Processed: ${stats.totalMessages}
                Words Transformed: ${stats.totalWordsTransformed}
                Average Transform Time: ${avgTime.toFixed(2)}ms
                Cache Hits: ${stats.cacheHits}
                Cache Misses: ${stats.cacheMisses}
                Cache Hit Rate: ${((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(2)}%
            `);
        }

        return transformedWords.join('');
    } catch (error) {
        logger.error("Error in transformText:", error);
        return text;
    }
};

export default definePlugin({
    name: "Gibberish",
    description: "Transform your messages into various forms of gibberish",
    authors: [{ name: "Keiran", id: 0n }],
    dependencies: ["MessageEventsAPI"],
    settings,

    async start() {
        try {
            this.preSend = addPreSendListener(async (channelId, msg) => {
                msg.content = await transformText(msg.content);
            });
            logger.info("Gibberish plugin started successfully");
        } catch (error) {
            logger.error("Failed to start Gibberish plugin:", error);
        }
    },

    stop() {
        try {
            removePreSendListener(this.preSend);
            logger.info("Gibberish plugin stopped successfully");
        } catch (error) {
            logger.error("Failed to stop Gibberish plugin:", error);
        }
    }
});
