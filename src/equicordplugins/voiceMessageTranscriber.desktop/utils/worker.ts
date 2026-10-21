/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { cacheFile, getCachedFile } from "./cache";

const workerCode = `
import { pipeline, env, Tensor, WhisperTextStreamer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js';

const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;

env.allowLocalModels = false;
env.useBrowserCache = false;
env.useWasmCache = false;

const pendingRequests = new Map();
const cancelledRuns = new Set();
let queue = Promise.resolve();

self.addEventListener('message', (event) => {
    const { type, id, response, status, error, headers } = event.data;

    if (type === 'fetch_response') {
        const resolver = pendingRequests.get(id);
        if (resolver) {
            pendingRequests.delete(id);
            if (error) {
                resolver.reject(new Error(error));
            } else {
                resolver.resolve(new Response(response ?? null, {
                    status: status ?? 200,
                    headers: headers || { 'Content-Type': 'application/octet-stream' }
                }));
            }
        }
    } else if (type === 'run') {
        queue = queue.then(() => runTranscription(event.data));
    } else if (type === 'cancel') {
        cancelledRuns.add(event.data.runId);
    }
});

const originalFetch = globalThis.fetch.bind(globalThis);
function proxyFetch(input, init) {
    const url = input instanceof Request ? input.url : input.toString();
    if (!url.startsWith('https://huggingface.co/') && !url.startsWith('https://cdn.jsdelivr.net/')) {
        return originalFetch(input, init);
    }
    const id = Math.random().toString(36).substring(7);
    return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        self.postMessage({ type: 'fetch_request', url, id });
    });
}
env.fetch = proxyFetch;
globalThis.fetch = proxyFetch;

async function supportsWebGpu() {
    try {
        const adapter = await navigator.gpu?.requestAdapter();
        return !!adapter?.features.has('shader-f16');
    } catch {
        return false;
    }
}

async function loadTranscriber(model, quantized, useGpu) {
    if (useGpu && await supportsWebGpu()) {
        try {
            return await pipeline('automatic-speech-recognition', model, { device: 'webgpu', dtype: 'fp16' });
        } catch (e) {
            console.warn('[VoiceMessageTranscriber] WebGPU failed, falling back to CPU', e);
        }
    }
    return pipeline('automatic-speech-recognition', model, { device: 'wasm', dtype: quantized ? 'q8' : 'fp32' });
}

async function compressionRatio(text) {
    const bytes = new TextEncoder().encode(text);
    if (!bytes.length) return 0;
    const compressed = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return bytes.length / compressed.byteLength;
}

let transcriber = null;
let loadedKey = null;

class Cancelled extends Error {}

// transformers.js has no language detection and falls back to english, which translates everything else
async function detectLanguage(audio) {
    const { input_features } = await transcriber.processor(audio.subarray(0, 16000 * CHUNK_LENGTH_S));
    const { decoder_start_token_id, lang_to_id } = transcriber.model.generation_config;
    const decoder_input_ids = new Tensor('int64', [BigInt(decoder_start_token_id)], [1, 1]);
    let { logits } = await transcriber.model({ input_features, decoder_input_ids });
    if (logits.type !== 'float32') logits = logits.to('float32');

    let best = null;
    let bestScore = -Infinity;
    for (const [token, id] of Object.entries(lang_to_id)) {
        if (logits.data[id] > bestScore) {
            bestScore = logits.data[id];
            best = token.slice(2, -2);
        }
    }
    return best;
}

async function runTranscription({ runId, audio, model, quantized, useGpu, language, task }) {
    const post = msg => self.postMessage({ ...msg, runId });
    const checkCancelled = () => {
        if (cancelledRuns.has(runId)) throw new Cancelled();
    };

    try {
        checkCancelled();

        // keep the model loaded between runs, only reload when the settings change
        const key = [model, quantized, useGpu].join();
        if (loadedKey !== key) {
            post({ type: 'status', status: 'loading' });
            const previous = transcriber;
            transcriber = null;
            loadedKey = null;
            await previous?.dispose();
            transcriber = await loadTranscriber(model, quantized, useGpu);
            loadedKey = key;
        }

        checkCancelled();
        post({ type: 'status', status: 'transcribing' });

        language ??= await detectLanguage(audio);
        checkCancelled();

        const time_precision =
            transcriber.processor.feature_extractor.config.chunk_length /
            transcriber.model.config.max_source_positions;
        const windowStep = CHUNK_LENGTH_S - 2 * STRIDE_LENGTH_S;

        async function transcribe(extraOptions) {
            let text = '';
            const chunks = [];
            let windowIndex = 0;

            const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
                time_precision,
                skip_prompt: true,
                on_chunk_start: time => {
                    chunks.push({ timestamp: [windowIndex * windowStep + time, null], text: '' });
                },
                callback_function: piece => {
                    checkCancelled();
                    text += piece;
                    if (chunks.length) chunks[chunks.length - 1].text += piece;
                    post({ type: 'partial', output: { text, chunks } });
                },
                on_chunk_end: time => {
                    if (chunks.length) chunks[chunks.length - 1].timestamp[1] = windowIndex * windowStep + time;
                },
                on_finalize: () => {
                    windowIndex++;
                }
            });

            return transcriber(audio, {
                do_sample: false,
                chunk_length_s: CHUNK_LENGTH_S,
                stride_length_s: STRIDE_LENGTH_S,
                return_timestamps: true,
                streamer,
                language,
                task: task === "translate" ? "translate" : undefined,
                ...extraOptions
            });
        }

        let output = await transcribe();

        if (await compressionRatio(output.text) > 2.4) {
            output = await transcribe({ no_repeat_ngram_size: 4 });
        }

        post({ type: 'complete', output });

    } catch (e) {
        if (!(e instanceof Cancelled)) post({ type: 'error', error: e.toString() });
    } finally {
        cancelledRuns.delete(runId);
    }
}
`;

