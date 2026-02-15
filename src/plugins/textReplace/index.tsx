/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { HeadingTertiary } from "@components/Heading";
import { DeleteIcon } from "@components/Icons";
import { Devs, EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Button, React, Select, TextInput, UserStore, useState } from "@webpack/common";

type Rule = Record<"find" | "replace" | "onlyIfIncludes" | "scope", string>;

interface TextReplaceProps {
    title: string;
    rulesArray: Rule[];
}

const makeEmptyRule: () => Rule = () => ({
    find: "",
    replace: "",
    onlyIfIncludes: "",
    scope: "myMessages"
});
const makeEmptyRuleArray = () => [makeEmptyRule()];

const settings = definePluginSettings({
    replace: {
        type: OptionType.COMPONENT,
        component: () => {
            const { stringRules, regexRules } = settings.use(["stringRules", "regexRules"]);

            return (
                <>
                    <TextReplace
                        title={t("textReplace.usingString")}
                        rulesArray={stringRules}
                    />
                    <TextReplace
                        title={t("textReplace.usingRegex")}
                        rulesArray={regexRules}
                    />
                    <TextReplaceTesting />
                </>
            );
        }
    },
    stringRules: {
        type: OptionType.CUSTOM,
        default: makeEmptyRuleArray(),
        description: "Rules for replacing text using string matching."
    },
    regexRules: {
        type: OptionType.CUSTOM,
        default: makeEmptyRuleArray(),
        description: "Rules for replacing text using regular expressions."
    }
});

function stringToRegex(str: string) {
    const match = str.match(/^(\/)?(.+?)(?:\/([gimsuyv]*))?$/); // Regex to match regex
    return match
        ? new RegExp(
            match[2], // Pattern
            match[3]
                ?.split("") // Remove duplicate flags
                .filter((char, pos, flagArr) => flagArr.indexOf(char) === pos)
                .join("")
            ?? "g"
        )
        : new RegExp(str); // Not a regex, return string
}

function renderFindError(find: string) {
    try {
        stringToRegex(find);
        return null;
    } catch (e) {
        return (
            <span style={{ color: "var(--text-feedback-critical)" }}>
                {String(e)}
            </span>
        );
    }
}

function Input({ initialValue, onChange, placeholder }: {
    placeholder: string;
    initialValue: string;
    onChange(value: string): void;
}) {
    const [value, setValue] = useState(initialValue);
    return (
        <TextInput
            placeholder={placeholder}
            value={value}
            onChange={setValue}
            spellCheck={false}
            onBlur={() => value !== initialValue && onChange(value)}
        />
    );
}

function TextReplace({ title, rulesArray }: TextReplaceProps) {
    const isRegexRules = title === t("textReplace.usingRegex");

    async function onClickRemove(index: number) {
        if (index === rulesArray.length - 1) return;
        rulesArray.splice(index, 1);
    }

    async function onChange(e: string, index: number, key: string) {
        if (index === rulesArray.length - 1) {
            rulesArray.push(makeEmptyRule());
        }

        rulesArray[index][key] = e;

        if (rulesArray[index].find === "" && rulesArray[index].replace === "" && rulesArray[index].onlyIfIncludes === "" && index !== rulesArray.length - 1) {
            rulesArray.splice(index, 1);
        }
    }

    const scopeOptions = [
        { label: t("textReplace.scope.myMessages"), value: "myMessages" },
        { label: t("textReplace.scope.othersMessages"), value: "othersMessages" },
        { label: t("textReplace.scope.allMessages"), value: "allMessages" }
    ];

    return (
        <>
            <HeadingTertiary>{title}</HeadingTertiary>
            <Flex flexDirection="column" style={{ gap: "0.5em", paddingBottom: "1.25em" }}>
                {
                    rulesArray.map((rule, index) =>
                        <React.Fragment key={`${rule.find}-${index}`}>
                            <Flex gap="0.5em" flexDirection="row" style={{ flexGrow: 1 }}>
                                <Input
                                    placeholder={t("textReplace.find")}
                                    initialValue={rule.find}
                                    onChange={e => onChange(e, index, "find")}
                                />
                                <Input
                                    placeholder={t("textReplace.replace")}
                                    initialValue={rule.replace}
                                    onChange={e => onChange(e, index, "replace")}
                                />
                                <Input
                                    placeholder={t("textReplace.onlyIfIncludes")}
                                    initialValue={rule.onlyIfIncludes}
                                    onChange={e => onChange(e, index, "onlyIfIncludes")}
                                />
                            </Flex>
                            {(index !== rulesArray.length - 1) && <Flex flexDirection="row" style={{ gap: "0.5em" }}>
                                <div style={{ flex: 0.9 }}>
                                    <Select
                                        options={scopeOptions}
                                        isSelected={e => e === rule.scope}
                                        select={e => onChange(e, index, "scope")}
                                        serialize={e => e}
                                    />
                                </div>
                                <Button
                                    size={Button.Sizes.MIN}
                                    onClick={() => onClickRemove(index)}
                                    style={{ flex: 0.10, backgroundColor: "var(--input-background)", border: "1px solid var(--input-border)", color: "var(--status-danger)" }}
                                >
                                    <DeleteIcon style={{ verticalAlign: "middle" }} />
                                </Button>
                            </Flex>}
                            {(index !== rulesArray.length - 1) && <Divider style={{ width: "unset", margin: "0.5em 0" }}></Divider>}
                            {isRegexRules && renderFindError(rule.find)}
                        </React.Fragment>
                    )
                }
            </Flex>
        </>
    );
}

