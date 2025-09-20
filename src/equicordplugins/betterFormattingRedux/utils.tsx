/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { char } from ".";
import { fullwidthList, leetList, replaceList, smallCapsList, superscriptList, thiccList } from "./list";

export const wrapOrUnwrap = (tag: string, text: string) =>
    text.startsWith(tag) && text.endsWith(tag)
        ? text.slice(tag.length, -tag.length)
        : `${tag}${text}${tag}`;

export const mapLines = (prefix: string, text: string) =>
    text
        .split("\n")
        .map(line => line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`)
        .join("\n");

export const mapChars = (list: string, text: string) =>
    text
        .split("")
        .map(char => list[replaceList.indexOf(char)] || char)
        .join("");

export function onClick(tag) {
    const currentText = char;
    if (!currentText) "";
    let formattedText = "";

    switch (tag) {
        case "**":
        case "*":
        case "~~":
        case "_":
        case "`":
        case "||":
            formattedText = wrapOrUnwrap(tag, currentText);
            break;
        case "```":
            formattedText =
                currentText.startsWith("```") && currentText.endsWith("```")
                    ? currentText.slice(3, -3).trim()
                    : `\`\`\`\n${currentText}\n\`\`\``;
            break;
        case ">":
            formattedText = mapLines("> ", currentText);
            break;
        case "-":
            formattedText = mapLines("- ", currentText);
            break;
        case "ˢᵘᵖᵉʳˢᶜʳᶦᵖᵗ":
            formattedText = mapChars(superscriptList, currentText);
            break;
        case "SᴍᴀʟʟCᴀᴘs":
            formattedText = mapChars(smallCapsList, currentText);
            break;
        case "Ｆｕｌｌｗｉｄｔｈ":
            formattedText = mapChars(fullwidthList, currentText);
            break;
        case "uʍopǝpᴉsd∩":
            const upsideDownList = " ¡\"#$%℘,)(*+'-˙/0ƖᄅƐㄣϛ9ㄥ86:;>=<¿@∀qƆpƎℲפHIſʞ˥WNOԀQɹS┴∩ΛMXλZ]\\[^‾,ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz}|{";
            formattedText = mapChars(upsideDownList, currentText).split("").reverse().join("");
            break;
        case "VaRiEd CaPs":
            formattedText = currentText
                .split("")
                .map((char, i) => (i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
                .join("");
            break;
        case "1337":
            formattedText = mapChars(leetList, currentText);
            break;
        case "乇乂下尺卂 下卄工匚匚":
            formattedText = mapChars(thiccList, currentText);
            break;
        default:
            formattedText = currentText;
    }

    return formattedText;
}
