/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { CopyIcon, InfoIcon } from "@components/Icons";
import { copyWithToast, openUserProfile } from "@utils/discord";
import { LazyComponent } from "@utils/react";
import { RenderModalProps, type User } from "@vencord/discord-types";
import { find, findByCode, findByCodeLazy, findByPropsLazy } from "@webpack";
import { Alerts, ChannelStore, closeAllModals, ContextMenuApi, FluxDispatcher, GuildStore, Menu, Modal, NavigationRouter, openModal, React, TabBar, TextInput, Tooltip, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { DBMessageRecord, deleteMessageIDB, deleteMessagesBulkIDB } from "../db";
import { cl, clearLogs, settings } from "../index";
import { LoggedMessage, LoggedMessageJSON } from "../types";
import { messageJsonToMessageClass } from "../utils";
import { importLogs } from "../utils/settingsUtils";
import { useMessages } from "./hooks";

export interface MessagePreviewProps {
    className: string;
    author: User;
    message: LoggedMessage;
    compact: boolean;
    isGroupStart: boolean;
    hideSimpleEmbedContent: boolean;
    childrenAccessories: any;
}

export interface ChildrenAccProops {
    channelMessageProps: {
        compact: boolean;
        channel: any;
        message: LoggedMessage;
        groupId: string;
        id: string;
        isLastItem: boolean;
        isHighlight: boolean;
        renderContentOnly: boolean;
    };
    hasSpoilerEmbeds: boolean;
    isInteracting: boolean;
    isAutomodBlockedMessage: boolean;
    showClydeAiEmbeds: boolean;
}

const PrivateChannelRecord = findByCodeLazy(".is_message_request_timestamp,");
const MessagePreview = LazyComponent<MessagePreviewProps>(() => find(m => m?.type?.toString().includes("previewLinkTarget:") && !m?.type?.toString().includes("HAS_THREAD")));
const ChildrenAccessories = LazyComponent<ChildrenAccProops>(() => findByCode("channelMessageProps:{message:"));

export enum LogTabs {
    DELETED = "Deleted",
    EDITED = "Edited",
    GHOST_PING = "Ghost Pinged"
}

const localeModule = findByPropsLazy("getLocale");
const isTurkish = () => localeModule?.getLocale()?.startsWith("tr") ?? false;

const TRANSLATIONS = {
    en: {
        filterHelpTitle: "Filter Help",
        filterHelpIntro: "Filters work in key:value format. You can click on the example or the copy button next to it to copy commands.",
        filterHelpSearchDesc: "Plain words that are not filters are searched in message content, attachments, embeds, and edit history.",
        emptyEh: "Empty eh",
        noResultsIn: "No results in {tab}.",
        maybeTry: "Maybe try {nextTab} or {lastTab}",
        prevPage: "Previous Page",
        nextPage: "Next Page",
        pageOf: "Page",
        clearVisible: "Clear Visible Logs",
        clearAll: "Clear All Logs",
        clearLogsTitle: "Clear Logs",
        clearVisibleBody: "Are you sure you want to clear the visible logs?",
        clearAllBody: "Are you sure you want to clear all the logs?",
        clear: "Clear",
        cancel: "Cancel",
        sortOldestFirst: "Sort Oldest First",
        sortNewestFirst: "Sort Newest First",
        filterPlaceholder: "Filter messages...",
        copied: "Copied!",
        whereFromDM: "From {username}'s DMs",
        whereFromGroupDM: "From {channelName} Group DM",
        whereFromGuild: "From {channelName} in {guildName}",
        tabDeleted: "Deleted",
        tabEdited: "Edited",
        tabGhostPinged: "Ghost Pinged",
        helpCopyBtn: "Copy",
        helpAriaLabel: "Copy filter",
        ok: "OK",
        importLogs: "Import Logs",
        infoTooltip: "ML Enhanced now stores logs in indexeddb. You need to import your old logs from the logs directory. Importing wont overwrite existing logs",
        jumpToMsg: "Jump To Message",
        openProfile: "Open user profile",
        copyContent: "Copy Content",
        copyUserId: "Copy User ID",
        copyMsgId: "Copy Message ID",
        copyChannelId: "Copy Channel ID",
        copyServerId: "Copy Server ID",
        deleteLog: "Delete Log"
    },
    tr: {
        filterHelpTitle: "Filtre Yardımı",
        filterHelpIntro: "Filtreler anahtar:değer biçiminde çalışır. Komutları kopyalandıktan sonra örneğe ya da yanındaki kopya düğmesine tıklayabilirsiniz.",
        filterHelpSearchDesc: "Filtre olmayan düz kelimeler mesaj içeriğinde, eklerde, embed'lerde ve düzenleme geçmişinde aranır.",
        emptyEh: "Burası bomboş",
        noResultsIn: "{tab} alanında sonuç bulunamadı.",
        maybeTry: "Şunları deneyebilirsin: {nextTab} veya {lastTab}",
        prevPage: "Önceki Sayfa",
        nextPage: "Sonraki Sayfa",
        pageOf: "Sayfa",
        clearVisible: "Görünen Logları Temizle",
        clearAll: "Tüm Logları Temizle",
        clearLogsTitle: "Logları Temizle",
        clearVisibleBody: "Görünen logları silmek istediğinize emin misiniz?",
        clearAllBody: "Tüm log veri tabanını temizlemek istediğinize emin misiniz?",
        clear: "Temizle",
        cancel: "İptal",
        sortOldestFirst: "Önce En Eski",
        sortNewestFirst: "Önce En Yeni",
        filterPlaceholder: "Mesajları filtrele...",
        copied: "Kopyalandı!",
        whereFromDM: "{username}'in DM'lerinden",
        whereFromGroupDM: "{channelName} Grup DM'sinden",
        whereFromGuild: "{guildName} sunucusundaki #{channelName} kanalından",
        tabDeleted: "Silinenler",
        tabEdited: "Düzenlenenler",
        tabGhostPinged: "Etiketlenenler",
        helpCopyBtn: "Kopyala",
        helpAriaLabel: "Filtreyi kopyala",
        ok: "Tamam",
        importLogs: "Logları Aktar (Import)",
        infoTooltip: "ML Enhanced artık logları indexeddb veritabanında saklamaktadır. Eski log dosyalarınızı log dizininden aktarmanız gerekmektedir. Aktarım mevcut logları silmez.",
        jumpToMsg: "Mesaja Git",
        openProfile: "Profili Aç",
        copyContent: "İçeriği Kopyala",
        copyUserId: "Kullanıcı ID Kopyala",
        copyMsgId: "Mesaj ID Kopyala",
        copyChannelId: "Kanal ID Kopyala",
        copyServerId: "Sunucu ID Kopyala",
        deleteLog: "Logu Sil"
    }
};

const getTranslation = (key: keyof typeof TRANSLATIONS.en) => {
    const lang = isTurkish() ? "tr" : "en";
    return TRANSLATIONS[lang][key];
};

const getFilterHelpSections = () => {
    if (isTurkish()) {
        return [
            {
                title: "Kullanıcı filtreleri",
                rows: [
                    ["user:<id veya ad>", "Kullanıcı ID'si, kullanıcı adı ya da görünen adına göre o kullanıcının mesajlarını bulur."],
                    ["from:<id veya ad>", "user: ile aynıdır. Sorguyu \"kimden geldi\" gibi okumak isterseniz kullanışlıdır."],
                ]
            },
            {
                title: "Konum filtreleri",
                rows: [
                    ["channel:<id veya ad>", "Kanal ID'si ya da kanal adına göre o kanaldaki logları bulur."],
                    ["in:<id veya ad>", "channel: ile aynıdır."],
                    ["server:<id veya ad>", "Sunucu ID'si ya da sunucu adına göre o sunucudaki logları bulur."],
                    ["guild:<id veya ad>", "server: ile aynıdır."],
                ]
            },
            {
                title: "Mesaj filtreleri",
                rows: [
                    ["message:<id>", "Tam olarak bu mesaj ID'sine sahip logu bulur."],
                    ["attachment:<id>", "savedImages klasöründeki dosya adında gördüğünüz ek/attachment ID'sini taşıyan mesajı bulur."],
                    ["file:<id>", "attachment: ile aynıdır; dosya ID'siyle aramak için kısa kullanım."],
                    ["has:attachment", "En az bir eki olan mesajları gösterir."],
                    ["has:image", "Resim eki ya da resim embed'i olan mesajları gösterir."],
                    ["has:video", "Video eki ya da video embed'i olan mesajları gösterir."],
                    ["has:embed", "Embed içeren mesajları gösterir."],
                    ["has:link", "İçeriğinde bağlantı olan mesajları gösterir."],
                ]
            },
            {
                title: "Zaman filtreleri",
                rows: [
                    ["before:2026-06-01", "Bu tarihten önce loglanan mesajları gösterir."],
                    ["after:2026-06-01", "Bu tarihten sonra loglanan mesajları gösterir."],
                    ["around:2026-06-01", "Bu tarihin 24 saat yakınındaki mesajları gösterir."],
                    ["near:2026-06-01", "around: ile aynıdır."],
                    ["during:2026-06-01", "around: ile aynıdır."],
                ]
            },
            {
                title: "Filtreleri birleştirme",
                rows: [
                    ["user:123 gif", "Önce kullanıcıya göre süzer, sonra log içinde gif kelimesini arar."],
                    ["attachment:1509744495510687837", "Bu ID'ye sahip kayıtlı dosyanın hangi mesajda olduğunu gösterir."],
                    ["!user:123", "Bir filtrenin başına ! koyarsanız o filtre tersine çalışır."],
                    ["server:123 has:image merhaba", "Birden fazla filtreyi ve düz metin aramasını boşluklarla birleştirebilirsiniz."]
                ]
            }
        ];
    } else {
        return [
            {
                title: "User filters",
                rows: [
                    ["user:<id or name>", "Finds messages of that user by user ID, username, or display name."],
                    ["from:<id or name>", "Same as user:. Useful if you want to read the query as 'came from'."],
                ]
            },
            {
                title: "Location filters",
                rows: [
                    ["channel:<id or name>", "Finds logs in that channel by channel ID or channel name."],
                    ["in:<id or name>", "Same as channel:."],
                    ["server:<id or name>", "Finds logs in that server by server ID or server name."],
                    ["guild:<id or name>", "Same as server:."]
                ]
            },
            {
                title: "Message filters",
                rows: [
                    ["message:<id>", "Finds the log with exactly this message ID."],
                    ["attachment:<id>", "Finds the message containing the attachment ID seen in the saved folder file name."],
                    ["file:<id>", "Same as attachment:; short usage to search by file ID."],
                    ["has:attachment", "Shows messages with at least one attachment."],
                    ["has:image", "Shows messages with image attachments or image embeds."],
                    ["has:video", "Shows messages with video attachments or video embeds."],
                    ["has:embed", "Shows messages containing embeds."],
                    ["has:link", "Shows messages containing links."]
                ]
            },
            {
                title: "Time filters",
                rows: [
                    ["before:2026-06-01", "Shows messages logged before this date."],
                    ["after:2026-06-01", "Shows messages logged after this date."],
                    ["around:2026-06-01", "Shows messages within 24 hours of this date."],
                    ["near:2026-06-01", "Same as around:."],
                    ["during:2026-06-01", "Same as around:."]
                ]
            },
            {
                title: "Combining filters",
                rows: [
                    ["user:123 gif", "First filters by user, then searches for the word 'gif' inside the message content."],
                    ["attachment:1509744495510687837", "Shows which message contains the attachment with this ID."],
                    ["!user:123", "Putting '!' before a filter makes it work in reverse."],
                    ["server:123 has:image hello", "You can combine multiple filters and plain text search with spaces."]
                ]
            }
        ];
    }
};

function openFilterHelpModal() {
    openModal(modalProps => (
        <Modal
            {...modalProps}
            size="lg"
            title={getTranslation("filterHelpTitle")}
            actions={[
                {
                    text: getTranslation("ok"),
                    variant: "primary",
                    onClick: modalProps.onClose
                }
            ]}
        >
            <div className={cl("filter-help")}>
                <BaseText size="sm" color="text-muted">
                    {getTranslation("filterHelpIntro")}
                </BaseText>
                <BaseText size="sm" color="text-muted">
                    {getTranslation("filterHelpSearchDesc")}
                </BaseText>

                {getFilterHelpSections().map(section => (
                    <section className={cl("filter-help-section")} key={section.title}>
                        <BaseText tag="h3" size="md" weight="semibold" color="text-strong">
                            {section.title}
                        </BaseText>
                        <div className={cl("filter-help-list")}>
                            {section.rows.map(row => {
                                const [syntax, description] = row;

                                return (
                                    <div className={cl("filter-help-row")} key={syntax}>
                                        <button
                                            type="button"
                                            className={cl("filter-help-copy-syntax")}
                                            onClick={() => copyWithToast(syntax)}
                                        >
                                            <code>{syntax}</code>
                                        </button>
                                        <BaseText size="sm">{description}</BaseText>
                                        <Tooltip text={getTranslation("copied")}>
                                            {({ onMouseEnter, onMouseLeave }) => (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="iconOnly"
                                                    className={cl("filter-help-copy-button")}
                                                    onMouseEnter={onMouseEnter}
                                                    onMouseLeave={onMouseLeave}
                                                    onClick={() => copyWithToast(syntax)}
                                                    aria-label={`${syntax} ${getTranslation("helpAriaLabel")}`}
                                                >
                                                    <CopyIcon width={16} height={16} />
                                                </Button>
                                            )}
                                        </Tooltip>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </Modal>
    ));
}

export function LogsModal({ modalProps, initalQuery }: { modalProps: RenderModalProps; initalQuery?: string; }) {
    const [currentTab, setCurrentTab] = useState(LogTabs.DELETED);
    const [queryEh, setQuery] = useState(initalQuery ?? "");
    const [sortNewest, setSortNewest] = useState(settings.store.sortNewest);
    const [currentPage, setCurrentPage] = useState(0);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const pageSize = settings.store.messagesToDisplayAtOnceInLogs;

    const { messages, total, pending, hasNextPage, reset } = useMessages(queryEh, currentTab, sortNewest, currentPage, pageSize);

    const scrollToTop = () => contentRef.current?.firstElementChild?.scrollTo(0, 0);
    const goToPage = (page: number) => {
        setCurrentPage(Math.max(0, page));
        scrollToTop();
    };

    useEffect(() => {
        setCurrentPage(0);
    }, [queryEh, currentTab, sortNewest]);

    // Go back a page if current page becomes empty (e.g. after deleting all visible logs)
    useEffect(() => {
        if (!pending && messages != null && messages.length === 0 && currentPage > 0) {
            goToPage(currentPage - 1);
        }
    }, [messages, pending, currentPage]);

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={
                <div className={cl("modal")}>
                    <TabBar
                        type="top"
                        look="brand"
                        className={cl("modal-tab-bar")}
                        selectedItem={currentTab}
                        onItemSelect={e => {
                            setCurrentTab(e);
                            scrollToTop();
                        }}
                    >
                        <TabBar.Item className={cl("modal-tab-bar-item")} id={LogTabs.DELETED}>
                            {getTranslation("tabDeleted")}
                        </TabBar.Item>
                        <TabBar.Item className={cl("modal-tab-bar-item")} id={LogTabs.EDITED}>
                            {getTranslation("tabEdited")}
                        </TabBar.Item>
                        <TabBar.Item className={cl("modal-tab-bar-item")} id={LogTabs.GHOST_PING}>
                            {getTranslation("tabGhostPinged")}
                        </TabBar.Item>
                    </TabBar>
                    <div className={cl("modal-filter")}>
                        <div className={cl("modal-filter-input")}>
                            <TextInput value={queryEh} onChange={e => setQuery(e)} placeholder={getTranslation("filterPlaceholder")} />
                        </div>
                        <Tooltip text={getTranslation("filterHelpTitle")}>
                            {({ onMouseEnter, onMouseLeave }) => (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="iconOnly"
                                    className={cl("modal-filter-help-button")}
                                    onClick={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openFilterHelpModal();
                                    }}
                                    onMouseEnter={onMouseEnter}
                                    onMouseLeave={onMouseLeave}
                                    aria-label="Filter Help"
                                >
                                    <InfoIcon width={18} height={18} />
                                </Button>
                            )}
                        </Tooltip>
                    </div>
                </div>
            }
            actions={[
                {
                    text: sortNewest ? getTranslation("sortOldestFirst") : getTranslation("sortNewestFirst"),
                    variant: "secondary",
                    onClick: () => {
                        setSortNewest(e => {
                            const val = !e;
                            settings.store.sortNewest = val;
                            return val;
                        });
                        scrollToTop();
                    }
                },
                {
                    text: getTranslation("clearVisible"),
                    variant: "critical-secondary",
                    disabled: messages?.length === 0,
                    onClick: () => Alerts.show({
                        title: getTranslation("clearLogsTitle"),
                        body: getTranslation("clearVisibleBody"),
                        confirmText: getTranslation("clear"),
                        confirmVariant: "critical-primary",
                        cancelText: getTranslation("cancel"),
                        onConfirm: async () => {
                            await deleteMessagesBulkIDB(messages.map(e => e.message_id));
                            reset();
                        }
                    })
                },
                {
                    text: getTranslation("clearAll"),
                    variant: "critical-primary",
                    onClick: () => Alerts.show({
                        title: getTranslation("clearLogsTitle"),
                        body: getTranslation("clearAllBody"),
                        confirmText: getTranslation("clear"),
                        confirmVariant: "critical-primary",
                        cancelText: getTranslation("cancel"),
                        onConfirm: async () => {
                            await clearLogs();
                            reset();
                        }
                    })
                }
            ]}
        >
            <div style={{ opacity: modalProps.transitionState === 1 ? "1" : "0" }} className={`${cl("modal-content-container")} ${cl("modal-root")}`} ref={contentRef}>
                {
                    modalProps.transitionState === 1 &&
                    <div>
                        {messages != null && total === 0 && (
                            <EmptyLogs
                                hasQuery={queryEh.length !== 0}
                                reset={reset}
                            />
                        )}

                        {!pending && messages != null && (
                            <LogsContentMemo
                                visibleMessages={messages}
                                currentPage={currentPage}
                                hasNextPage={hasNextPage}
                                tab={currentTab}
                                sortNewest={sortNewest}
                                reset={reset}
                                handlePreviousPage={() => goToPage(currentPage - 1)}
                                handleNextPage={() => goToPage(currentPage + 1)}
                            />
                        )}
                    </div>
                }
            </div>
        </Modal>
    );
}

interface LogContentProps {
    sortNewest: boolean;
    tab: LogTabs;
    visibleMessages: DBMessageRecord[];
    currentPage: number;
    hasNextPage: boolean;
    reset: () => void;
    handlePreviousPage: () => void;
    handleNextPage: () => void;
}

function LogsContent({ visibleMessages, currentPage, hasNextPage, sortNewest, tab, reset, handlePreviousPage, handleNextPage }: LogContentProps) {
    return (
        <div className={cl("modal-content-inner")}>
            {visibleMessages.length === 0 ? (
                <NoResults tab={tab} />
            ) : (
                visibleMessages.map(({ message }, i) => (
                    <LMessage
                        key={message.id}
                        log={{ message }}
                        reset={reset}
                        isGroupStart={isGroupStart(message, visibleMessages[i - 1]?.message, sortNewest)}
                    />
                ))
            )}
            {(currentPage > 0 || hasNextPage) && (
                <div className={cl("modal-pagination")}>
                    <Button
                        size="small"
                        variant="secondary"
                        disabled={currentPage === 0}
                        onClick={handlePreviousPage}
                    >
                        {getTranslation("prevPage")}
                    </Button>
                    <BaseText size="sm" color="text-muted">
                        {getTranslation("pageOf")} {currentPage + 1}
                    </BaseText>
                    <Button
                        size="small"
                        variant="secondary"
                        disabled={!hasNextPage}
                        onClick={handleNextPage}
                    >
                        {getTranslation("nextPage")}
                    </Button>
                </div>
            )}
        </div>
    );
}

const LogsContentMemo = LazyComponent(() => LogsContent);

function NoResults({ tab }: { tab: LogTabs; }) {
    const generateSuggestedTabs = (tab: LogTabs) => {
        switch (tab) {
            case LogTabs.DELETED:
                return { nextTab: LogTabs.EDITED, lastTab: LogTabs.GHOST_PING };
            case LogTabs.EDITED:
                return { nextTab: LogTabs.GHOST_PING, lastTab: LogTabs.DELETED };
            case LogTabs.GHOST_PING:
                return { nextTab: LogTabs.DELETED, lastTab: LogTabs.EDITED };
            default:
                return { nextTab: "", lastTab: "" };
        }
    };

    const { nextTab, lastTab } = generateSuggestedTabs(tab);

    const translateTab = (tab: string) => {
        switch (tab) {
            case LogTabs.DELETED: return getTranslation("tabDeleted");
            case LogTabs.EDITED: return getTranslation("tabEdited");
            case LogTabs.GHOST_PING: return getTranslation("tabGhostPinged");
            default: return tab;
        }
    };

    return (
        <div className={cl("modal-empty-logs", "modal-content-inner")} style={{ textAlign: "center" }}>
            <BaseText size="lg">
                {getTranslation("noResultsIn").replace("{tab}", translateTab(tab))}
            </BaseText>
            <BaseText size="lg" style={{ marginTop: "0.2rem" }}>
                {getTranslation("maybeTry")
                    .replace("{nextTab}", translateTab(nextTab))
                    .replace("{lastTab}", translateTab(lastTab))}
            </BaseText>
        </div>
    );
}

function EmptyLogs({ hasQuery, reset: forceUpdate }: { hasQuery: boolean; reset: () => void; }) {
    return (
        <div className={cl("modal-empty-logs", "modal-content-inner")} style={{ textAlign: "center" }}>
            <Flex flexDirection="column" style={{ position: "relative" }}>
                <BaseText size="lg">
                    {getTranslation("emptyEh")}
                </BaseText>

                {!hasQuery && (
                    <>
                        <Tooltip text={getTranslation("infoTooltip")}>
                            {({ onMouseEnter, onMouseLeave }) => (
                                <div
                                    className={cl("modal-info-icon")}
                                    onMouseEnter={onMouseEnter}
                                    onMouseLeave={onMouseLeave}
                                >
                                    <InfoIcon />
                                </div>
                            )}
                        </Tooltip>

                        <Button onClick={() => importLogs().then(() => forceUpdate())}>
                            {getTranslation("importLogs")}
                        </Button>
                    </>
                )}
            </Flex>
        </div>
    );
}

interface LMessageProps {
    log: { message: LoggedMessageJSON; };
    isGroupStart: boolean;
    reset: () => void;
}

function LMessage({ log, isGroupStart, reset }: LMessageProps) {
    const message = useMemo(() => messageJsonToMessageClass(log), [log]);

    if (!message) return null;

    const channel = ChannelStore.getChannel(message?.channel_id);
    const guild = GuildStore.getGuild(channel?.guild_id);

    const getWhereFromText = () => {
        if (!channel) return null;
        if (channel.isDM()) {
            return message.author ? getTranslation("whereFromDM").replace("{username}", message.author.username) : null;
        }
        if (channel.isGroupDM()) {
            return channel.name ? getTranslation("whereFromGroupDM").replace("{channelName}", channel.name) : null;
        }
        return channel.name && guild?.name
            ? getTranslation("whereFromGuild").replace("{channelName}", channel.name).replace("{guildName}", guild.name)
            : null;
    };

    const whereFromText = getWhereFromText();

    return (
        <div
            onContextMenu={e => {
                ContextMenuApi.openContextMenu(e, () =>
                    <Menu.Menu
                        navId="message-logger"
                        onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                        aria-label="Message Logger"
                    >
                        <Menu.MenuItem
                            key="jump-to-message"
                            id="jump-to-message"
                            label={getTranslation("jumpToMsg")}
                            action={() => {
                                NavigationRouter.transitionTo(`/channels/${ChannelStore.getChannel(message.channel_id)?.guild_id ?? "@me"}/${message.channel_id}${message.id ? "/" + message.id : ""}`);
                                closeAllModals();
                            }}
                        />
                        <Menu.MenuItem
                            key="open-user-profile"
                            id="open-user-profile"
                            label={getTranslation("openProfile")}
                            action={() => {
                                closeAllModals();
                                openUserProfile(message.author.id);
                            }}
                        />
                        <Menu.MenuItem
                            key="copy-content"
                            id="copy-content"
                            label={getTranslation("copyContent")}
                            action={() => copyWithToast(message.content)}
                        />
                        <Menu.MenuItem
                            key="copy-user-id"
                            id="copy-user-id"
                            label={getTranslation("copyUserId")}
                            action={() => copyWithToast(message.author.id)}
                        />
                        <Menu.MenuItem
                            key="copy-message-id"
                            id="copy-message-id"
                            label={getTranslation("copyMsgId")}
                            action={() => copyWithToast(message.id)}
                        />
                        <Menu.MenuItem
                            key="copy-channel-id"
                            id="copy-channel-id"
                            label={getTranslation("copyChannelId")}
                            action={() => copyWithToast(message.channel_id)}
                        />
                        {log.message.guildId != null && (
                            <Menu.MenuItem
                                key="copy-server-id"
                                id="copy-server-id"
                                label={getTranslation("copyServerId")}
                                action={() => copyWithToast(log.message.guildId!)}
                            />
                        )}
                        <Menu.MenuItem
                            key="delete-log"
                            id="delete-log"
                            label={getTranslation("deleteLog")}
                            color="danger"
                            action={() => deleteMessageIDB(log.message.id).then(() => reset())}
                        />
                    </Menu.Menu>
                );
            }}
        >
            <MessagePreview
                className={`${cl("modal-msg-preview")} ${message.deleted ? "messagelogger-deleted" : ""}`}
                author={message.author}
                message={message}
                compact={false}
                isGroupStart={isGroupStart}
                hideSimpleEmbedContent={false}
                childrenAccessories={
                    <ChildrenAccessories
                        channelMessageProps={{
                            channel: ChannelStore.getChannel(message.channel_id) || new PrivateChannelRecord({ id: "" }),
                            message,
                            compact: false,
                            groupId: "1",
                            id: message.id,
                            isLastItem: false,
                            isHighlight: false,
                            renderContentOnly: false,
                        }}
                        hasSpoilerEmbeds={false}
                        isInteracting={false}
                        showClydeAiEmbeds={true}
                        isAutomodBlockedMessage={false}
                    />
                }
            />
            {settings.store.ShowWhereMessageIsFrom && whereFromText && (
                <span className={`${cl("modal-from")} ${message.deleted ? cl("modal-from-deleted") : cl("modal-from-edited")}`}>
                    {whereFromText}
                </span>
            )}
        </div>
    );
}

export const openLogModal = (initalQuery?: string) => openModal(modalProps => <LogsModal modalProps={modalProps} initalQuery={initalQuery} />);

function isGroupStart(
    currentMessage: LoggedMessageJSON | undefined,
    previousMessage: LoggedMessageJSON | undefined,
    sortNewest: boolean
) {
    if (!currentMessage || !previousMessage) return true;

    if (currentMessage.id === previousMessage.id) return true;

    const [newestMessage, oldestMessage] = sortNewest
        ? [previousMessage, currentMessage]
        : [currentMessage, previousMessage];

    if (newestMessage.author.id !== oldestMessage.author.id) return true;

    const timeDifferenceInMinutes = Math.abs(
        (new Date(newestMessage.timestamp)?.getTime() - new Date(oldestMessage.timestamp)?.getTime()) / (1000 * 60)
    );

    return timeDifferenceInMinutes >= 5;
}
