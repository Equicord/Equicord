/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const fileSizeLimit = 12e6;

function parseFileSize(size: string) {
    const [value, unit] = size.split(" ");
    const multiplier = {
        B: 1,
        KB: 1024,
        MB: 1024 ** 2,
        GB: 1024 ** 3,
        TB: 1024 ** 4,
    }[unit];
    if (!multiplier) return;
    return parseFloat(value) * multiplier;
}

function getMetadata(audioElement: HTMLElement) {
    const metadataElement = audioElement.querySelector("[class^='metadataContent_']");
    const nameElement = metadataElement?.querySelector("a");
    const sizeElement = audioElement.querySelector("[class^='metadataContent_'] [class^='metadataSize_']");
    const url = nameElement?.getAttribute("href");
    const audioElementLink = audioElement.querySelector("audio");

    if (!sizeElement?.textContent || !nameElement?.textContent || !url || !audioElementLink) return false;

    const name = nameElement.textContent;
    const size = parseFileSize(sizeElement.textContent);

    if (size && size > fileSizeLimit) {
        return false;
    }

    return {
        name,
        size,
        url,
        audio: audioElementLink,
    };
}

async function addListeners(audioElement: HTMLAudioElement, url: string) {
    const madeURL = new URL(url);
    madeURL.searchParams.set("t", Date.now().toString());

    const response = await fetch(madeURL);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const canvas = document.createElement("canvas");
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) return;

    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    audioElement.parentElement?.appendChild(canvas);

    function drawVisualizer() {
        if (!audioElement.paused) {
            requestAnimationFrame(drawVisualizer);
        }

        analyser.getByteTimeDomainData(dataArray);

        if (!canvasContext) return;
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);

        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = "#00ff00";

        canvasContext.beginPath();

        const sliceWidth = (canvas.width * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) {
                canvasContext.moveTo(x, y);
            } else {
                canvasContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasContext.lineTo(canvas.width, canvas.height / 2);
        canvasContext.stroke();
    }

    audioElement.addEventListener("play", () => {
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
        drawVisualizer();
    });

    audioElement.addEventListener("pause", () => {
        audioContext.suspend();
    });

    const visualizerAudioElement = new Audio(blobUrl);
    visualizerAudioElement.addEventListener("play", () => {
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
        drawVisualizer();
    });
}


function scanForAudioElements(element: HTMLElement) {
    element.querySelectorAll("[class^='wrapperAudio_']:not([data-better-audio-processed])").forEach(audioElement => {
        (audioElement as HTMLElement).dataset.betterAudioProcessed = "true";
        const metadata = getMetadata(audioElement as HTMLElement);

        if (!metadata) return;

        console.log(audioElement);
        console.log(metadata);

        addListeners(metadata.audio, metadata.url);
    });
}


function createObserver(targetNode: HTMLElement) {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === "childList") {
                mutation.addedNodes.forEach(addedNode => {
                    if (addedNode instanceof HTMLElement) {
                        scanForAudioElements(addedNode);
                    }
                });
            }
        });
    });
    observer.observe(targetNode, {
        childList: true,
        subtree: true,
    });
}

export default definePlugin({
    name: "BetterAudioPlayer",
    description: "Adds a spectrograph and oscilloscope visualizer to audio attachment players",
    authors: [EquicordDevs.creations],
    start() {
        const waitForContent = () => {
            const targetNode = document.querySelector("[class^='content_']");
            if (targetNode) {
                scanForAudioElements(targetNode as HTMLElement);
                createObserver(targetNode as HTMLElement);
            } else {
                requestAnimationFrame(waitForContent);
            }
        };
        waitForContent();
    },
});