export interface TranscriptionChunk {
    timestamp: [number, number];
    text: string;
}

export interface TranscriptionResult {
    text: string;
    chunks: TranscriptionChunk[];
}

export interface TranscriptionOptions {
    model: string;
    quantized: boolean;
    useGpu: boolean;
    language?: string;
    task?: string;
}

interface TranscriptionCallbacks {
    onStatus: (status: string) => void;
    onComplete: (output: TranscriptionResult) => void;
    onError: (error: unknown) => void;
    onPartial: (output: TranscriptionResult) => void;
}

let worker: Worker | null = null;
let nextRunId = 0;
const runs = new Map<number, TranscriptionCallbacks>();

function getMimeType(url: string): string {
    if (url.endsWith(".wasm")) return "application/wasm";
    if (url.endsWith(".json")) return "application/json";
    return "application/octet-stream";
}

async function handleFetchRequest(target: Worker, id: string, url: string) {
    try {
        let data = await getCachedFile(url);
        if (!(data instanceof ArrayBuffer)) {
            const res = await fetch(url);
            if (!res.ok) {
                target.postMessage({ type: "fetch_response", id, status: res.status });
                return;
            }

            data = await res.arrayBuffer();
            await cacheFile(url, data);
        }

        target.postMessage({
            type: "fetch_response",
            id,
            response: data,
            headers: {
                "Content-Length": data.byteLength.toString(),
                "Content-Type": getMimeType(url)
            }
        }, [data]);
    } catch (err) {
        target.postMessage({
            type: "fetch_response",
            id,
            error: String(err)
        });
    }
}

function handleMessage(target: Worker, event: MessageEvent) {
    const { type, id, url, runId, status, output, error } = event.data;

    if (type === "fetch_request") {
        handleFetchRequest(target, id, url);
        return;
    }

    const run = runs.get(runId);
    if (!run) return;

    switch (type) {
        case "status":
            run.onStatus(status);
            break;
        case "partial":
            run.onPartial(output);
            break;
        case "complete":
            runs.delete(runId);
            run.onComplete(output);
            break;
        case "error":
            runs.delete(runId);
            run.onError(error);
            break;
    }
}

function getWorker() {
    if (worker) return worker;

    const blob = new Blob([workerCode], { type: "text/javascript" });
    const objectUrl = URL.createObjectURL(blob);
    const created = new Worker(objectUrl, { type: "module" });
    URL.revokeObjectURL(objectUrl);

    created.onmessage = event => handleMessage(created, event);
    created.onerror = event => {
        event.preventDefault();
        terminateWorker(event.message || "Transcription worker crashed");
    };

    return worker = created;
}

export function terminateWorker(reason = "Transcription worker was stopped") {
    worker?.terminate();
    worker = null;

    const pending = [...runs.values()];
    runs.clear();
    for (const run of pending) run.onError(reason);
}

export class TranscriptionJob {
    private runId: number | null = null;

    constructor(private callbacks: TranscriptionCallbacks) { }

    public run(audio: Float32Array, options: TranscriptionOptions) {
        this.cancel();
        const runId = this.runId = nextRunId++;
        runs.set(runId, this.callbacks);
        getWorker().postMessage({ type: "run", runId, audio, ...options });
    }

    public cancel() {
        if (this.runId === null) return;
        if (runs.delete(this.runId)) worker?.postMessage({ type: "cancel", runId: this.runId });
        this.runId = null;
    }
}
