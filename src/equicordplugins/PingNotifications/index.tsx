import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import {
    FluxDispatcher,
    ChannelStore,
    SelectedChannelStore,
    UserStore,
    PresenceStore,
    RelationshipStore,
    NavigationRouter,
    MessageStore,
    GuildStore
} from "@webpack/common";
import { showNotification } from "@api/Notifications";

const settings = definePluginSettings({
    friends: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Notify when friends message you (non-@ mentions)"
    },
    mentions: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Notify when someone @mentions you directly"
    },
    replies: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Notify when someone replies to your messages"
    },
    dms: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Notify for direct messages (DMs)"
    },
    showInActive: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show notifications even for current active channel"
    }
});

export default definePlugin({
    name: "PingNotification",
    description: "Customizable notifications with improved mention formatting",
    authors: [EquicordDevs.smuki],
    settings,

    start() {
        const formatContent = (message: any) => {
            let content = message.content || "";
            message.mentions?.forEach(user => {
                content = content.replace(new RegExp(`<@!?${user.id}>`, "g"), `@${user.username}`);
            });
            return content.slice(0, 200) + (content.length > 200 ? "..." : "");
        };

        const handler = ({ message }) => {
            try {
                if (!message?.channel_id || message.state === "SENDING") return;

                const channel = ChannelStore.getChannel(message.channel_id);
                const currentUser = UserStore.getCurrentUser();

                if (!channel || !currentUser || message.author?.id === currentUser.id) return;
                if (channel.isMuted?.() || (channel.guild_id && GuildStore.getGuild(channel.guild_id)?.isMuted?.())) return;
                if (!settings.store.showInActive && channel.id === SelectedChannelStore.getChannelId()) return;
                if (PresenceStore.getStatus(currentUser.id) === "dnd") return;

                const author = UserStore.getUser(message.author.id) || { username: "Unknown" };
                const isDM = [1, 3].includes(channel.type);
                const channelName = channel.name || (isDM ? "DM" : "Group");
                const body = formatContent(message);

                const shouldNotify = (
                    (settings.store.mentions && message.mentions?.some(u => u.id === currentUser.id)) ||
                    (settings.store.friends && RelationshipStore.isFriend(message.author.id)) ||
                    (settings.store.replies && message.message_reference?.message_id &&
                        MessageStore.getMessage(
                            message.message_reference.channel_id || channel.id,
                            message.message_reference.message_id
                        )?.author.id === currentUser.id
                    ) ||
                    (isDM && settings.store.dms)
                );

                if (shouldNotify) {
                    showNotification({
                        title: `${author.username} in ${channelName}`,
                        body,
                        icon: author.getAvatarURL?.(undefined, 128),
                        onClick: () => NavigationRouter.transitionTo(
                            `/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`
                        )
                    });
                }
            } catch (err) {
                console.error("[PingNotification] Error:", err);
            }
        };

        FluxDispatcher.subscribe("MESSAGE_CREATE", handler);
        return () => FluxDispatcher.unsubscribe("MESSAGE_CREATE", handler);
    }
});