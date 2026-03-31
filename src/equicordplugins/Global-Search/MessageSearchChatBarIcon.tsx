import {
    ModalRoot,
    ModalHeader,
    ModalContent,
    ModalFooter,
    ModalCloseButton,
    ModalSize,
    ModalProps,
    openModal
} from "@utils/modal";
import {
    Forms,
    React,
    Button,
    TextInput,
    Constants,
    useState,
    Text,
    UserStore,
    ChannelRouter,
    RestAPI
} from "@webpack/common";
import { findByPropsLazy } from "@webpack";
import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";

const Kangaroo = findByPropsLazy("jumpToMessage");

// ================== Types ==================

interface MessageAuthor {
    id: string;
    username: string;
    avatar: string | null;
}

interface MessageSearchModalProps extends ModalProps {}

interface SearchResultItem {
    id: string;
    content: string;
    author: MessageAuthor;
    channel_id: string;
    timestamp: string;
}

interface MessagesTabData {
    messages: SearchResultItem[][];
    cursor?: string | null;
}

interface SearchResponse {
    tabs: {
        messages: MessagesTabData;
    };
}

// ================== Utils ==================

const getAvatarUrl = (userId?: string, avatarHash?: string | null) => {
    if (!userId || !avatarHash) {
        return `https://cdn.discordapp.com/embed/avatars/${(parseInt(userId || "0") % 5)}.png`;
    }
    const extension = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=32`;
};

// ================== Modal Component ==================

function MessageSearchModal(props: MessageSearchModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [nextMessagesCursor, setNextMessagesCursor] = useState<string | null>(null);

    const handleNavigateToMessage = (channelId: string, messageId: string) => {
        if (ChannelRouter && typeof ChannelRouter.transitionToChannel === "function") {
            ChannelRouter.transitionToChannel(channelId);

            setTimeout(() => {
                if (Kangaroo && typeof Kangaroo.jumpToMessage === "function") {
                    Kangaroo.jumpToMessage({
                        channelId,
                        messageId,
                        flash: false,
                        jumpType: "INSTANT"
                    });

                    setTimeout(() => {
                        props.onClose();
                    }, 300);
                } else {
                    console.error(
                        "[MessageSearch] Kangaroo module or jumpToMessage function not available when trying to jump.",
                        Kangaroo
                    );
                    alert("Failed to navigate: Kangaroo module (for message jump) not available.");
                }
            }, 700);
        } else {
            console.error(
                "[MessageSearch] ChannelRouter module or transitionToChannel function not available from @webpack/common.",
                ChannelRouter
            );
        }
    };

    const handleSearch = async (currentCursor: string | null = null) => {
        if (!searchQuery.trim()) return;
        setIsLoading(true);

        if (!currentCursor) {
            setSearchResults([]);
            setNextMessagesCursor(null);
        }

        const requestBody = {
            tabs: {
                messages: {
                    sort_by: "timestamp",
                    sort_order: "desc",
                    content: searchQuery,
                    cursor: currentCursor,
                    limit: 25
                }
            },
            track_exact_total_hits: false
        };

        const relativeApiPath = "/users/@me/messages/search/tabs";

        try {
            const response = await RestAPI.post({
                url: relativeApiPath,
                body: requestBody,
                oldFormErrors: true
            });

            const data = response.body as SearchResponse;

            if (!data) {
                alert("Search failed: Server returned no usable data. Check console for details.");
                setIsLoading(false);
                return;
            }

            if (!data.tabs || !data.tabs.messages || !data.tabs.messages.messages) {
                console.error(
                    "[MessageSearch] API response body does not have the expected structure. Parsed data:",
                    data
                );
                setIsLoading(false);
                return;
            }

            const newMessages: SearchResultItem[] = data.tabs.messages.messages.flat();
            setSearchResults(prevResults =>
                currentCursor ? [...prevResults, ...newMessages] : newMessages
            );
            setNextMessagesCursor(data.tabs.messages.cursor || null);
        } catch (error: any) {
            console.error("[MessageSearch] Error during RestAPI.post operation:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalRoot {...props} size={ModalSize.LARGE}>
            <ModalHeader>
                <Forms.FormTitle tag="h2">Global Search</Forms.FormTitle>
                <Forms.FormText
                    style={{
                        fontStyle: "italic",
                        fontSize: "0.9em",
                        marginTop: "-5px",
                        marginBottom: "10px"
                    }}
                >
                    by Jaisal (AtomicByte)
                </Forms.FormText>
                <ModalCloseButton onClick={props.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                    <TextInput
                        placeholder="Enter search query..."
                        value={searchQuery}
                        onChange={setSearchQuery}
                        style={{ flexGrow: 1 }}
                    />
                    <Button onClick={() => handleSearch()} disabled={isLoading}>
                        {isLoading ? "Searching..." : "Search"}
                    </Button>
                </div>

                <div>
                    {searchResults.length === 0 && !isLoading && (
                        <Forms.FormText>
                            No results found, or search not yet performed.
                        </Forms.FormText>
                    )}

                    {searchResults.map((item: SearchResultItem) => (
                        <div
                            key={item.id}
                            style={{
                                marginBottom: "10px",
                                padding: "10px",
                                border: "1px solid var(--background-modifier-accent)",
                                borderRadius: "5px"
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    marginBottom: "5px"
                                }}
                            >
                                <img
                                    src={getAvatarUrl(item.author.id, item.author.avatar)}
                                    alt={`${item.author.username}'s avatar`}
                                    style={{
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "50%",
                                        marginRight: "10px",
                                        objectFit: "cover"
                                    }}
                                />
                                <Text
                                    color="header-primary"
                                    variant="text-md/semibold"
                                >
                                    {item.author.username}
                                </Text>
                                <Text
                                    color="text-muted"
                                    style={{ marginLeft: "10px", fontSize: "0.8em" }}
                                >
                                    {new Date(item.timestamp).toLocaleString()}
                                </Text>
                            </div>

                            <Text
                                color="text-normal"
                                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                            >
                                {item.content}
                            </Text>

                            <Forms.FormText
                                style={{
                                    fontSize: "0.75em",
                                    marginTop: "5px",
                                    color: "var(--text-muted)"
                                }}
                            >
                                Channel ID: {item.channel_id} | Message ID: {item.id}
                            </Forms.FormText>

                            <div style={{ marginTop: "8px", textAlign: "right" }}>
                                <Button
                                    size={Button.Sizes.SMALL}
                                    look={Button.Looks.LINK}
                                    color={Button.Colors.LINK}
                                    onClick={() =>
                                        handleNavigateToMessage(item.channel_id, item.id)
                                    }
                                >
                                    انتقال إلى الرسالة
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </ModalContent>
            <ModalFooter>
                {nextMessagesCursor && !isLoading && (
                    <Button
                        onClick={() => handleSearch(nextMessagesCursor)}
                        disabled={isLoading}
                    >
                        Load More
                    </Button>
                )}
            </ModalFooter>
        </ModalRoot>
    );
}

// ================== Modal opener ==================

export function openGlobalSearchModal() {
    openModal(props => <MessageSearchModal {...props} />);
}

// ================== Chat bar button ==================

const SearchIcon = () => (
    <svg fill="currentColor" width="20" height="20" viewBox="0 0 24 24">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z" />
    </svg>
);

export const MessageSearchChatBarIcon: ChatBarButtonFactory = ({ channel, isMainChat }) => {
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip="Global Search"
            onClick={() => openGlobalSearchModal()}
            buttonProps={{
                "aria-label": "Global Search"
            }}
        >
            <SearchIcon />
        </ChatBarButton>
    );
};