function TextReplaceTesting() {
    const [value, setValue] = useState("");
    return (
        <>
            <HeadingTertiary>{t("textReplace.testRules")}</HeadingTertiary>
            <TextInput placeholder={t("textReplace.typeMessage")} onChange={setValue} />
            <TextInput placeholder={t("textReplace.messageWithRules")} editable={false} value={applyRules(value, "allMessages")} />
        </>
    );
}

function applyRules(content: string, scope: "myMessages" | "othersMessages" | "allMessages"): string {
    if (content.length === 0) {
        return content;
    }

    for (const rule of settings.store.stringRules) {
        if (!rule.find) continue;
        if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes)) continue;
        if (rule.scope !== "allMessages" && rule.scope !== scope && scope !== "allMessages") continue;

        content = ` ${content} `.replaceAll(rule.find, rule.replace.replaceAll("\\n", "\n")).replace(/^\s|\s$/g, "");
    }

    for (const rule of settings.store.regexRules) {
        if (!rule.find) continue;
        if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes)) continue;
        if (rule.scope !== "allMessages" && rule.scope !== scope && scope !== "allMessages") continue;

        try {
            const regex = stringToRegex(rule.find);
            content = content.replace(regex, rule.replace.replaceAll("\\n", "\n"));
        } catch (e) {
            new Logger("TextReplace").error(`Invalid regex: ${rule.find}`);
        }
    }

    content = content.trim();
    return content;
}

function modifyIncomingMessage(message: Message) {
    const currentUser = UserStore.getCurrentUser();
    const messageAuthor = message.author;

    if (!message.content || !currentUser?.id || !messageAuthor?.id || messageAuthor.id === currentUser.id) {
        return message.content;
    }

    return applyRules(message.content, "othersMessages");
}

const TEXT_REPLACE_RULES_EXEMPT_CHANNEL_IDS = [
    "1102784112584040479", // Vencord's Text Replace Rules Channel
    "1419347113745059961", // Equicord's Requests Channel
];

export default definePlugin({
    name: "TextReplace",
    description: "Replace text in your or others' messages. You can find pre-made rules in the #textreplace-rules channel in Vencord's Server.",
    authors: [Devs.AutumnVN, Devs.TheKodeToad, EquicordDevs.Etorix],
    isModified: true,

    settings,
    modifyIncomingMessage,

    patches: [
        {
            find: "!1,hideSimpleEmbedContent",
            replacement: {
                match: /(let{toAST:.{0,125}?)\(null!=\i\?\i:\i\).content/,
                replace: "const textReplaceContent=$self.modifyIncomingMessage(arguments[2]?.contentMessage??arguments[1]);$1textReplaceContent"
            }
        },
    ],

    start() {
        const { stringRules, regexRules } = settings.store;
        stringRules.forEach(rule => { if (!rule.scope) rule.scope = "myMessages"; });
        regexRules.forEach(rule => { if (!rule.scope) rule.scope = "myMessages"; });
    },

    onBeforeMessageSend(channelId, msg) {
        // Replacing text in channels used for sharing/requesting rules may be messy.
        if (TEXT_REPLACE_RULES_EXEMPT_CHANNEL_IDS.includes(channelId)) return;
        msg.content = applyRules(msg.content, "myMessages");
    }
});
