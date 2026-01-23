/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { classNameFactory } from "@utils/css";
import { lodash } from "@webpack/common";

export const LANGUAGES = {
    en: "english",
    zh: "chinese",
    de: "german",
    es: "spanish/castilian",
    ru: "russian",
    ko: "korean",
    fr: "french",
    ja: "japanese",
    pt: "portuguese",
    tr: "turkish",
    pl: "polish",
    ca: "catalan/valencian",
    nl: "dutch/flemish",
    ar: "arabic",
    sv: "swedish",
    it: "italian",
    id: "indonesian",
    hi: "hindi",
    fi: "finnish",
    vi: "vietnamese",
    he: "hebrew",
    uk: "ukrainian",
    el: "greek",
    ms: "malay",
    cs: "czech",
    ro: "romanian/moldavian/moldovan",
    da: "danish",
    hu: "hungarian",
    ta: "tamil",
    no: "norwegian",
    th: "thai",
    ur: "urdu",
    hr: "croatian",
    bg: "bulgarian",
    lt: "lithuanian",
    la: "latin",
    mi: "maori",
    ml: "malayalam",
    cy: "welsh",
    sk: "slovak",
    te: "telugu",
    fa: "persian",
    lv: "latvian",
    bn: "bengali",
    sr: "serbian",
    az: "azerbaijani",
    sl: "slovenian",
    kn: "kannada",
    et: "estonian",
    mk: "macedonian",
    br: "breton",
    eu: "basque",
    is: "icelandic",
    hy: "armenian",
    ne: "nepali",
    mn: "mongolian",
    bs: "bosnian",
    kk: "kazakh",
    sq: "albanian",
    sw: "swahili",
    gl: "galician",
    mr: "marathi",
    pa: "punjabi/panjabi",
    si: "sinhala/sinhalese",
    km: "khmer",
    sn: "shona",
    yo: "yoruba",
    so: "somali",
    af: "afrikaans",
    oc: "occitan",
    ka: "georgian",
    be: "belarusian",
    tg: "tajik",
    sd: "sindhi",
    gu: "gujarati",
    am: "amharic",
    yi: "yiddish",
    lo: "lao",
    uz: "uzbek",
    fo: "faroese",
    ht: "haitian creole/haitian",
    ps: "pashto/pushto",
    tk: "turkmen",
    nn: "nynorsk",
    mt: "maltese",
    sa: "sanskrit",
    lb: "luxembourgish/letzeburgesch",
    my: "myanmar/burmese",
    bo: "tibetan",
    tl: "tagalog",
    mg: "malagasy",
    as: "assamese",
    tt: "tatar",
    haw: "hawaiian",
    ln: "lingala",
    ha: "hausa",
    ba: "bashkir",
    jw: "javanese",
    su: "sundanese",
};

export const cl = classNameFactory("vc-transcription-");

const getAudioContext = () => new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
export async function decodeAudio(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = getAudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Mix down to mono
    const channelData = audioBuffer.getChannelData(0);
    if (audioBuffer.numberOfChannels > 1) {
        for (let i = 1; i < audioBuffer.numberOfChannels; i++) {
            const channel = audioBuffer.getChannelData(i);
            for (let j = 0; j < channelData.length; j++) {
                channelData[j] += channel[j];
            }
        }
        for (let i = 0; i < channelData.length; i++) {
            channelData[i] /= audioBuffer.numberOfChannels;
        }
    }

    return channelData;
}

const workerCode = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = false;

const pendingRequests = new Map();

self.addEventListener('message', (event) => {
    const { type, id, response, error, headers } = event.data;

    if (type === 'fetch_response') {
        const resolver = pendingRequests.get(id);
        if (resolver) {
            pendingRequests.delete(id);
            if (error) {
                resolver.reject(new Error(error));
            } else {
                const res = new Response(response, {
                    headers: headers || { 'Content-Type': 'application/octet-stream' }
                });
                resolver.resolve(res);
            }
        }
    } else if (type === 'run') {
        runTranscription(event.data);
    }
});

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    const url = input.toString();
    if (url.includes('huggingface.co') || url.includes('cdn.jsdelivr.net')) {
         const id = Math.random().toString(36).substring(7);
         return new Promise((resolve, reject) => {
             pendingRequests.set(id, { resolve, reject });
             self.postMessage({ type: 'fetch_request', url, id });
         });
    }
    return originalFetch(input, init);
};

let transcriber = null;

