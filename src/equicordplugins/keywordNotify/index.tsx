/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated, camila314, and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { DoubleCheckmarkIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Message, ScrollerBaseRef } from "@vencord/discord-types";
import { findByCodeLazy, findCssClassesLazy } from "@webpack";
import {
    ChannelStore,
    FluxDispatcher,
    ScrollerThin,
    TabBar,
    Tooltip,
    useRef,
    UserStore,
    useState
} from "@webpack/common";
import type { JSX, RefObject } from "react";

import { KeywordEntries } from "./components/KeywordEntries";

interface KeywordEntry {
    regex: string;
    listIds?: string[];
    listType?: ListType;
    ignoreCase: boolean;
    ignoreBots?: boolean;
    whitelist: string[];
    blacklist: string[];
    listPriority: ListType;
}

export let keywordEntries: Array<KeywordEntry> = [];
let keywordLog: Array<Message> = [];
let interceptor: (e: any) => void;

interface ScrollerContext {
    id: string;
    onKeyDown: () => void;
    orientation: string;
    ref: RefObject<unknown>;
    tabIndex: number;
}

interface ScrollerOpts {
    role: string;
    tabIndex: ScrollerContext["tabIndex"];
    "data-list-id": ScrollerContext["id"];
    onKeyDown: ScrollerContext["onKeyDown"];
    ref: ScrollerContext["ref"];
    "aria-orientation": ScrollerContext["orientation"];
}

const scrollerClass = findCssClassesLazy("singleMessage", "scroller");
const tabClass = findCssClassesLazy("inboxTitle", "tab");

const PopoutContainer = findByCodeLazy("navigator", "Provider");
const getMessageScrollerOptions: () => ScrollerOpts = findByCodeLazy("onKeyDown", "tabIndex", "useContext", "aria-orientation");
const createNavigator = findByCodeLazy("keyboardModeEnabled)", "scrollIntoViewNode");
const createMessageRecord = findByCodeLazy(".createFromServer(", ".isBlockedForMessage", "messageReference:");
export const KEYWORD_ENTRIES_KEY = "KeywordNotify_keywordEntries";
const KEYWORD_LOG_KEY = "KeywordNotify_log";

export const cl = classNameFactory("vc-keywordnotify-");

export async function addKeywordEntry(forceUpdate: () => void) {
    keywordEntries.push({
        regex: "",
        ignoreCase: false,
        ignoreBots: true,
        whitelist: [],
        blacklist: [],
        listPriority: ListType.BlackList,
    });
    await DataStore.set(KEYWORD_ENTRIES_KEY, keywordEntries);
    forceUpdate();
}

export async function removeKeywordEntry(idx: number, forceUpdate: () => void) {
    keywordEntries.splice(idx, 1);
    await DataStore.set(KEYWORD_ENTRIES_KEY, keywordEntries);
    forceUpdate();
}

function safeMatchesRegex(str: string, regex: string, flags: string) {
    try {
        return str.match(new RegExp(regex, flags));
    } catch {
        return false;
    }
}

export enum ListType {
    BlackList = "BlackList",
    Whitelist = "Whitelist"
}

function highlightKeywords(str: string, entries: Array<KeywordEntry>) {
    let regexes: Array<RegExp>;
    try {
        regexes = entries.map(e => new RegExp(e.regex, "g" + (e.ignoreCase ? "i" : "")));
    } catch (err) {
        return [str];
    }

    const matches = regexes.map(r => str.match(r)).flat().filter(e => e != null) as Array<string>;
    if (matches.length === 0) {
        return [str];
    }

    const idx = str.indexOf(matches[0]);

    return (
        <>
            <span>{str.substring(0, idx)}</span>
            <span className="highlight">{matches[0]}</span>
            <span>{str.substring(idx + matches[0].length)}</span>
        </>
    );
}

const settings = definePluginSettings({
    ignoreBots: {
        type: OptionType.BOOLEAN,
        description: "Ignore messages from bots",
        default: true,
        hidden: true,
    },
    amountToKeep: {
        type: OptionType.NUMBER,
        description: "Amount of messages to keep in the log",
        default: 50
    },
    keywords: {
        type: OptionType.COMPONENT,
        description: "Manage keywords",
        component: () => <KeywordEntries />
    }
});

