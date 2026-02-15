/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Menu } from "@webpack/common";

const { convertNameToSurrogate } = findByPropsLazy("convertNameToSurrogate");

interface Emoji {
    type: string;
    id: string;
    name: string;
}

interface Target {
    dataset: Emoji;
    firstChild: HTMLImageElement;
}

function getEmojiMarkdown(target: Target, copyUnicode: boolean): string {
    const { id: emojiId, name: emojiName } = target.dataset;

    if (!emojiId) {
        return copyUnicode
            ? convertNameToSurrogate(emojiName)
            : `:${emojiName}:`;
    }

    const url = new URL(target.firstChild.src);
    const hasParam = url.searchParams.get("animated") === "true";
    const isGif = url.pathname.endsWith(".gif");

    return `<${(hasParam || isGif) ? "a" : ""}:${emojiName.replace(/~\d+$/, "")}:${emojiId}>`;
}

const settings = definePluginSettings({
    copyUnicode: {
        type: OptionType.BOOLEAN,
        description: t("copyEmojiMarkdown.copyUnicodeDescription"),
        default: true,
    },
});

export default definePlugin({
    name: "CopyEmojiMarkdown",
    description: t("copyEmojiMarkdown.description"),
    authors: [Devs.HappyEnderman, Devs.Vishnya],
    settings,

    contextMenus: {
        "expression-picker"(children, { target }: { target: Target; }) {
            if (target.dataset.type !== "emoji") return;

            children.push(
                <Menu.MenuItem
                    id="vc-copy-emoji-markdown"
                    label={t("copyEmojiMarkdown.copyEmojiMarkdown")}
                    action={() => {
                        copyWithToast(
                            getEmojiMarkdown(target, settings.store.copyUnicode),
                            t("copyEmojiMarkdown.success")
                        );
                    }}
                />
            );
        },
    },
});
