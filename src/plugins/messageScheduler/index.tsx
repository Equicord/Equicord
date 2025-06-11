

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { Devs } from "@utils/constants";
import { getTheme, Theme } from "@utils/discord";
import { Margins } from "@utils/margins";
import { closeModal, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Button, Forms, TextInput, useMemo, useState } from "@webpack/common";

const settings = definePluginSettings({
    scheduledMessages: {
        type: OptionType.COMPONENT,
        default: [] as ScheduledMessage[],
        component: () => {
            const messages = settings.store.scheduledMessages as ScheduledMessage[];
            return (
                <>
                    <Forms.FormText>
                        Schedule messages to be sent at a specific time in the future.
                        Use the clock icon in the chat bar to schedule a new message.
                    </Forms.FormText>
                    {messages.length > 0 && (
                        <>
                            <Forms.FormTitle>Scheduled Messages</Forms.FormTitle>
                            <div className={cl("scheduled-messages")}>
                                {messages.map(msg => (
                                    <div key={msg.id} className={cl("scheduled-message")}>
                                        <div className={cl("message-content")}>{msg.content}</div>
                                        <div className={cl("message-time")}>
                                            Scheduled for: {new Date(msg.scheduledTime).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            );
        }
    },
});

const cl = classNameFactory("vc-ms-");

interface ScheduledMessage {
    id: string;
    channelId: string;
    content: string;
    scheduledTime: number;
}

function SchedulerModal({ rootProps, close }: { rootProps: ModalProps, close(): void; }) {
    const [content, setContent] = useState("");
    const [scheduledTime, setScheduledTime] = useState("");
    const [error, setError] = useState("");

    const handleSchedule = () => {
        const timestamp = new Date(scheduledTime).getTime();
        if (isNaN(timestamp)) {
            setError("Invalid date/time");
            return;
        }
        if (timestamp <= Date.now()) {
            setError("Scheduled time must be in the future");
            return;
        }
        if (!content.trim()) {
            setError("Message content cannot be empty");
            return;
        }

        const newMessage: ScheduledMessage = {
            id: Math.random().toString(36).slice(2),
            channelId: window.location.pathname.split("/").pop() || "",
            content,
            scheduledTime: timestamp
        };

        const currentMessages = settings.store.scheduledMessages as ScheduledMessage[];
        settings.store.scheduledMessages = [...currentMessages, newMessage];
        close();
    };

    return (
        <ModalRoot {...rootProps}>
            <ModalHeader className={cl("modal-header")}>
                <Forms.FormTitle tag="h2" className={cl("modal-title")}>
                    Schedule Message
                </Forms.FormTitle>
                <ModalCloseButton onClick={close} className={cl("modal-close-button")} />
            </ModalHeader>

            <ModalContent className={cl("modal-content")}>
                <Forms.FormTitle>Message Content</Forms.FormTitle>
                <TextInput
                    value={content}
                    onChange={setContent}
                    placeholder="Enter your message..."
                    className={cl("message-input")}
                />

                <Forms.FormTitle className={Margins.top16}>Schedule Time</Forms.FormTitle>
                <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className={cl("datetime-input")}
                    style={{
                        colorScheme: getTheme() === Theme.Light ? "light" : "dark",
                    }}
                />

                {error && (
                    <Forms.FormText className={cl("error-text")}>
                        {error}
                    </Forms.FormText>
                )}
            </ModalContent>

            <ModalFooter>
                <Button
                    onClick={handleSchedule}
                    color={Button.Colors.BRAND}
                >
                    Schedule Message
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

const ChatBarIcon: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip="Schedule Message"
            onClick={() => {
                const key = openModal(props => (
                    <SchedulerModal
                        rootProps={props}
                        close={() => closeModal(key)}
                    />
                ));
            }}
            buttonProps={{ "aria-haspopup": "dialog" }}
        >
            <svg
                aria-hidden="true"
                role="img"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                style={{ scale: "1.2" }}
            >
                <path
                    fill="currentColor"
                    d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"
                />
            </svg>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "MessageScheduler",
    description: "Schedule messages to be sent at a specific time",
    authors: [Devs.eyadmkv],
    settings,

    renderChatBarButton: ChatBarIcon,

    start() {
        // Check for scheduled messages every minute
        setInterval(() => {
            const now = Date.now();
            const messages = settings.store.scheduledMessages as ScheduledMessage[];
            const currentChannelId = window.location.pathname.split("/").pop() || "";

            messages.forEach((msg, index) => {
                if (msg.scheduledTime <= now && msg.channelId === currentChannelId) {
                    // Send the message
                    const message = {
                        content: msg.content,
                        channelId: msg.channelId,
                    };
                    // @ts-ignore
                    window.DiscordNative?.window?.sendMessage?.(message);

                    // Remove the sent message from the list
                    const updatedMessages = [...messages];
                    updatedMessages.splice(index, 1);
                    settings.store.scheduledMessages = updatedMessages;
                }
            });
        }, 60000); // Check every minute
    },

    settingsAboutComponent() {
        const messages = settings.store.scheduledMessages as ScheduledMessage[];

        return (
            <>
                <Forms.FormText>
                    Schedule messages to be sent at a specific time in the future.
                    Use the clock icon in the chat bar to schedule a new message.
                </Forms.FormText>
                {messages.length > 0 && (
                    <>
                        <Forms.FormTitle>Scheduled Messages</Forms.FormTitle>
                        <div className={cl("scheduled-messages")}>
                            {messages.map(msg => (
                                <div key={msg.id} className={cl("scheduled-message")}>
                                    <div className={cl("message-content")}>{msg.content}</div>
                                    <div className={cl("message-time")}>
                                        Scheduled for: {new Date(msg.scheduledTime).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </>
        );
    },
});