async function runTranscription({ audio, model, quantized, language, task }) {
    try {
        if (!transcriber) {
            self.postMessage({ type: 'status', status: 'loading' });
            transcriber = await pipeline('automatic-speech-recognition', model, {
                quantized: quantized,
                progress_callback: (data) => {
                    self.postMessage({ type: 'progress', data });
                }
            });
        }

        self.postMessage({ type: 'status', status: 'transcribing' });

        const time_precision =
            transcriber.processor.feature_extractor.config.chunk_length /
            transcriber.model.config.max_source_positions;

        let chunks_to_process = [
            {
                tokens: [],
                finalised: false,
            },
        ];

        function chunk_callback(chunk) {
            let last = chunks_to_process[chunks_to_process.length - 1];

            Object.assign(last, chunk);
            last.finalised = true;

            if (!chunk.is_last) {
                chunks_to_process.push({
                    tokens: [],
                    finalised: false,
                });
            }
        }

        function callback_function(item) {
            let last = chunks_to_process[chunks_to_process.length - 1];

            last.tokens = [...item[0].output_token_ids];

            let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
                time_precision: time_precision,
                return_timestamps: true,
                force_full_sequences: false,
            });

            self.postMessage({
                type: 'partial',
                output: {
                    text: data[0],
                    chunks: data[1].chunks
                }
            });
        }

        const output = await transcriber(audio, {
            top_k: 0,
            do_sample: false,
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true,
            callback_function,
            chunk_callback,
            language,
            task: task === "translate" ? "translate" : undefined
        });

        self.postMessage({ type: 'complete', output });

    } catch (e) {
        self.postMessage({ type: 'error', error: e.toString() });
    }
}
`;

export class TranscriptionWorker {
    private worker: Worker;
    private onStatus: (status: string) => void;
    private onComplete: (output: any) => void;
    private onError: (error: any) => void;
    private onPartial: (output: any) => void;

    constructor(
        onStatus: (status: string) => void,
        onComplete: (output: any) => void,
        onError: (error: any) => void,
        onPartial: (output: any) => void
    ) {
        this.onStatus = onStatus;
        this.onComplete = onComplete;
        this.onError = onError;
        this.onPartial = onPartial;

        const blob = new Blob([workerCode], { type: "text/javascript" });
        this.worker = new Worker(URL.createObjectURL(blob), { type: "module" });
        this.worker.onmessage = this.handleMessage.bind(this);
    }

    private getMimeType(url: string): string {
        if (url.endsWith(".wasm")) return "application/wasm";
        if (url.endsWith(".json")) return "application/json";
        if (url.endsWith(".onnx")) return "application/octet-stream";
        return "application/octet-stream";
    }

    private async handleMessage(event: MessageEvent) {
        const { type, id, url, status, output, error } = event.data;

        switch (type) {
            case "fetch_request":
                try {
                    const cachedData = await DataStore.get(`VoiceMessageTranscriber_${url}`);

                    if (cachedData && lodash.isArrayBuffer(cachedData)) {
                        this.worker.postMessage({
                            type: "fetch_response",
                            id,
                            response: cachedData,
                            headers: {
                                "Content-Length": cachedData.byteLength.toString(),
                                "Content-Type": this.getMimeType(url)
                            }
                        });
                    } else {
                        const res = await fetch(url);
                        if (!res.ok) throw new Error("Failed to fetch " + url);

                        const buffer = await res.arrayBuffer();
                        await DataStore.set(`VoiceMessageTranscriber_${url}`, buffer);

                        this.worker.postMessage({
                            type: "fetch_response",
                            id,
                            response: buffer,
                            headers: {
                                "Content-Length": res.headers.get("Content-Length") || buffer.byteLength.toString(),
                                "Content-Type": this.getMimeType(url)
                            }
                        });
                    }
                } catch (err) {
                    this.worker.postMessage({
                        type: "fetch_response",
                        id,
                        error: String(err)
                    });
                }
                break;
            case "status":
                this.onStatus(status);
                break;
            case "complete":
                this.onComplete(output);
                break;
            case "partial":
                this.onPartial(output);
                break;
            case "error":
                this.onError(error);
                break;
        }
    }

    public run(audio: Float32Array, model: string, quantized: boolean = true, language?: string, task?: string) {
        this.worker.postMessage({
            type: "run",
            audio,
            model,
            quantized,
            language,
            task
        });
    }

    public terminate() {
        this.worker.terminate();
    }
}
