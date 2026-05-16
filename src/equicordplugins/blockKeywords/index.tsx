/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Card } from "@components/Card";
import { HeadingTertiary } from "@components/Heading";
import { Margins } from "@components/margins";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { React, TextInput } from "@webpack/common";

let blockedKeywords: Array<RegExp>;
const cardStyle = { padding: "0.4em 0.75em", display: "flex", alignItems: "center", justifyContent: "space-between" };

function RegexHelper() {
    const [testInput, setTestInput] = React.useState("");

    const results = React.useMemo(() => {
        const caseSensitiveFlag = settings.store.caseSensitive ? "" : "i";
        return settings.store.blockedWords
            .split(",")
            .map(w => w.trim())
            .filter(Boolean)
            .map(pattern => {
                try {
                    return { pattern, matches: new RegExp(pattern, caseSensitiveFlag).test(testInput) };
                } catch (e: any) {
                    return { pattern, matches: false, error: e.message as string };
                }
            });
    }, [testInput, settings.store.blockedWords, settings.store.caseSensitive]);

    return (
        <Card style={{ padding: "0.75em" }}>
            <HeadingTertiary className={Margins.bottom8}>Regex Helper</HeadingTertiary>
            <TextInput
                type="text"
                placeholder="Input to test..."
                value={testInput}
                onChange={setTestInput}
                maxLength={null}
            />
            {results.length === 0 ?
                <Card
                    key="vc-no-patterns-rgex"
                    variant="warning"
                    className={Margins.top8}
                    style={cardStyle}
                >
                    <code>No patterns configured</code>
                </Card> : (
                    results.map(({ pattern, matches, error }, i) => (
                        <Card
                            key={`vc-pattern-card-${i}`}
                            variant={error ? "danger" : matches ? "success" : "primary"}
                            className={Margins.top8}
                            style={cardStyle}
                        >
                            <code>{pattern}</code>
                            {error && <span style={{ fontSize: "12px", marginLeft: "1em", flexShrink: 0 }}>{error}</span>}
                        </Card>
                    )))}
        </Card>
    );
}

const settings = definePluginSettings({
    blockedWords: {
        type: OptionType.STRING,
        description: "Comma-seperated list of words to block",
        default: "",
        restartNeeded: true
    },
    useRegex: {
        type: OptionType.BOOLEAN,
        description: "Use each value as a regular expression when checking message content (advanced)",
        default: false,
        restartNeeded: true
    },
    regexHelper: {
        type: OptionType.COMPONENT,
        description: "Test your regular expressions against a sample input",
        component: () => <RegexHelper />,
    },
    caseSensitive: {
        type: OptionType.BOOLEAN,
        description: "Whether to use a case sensitive search or not",
        default: false,
        restartNeeded: true
    },
    ignoreBlockedMessages: {
        description: "Completely ignores (recent) new messages bar",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
    },
}, {
    regexHelper: {
        hidden() { return !this.store.useRegex; }
    }
});

export function containsBlockedKeywords(message: Message) {
    if (!blockedKeywords) return false;

    // can't use forEach because we need to return from inside the loop
    // message content loop
    for (let wordIndex = 0; wordIndex < blockedKeywords.length; wordIndex++) {
        if (blockedKeywords[wordIndex].test(message.content)) {
            return true;
        }
    }

    // embed content loop (e.g. twitter embeds)
    for (let embedIndex = 0; embedIndex < message.embeds.length; embedIndex++) {
        const embed = message.embeds[embedIndex];
        for (let wordIndex = 0; wordIndex < blockedKeywords.length; wordIndex++) {
            // doing this because undefined strings get converted to the string "undefined" in regex tests
            // @ts-ignore
            const descriptionHasKeywords = embed.rawDescription != null && blockedKeywords[wordIndex].test(embed.rawDescription);
            // @ts-ignore
            const titleHasKeywords = embed.rawTitle != null && blockedKeywords[wordIndex].test(embed.rawTitle);
            if (descriptionHasKeywords || titleHasKeywords) {
                return true;
            }
        }
    }

    return false;
}

export default definePlugin({
    name: "BlockKeywords",
    description: "Blocks messages containing specific user-defined keywords, as if the user sending them was blocked.",
    tags: ["Appearance", "Customisation", "Privacy"],
    authors: [EquicordDevs.catcraft, EquicordDevs.secp192k1],
    patches: [
        {
            find: "_channelMessages={}",
            predicate: () => settings.store.blockedWords !== "",
            replacement: {
                match: /static commit\((\i)\)\{/g,
                replace: "$&$1=$self.blockMessagesWithKeywords($1);"
            }
        },
        {
            find: '"MessageStore"',
            predicate: () => settings.store.ignoreBlockedMessages && settings.store.blockedWords !== "",
            replacement: [
                {
                    match: /(?<=MESSAGE_CREATE:function\((\i)\){)/,
                    replace: (_, props) => `if($self.containsBlockedKeywords(${props}.message))return;`
                }
            ]
        },
        {
            find: '"ReadStateStore"',
            predicate: () => settings.store.ignoreBlockedMessages && settings.store.blockedWords !== "",
            replacement: [
                {
                    match: /(?<=MESSAGE_CREATE:function\((\i)\){)/,
                    replace: (_, props) => `if($self.containsBlockedKeywords(${props}.message))return;`
                }
            ]
        },
    ],

    settings,
    containsBlockedKeywords,

    start() {
        const blockedWordsList: Array<string> = settings.store.blockedWords.split(",");
        const caseSensitiveFlag = settings.store.caseSensitive ? "" : "i";

        if (!blockedWordsList) return;

        if (settings.store.useRegex) {
            blockedKeywords = blockedWordsList.map(word => {
                return new RegExp(word, caseSensitiveFlag);
            });
        } else {
            blockedKeywords = blockedWordsList.map(word => {
                // escape regex chars in word https://stackoverflow.com/a/6969486
                return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, caseSensitiveFlag);
            });
        }
    },

    blockMessagesWithKeywords(messageList: any) {
        return messageList.reset(messageList.map(
            message => message.set("blocked", message.blocked || this.containsBlockedKeywords(message))
        ));
    }
});