export default definePlugin({
    name: "KeywordNotify",
    authors: [EquicordDevs.camila314, EquicordDevs.x3rt, EquicordDevs.benjas333],
    description: "Sends a notification if a given message matches certain keywords or regexes",
    settings,
    patches: [
        {
            find: "#{intl::MENTIONS})",
            group: true,
            replacement: [
                {
                    match: /#{intl::Fn6Odn::raw}\)\}\)\}\):null/,
                    replace: "$&,$self.keywordTabBar()"
                },
                {
                    match: /:(\i)===\i\.\i\.MENTIONS\?\(0,.{0,500}null}/,
                    replace: ": $1 === 8 ? $self.keywordClearButton() $&",
                },
                {
                    match: /:(\i)===\i\.\i\.MENTIONS\?\(0,.{0,500}onJump:(\i)}\)/,
                    replace: ": $1 === 8 ? $self.tryKeywordMenu($2) $&",
                },
                {
                    match: /function (\i)\(\i\){let{message:\i,onJump/,
                    replace: "$self.RenderMsg = $1; $&",
                },
                {
                    match: /onClick:\(\)=>(\i\.\i\.deleteRecentMention\((\i)\.id\))/,
                    replace: "onClick: () => $2._keyword ? $self.deleteKeyword($2.id) : $1",
                },
            ]
        },
    ],

    async start() {
        this.onUpdate = () => null;

        keywordEntries = await DataStore.get(KEYWORD_ENTRIES_KEY) ?? [];
        keywordEntries.forEach(entry => {
            entry.ignoreBots = entry.ignoreBots ?? this.settings.store.ignoreBots;

            entry.whitelist = entry.whitelist ?? [];
            entry.blacklist = entry.blacklist ?? [];
            entry.listPriority = entry.listPriority ?? ListType.BlackList;

            if (entry.listType == null || entry.listIds == null) return;

            if (entry.listType === ListType.Whitelist) {
                entry.whitelist = entry.listIds;
            } else {
                entry.blacklist = entry.listIds;
            }
            delete entry.listIds;
            delete entry.listType;
        });
        await DataStore.set(KEYWORD_ENTRIES_KEY, keywordEntries);

        (await DataStore.get(KEYWORD_LOG_KEY) ?? []).map(e => JSON.parse(e)).forEach(e => {
            try {
                this.addToLog(e);
            } catch (err) {
                console.error(err);
            }
        });

        interceptor = (e: any) => {
            return this.modify(e);
        };
        FluxDispatcher.addInterceptor(interceptor);
    },
    stop() {
        const index = FluxDispatcher._interceptors.indexOf(interceptor);
        if (index > -1) {
            FluxDispatcher._interceptors.splice(index, 1);
        }
    },

    applyKeywordEntries(m: Message) {
        let matches = false;

        for (const entry of keywordEntries) {
            if (entry.regex === "") {
                continue;
            }

            let isInWhitelist = entry.whitelist.some(id => {
                const trimmed = id.trim();
                return trimmed === m.channel_id || trimmed === m.author.id;
            });
            if (!isInWhitelist) {
                const channel = ChannelStore.getChannel(m.channel_id);
                if (channel != null) {
                    isInWhitelist = entry.whitelist.some(id => id.trim() === channel.guild_id);
                }
            }

            let isInBlacklist = entry.blacklist.some(id => {
                const trimmed = id.trim();
                return trimmed === m.channel_id || trimmed === m.author.id;
            });
            if (!isInBlacklist) {
                const channel = ChannelStore.getChannel(m.channel_id);
                if (channel != null) {
                    isInBlacklist = entry.whitelist.some(id => id.trim() === channel.guild_id);
                }
            }

            const isWhitelistPrioritized = entry.listPriority === ListType.Whitelist;

            if (isInWhitelist && isInBlacklist) {
                if (!isWhitelistPrioritized) {
                    continue;
                }
            } else {
                if (entry.whitelist.length && !isInWhitelist) {
                    continue;
                }

                if (isInBlacklist) {
                    continue;
                }
            }

            if (m.author.bot && entry.ignoreBots && (!entry.whitelist.length || !entry.whitelist.includes(m.author.id))) {
                continue;
            }

            const flags = entry.ignoreCase ? "i" : "";
            if (safeMatchesRegex(m.content, entry.regex, flags)) {
                matches = true;
            } else {
                for (const embed of m.embeds as any) {
                    if (safeMatchesRegex(embed.description, entry.regex, flags) || safeMatchesRegex(embed.title, entry.regex, flags)) {
                        matches = true;
                        break;
                    } else if (embed.fields != null) {
                        for (const field of embed.fields as Array<{ name: string, value: string; }>) {
                            if (safeMatchesRegex(field.value, entry.regex, flags) || safeMatchesRegex(field.name, entry.regex, flags)) {
                                matches = true;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (matches) {
            const id = UserStore.getCurrentUser()?.id;
            if (id != null) {
                // @ts-ignore
                m.mentions.push({ id: id });
            }

            if (m.author.id !== id) {
                this.storeMessage(m);
                this.addToLog(m);
            }
        }
    },
    storeMessage(m: Message) {
        if (m == null)
            return;

        DataStore.get(KEYWORD_LOG_KEY).then(log => {
            log = log ? log.map((e: string) => JSON.parse(e)) : [];

            log.push(m);
            if (log.length > settings.store.amountToKeep) {
                log = log.slice(-settings.store.amountToKeep);
            }

            DataStore.set(KEYWORD_LOG_KEY, log.map(e => JSON.stringify(e)));
        });
    },
    discardMessage(id: string) {
        DataStore.get(KEYWORD_LOG_KEY).then((log: string[]) => {
            let parsed_logs: Message[] = log ? log.map(e => JSON.parse(e)) : [];

            parsed_logs = parsed_logs.filter(msg => msg.id !== id);

            DataStore.set(KEYWORD_LOG_KEY, parsed_logs.map(e => JSON.stringify(e)));
        });
    },
    addToLog(m: Message) {
        if (m == null || keywordLog.some(e => e.id === m.id))
            return;

        let messageRecord: any;
        try {
            messageRecord = createMessageRecord(m);
        } catch (err) {
            console.error(err);
            return;
        }

        keywordLog.push(messageRecord);
        keywordLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        while (keywordLog.length > settings.store.amountToKeep) {
            keywordLog.pop();
        }

        this.onUpdate();
    },

    deleteKeyword(id) {
        keywordLog = keywordLog.filter(e => e.id !== id);
        this.onUpdate();
    },

    keywordTabBar() {
        return (
            <TabBar.Item className={classes(tabClass.tab)} id={8}>
                Keywords
            </TabBar.Item>
        );
    },

    keywordClearButton() {
        return (
            <Tooltip text="Clear All">
                {({ onMouseLeave, onMouseEnter }) => (
                    <Button
                        variant="secondary"
                        size="iconOnly"
                        onMouseLeave={onMouseLeave}
                        onMouseEnter={onMouseEnter}
                        onClick={() => {
                            keywordLog = [];
                            DataStore.set(KEYWORD_LOG_KEY, []);
                            this.onUpdate();
                        }}>
                        <DoubleCheckmarkIcon width={16} height={16} className={"vc-double-checkmark-icon"} />
                    </Button>
                )}
            </Tooltip>
        );
    },

    tryKeywordMenu(onJump) {
        const [tempLogs, setKeywordLog] = useState(keywordLog);
        const navigatorScrollerRef = useRef<ScrollerBaseRef | null>(null);

        const navigator = createNavigator("keywords", navigatorScrollerRef);

        this.onUpdate = () => {
            const newLog = Array.from(keywordLog);
            setKeywordLog(newLog);
        };

        const RenderMsgWrapper = (message: Message & { _keyword?: boolean; }): JSX.Element => {
            message._keyword = true;

            message.customRenderedContent = {
                content: highlightKeywords(message.content, keywordEntries)
            };

            return this.RenderMsg({
                message,
                onJump,
            });
        };

        const MessageScrollerHelper = ({ children }: { children: (scrollerOpts: ScrollerOpts) => JSX.Element; }) => {
            return children(getMessageScrollerOptions());
        };

        return (
            <ErrorBoundary>
                <PopoutContainer navigator={navigator}>
                    <MessageScrollerHelper>
                        {({ ref, ...restOpts }) => {
                            return <ScrollerThin
                                ref={thinScrollerRef => {
                                    navigatorScrollerRef.current = thinScrollerRef;
                                    // @ts-ignore
                                    ref.current = thinScrollerRef?.getScrollerNode() ?? null;
                                }}
                                className={classes(scrollerClass.scroller)}
                                onScroll={void 0}
                                {...restOpts}
                            >
                                {tempLogs.map(m => <div key={m.id}>{RenderMsgWrapper(m)}</div>)}
                            </ScrollerThin>;
                        }}
                    </MessageScrollerHelper>
                </PopoutContainer>
            </ErrorBoundary>
        );
    },

    modify(e) {
        if (e.type === "MESSAGE_CREATE" || e.type === "MESSAGE_UPDATE") {
            this.applyKeywordEntries(e.message);
        } else if (e.type === "LOAD_MESSAGES_SUCCESS") {
            for (let msg = 0; msg < e.messages.length; ++msg) {
                this.applyKeywordEntries(e.messages[msg]);
            }
        }
    }
});
