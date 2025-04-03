import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
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
  React,
  ReactDOM,
  useState,
  useEffect,
  useRef,
  UserUtils,
  GuildStore,
  MessageStore,
} from "@webpack/common";

const cl = classNameFactory("vc-pn-");

const settings = definePluginSettings({
  preset: {
    type: OptionType.SELECT,
    default: "all",
    options: [
      { label: "All Mentions", value: "all" },
      { label: "Direct Mentions Only", value: "direct" },
      { label: "Friends Only", value: "friends" },
      { label: "Administrators Only", value: "admins" },
      { label: "Custom", value: "custom" },
    ],
    description: "Who can notify you",
  },
  showDirectMessages: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Show notifications for Direct Messages",
    isHidden: (plugin) => plugin.settings.store.preset !== "custom",
  },
  showReplies: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Show notifications for Replies",
    isHidden: (plugin) => plugin.settings.store.preset !== "custom",
  },
  showMentions: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Show notifications for Mentions",
    isHidden: (plugin) => plugin.settings.store.preset !== "custom",
  },
  allowNotificationsInCurrentChannel: {
    type: OptionType.BOOLEAN,
    default: false,
    description: "Show notifications in current channel",
  },
  privacyMode: {
    type: OptionType.BOOLEAN,
    default: false,
    description: "Privacy Mode (blur notifications until hover/NSFW channels)",
  },
  blockedChannels: {
    type: OptionType.STRING,
    default: "",
    description: "Blocked Channels (comma separated IDs)",
    isHidden: (plugin) => plugin.settings.store.preset !== "custom",
  },
  blockedServers: {
    type: OptionType.STRING,
    default: "",
    description: "Blocked Servers (comma separated IDs)",
    isHidden: (plugin) => plugin.settings.store.preset !== "custom",
  },
});

const NotificationComponent = ({ message, channel }) => {
  const [remaining, setRemaining] = useState(5000);
  const [revealed, setRevealed] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [startX, setStartX] = useState(0);
  const ref = useRef(null);

  const { privacyMode } = settings.store;

  const user = UserStore.getUser(message.author.id) || UserUtils.getUser(message.author.id) || { username: "Unknown", globalName: "" };
  const displayName = user.globalName || user.username || "Unknown";
  const avatarUrl = user.getAvatarURL?.(undefined, 128) || "";

  const isNSFW = channel.nsfw || false;
  const usePrivacy = privacyMode && (isNSFW || false);
  const guild = channel.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
  const channelName = channel.name || (channel.recipients ? "Direct Message" : "Unknown Channel");
  const guildName = guild ? guild.name : (channel.recipients ? "DM" : "");

  const formatMentions = (content) => {
    if (!content) return "";

    let formattedContent = content.replace(/<@!?(\d+)>/g, (match, id) => {
      const mentionedUser = UserStore.getUser(id);
      const name = mentionedUser ? (mentionedUser.globalName || mentionedUser.username) : id;
      return `<span class="mention">@${name}</span>`;
    });

    formattedContent = formattedContent.replace(/<@&(\d+)>/g, (match, id) => {
      let roleName = "role";
      let roleColor = null;

      if (guild?.roles) {
        const role = RoleStore.getRole(id) || guild.roles[id];
        if (role) {
          roleName = role.name;
          roleColor = role.colorString;
        }
      }

      return `<span class="mention" style="${roleColor ? `color:${roleColor};` : ''}">@${roleName}</span>`;
    });

    return formattedContent;
  };

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining(prev => Math.max(prev - 100, 0));
    }, 100);
    return () => clearInterval(interval);
  }, [remaining]);

  return (
    <div
      ref={ref}
      className={cl("notification")}
      style={{
        transform: `translateX(${offsetX}px)`,
        opacity: Math.abs(offsetX) > 75 ? 1 - (Math.abs(offsetX) - 75) / 100 : 1
      }}
      onClick={() => {
        NavigationRouter.transitionTo(`/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`);
        ref.current?.parentNode?.removeChild(ref.current);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        ref.current?.parentNode?.removeChild(ref.current);
      }}
      onMouseEnter={() => usePrivacy && setRevealed(true)}
      onMouseLeave={() => usePrivacy && setRevealed(false)}
      onTouchStart={(e) => setStartX(e.touches[0].clientX)}
      onTouchMove={(e) => setOffsetX(e.touches[0].clientX - startX)}
      onTouchEnd={() => {
        if (Math.abs(offsetX) > 100) {
          ref.current?.parentNode?.removeChild(ref.current);
        } else {
          setOffsetX(0);
        }
      }}
    >
      <div className={cl("header")}>
        <img src={avatarUrl} className={cl("avatar")} alt="" />
        <div className={cl("user-info")}>
          <div className={cl("displayname")}><strong>{displayName}</strong></div>
          <div className={cl("channel-name")}>{guildName ? `${guildName} - #${channelName}` : channelName}</div>
        </div>
      </div>
      <div className={cl("content") + (usePrivacy && !revealed ? " " + cl("blurred") : "")}>
        <div dangerouslySetInnerHTML={{ __html: formatMentions(message.content) }} />
        {message.attachments?.length > 0 && (
          <div className={cl("attachments")}>{message.attachments.length} attachment{message.attachments.length !== 1 ? "s" : ""}</div>
        )}
      </div>
      <div className={cl("progress-container")}>
        <div
          className={cl("progress")}
          style={{
            width: `${(remaining / 5000) * 100}%`,
            backgroundColor: `hsl(${(remaining / 5000) * 120}, 80%, 50%)`,
          }}
        />
      </div>
    </div>
  );
};

export default definePlugin({
  name: "PingNotification",
  description: "In-app notifications for mentions, DMs, and replies",
  authors: [EquicordDevs.smuki],
  settings,

  activeNotifications: new Set(),
  messageHandler: null,
  styleElement: null,

  start() {
    this.injectStyles();

    this.messageHandler = ({ message }) => {
      if (!message?.channel_id) return;

      const channel = ChannelStore.getChannel(message.channel_id);
      const currentUser = UserStore.getCurrentUser();

      if (!channel || message.author?.id === currentUser.id) return;

      if (this.shouldNotify(message, channel, currentUser)) {
        this.showNotification(message, channel);
      }
    };

    FluxDispatcher.subscribe("MESSAGE_CREATE", this.messageHandler);
  },

  stop() {
    if (this.messageHandler) {
      FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.messageHandler);
      this.messageHandler = null;
    }

    this.activeNotifications.forEach(n => n?.parentNode?.removeChild(n));
    this.activeNotifications.clear();

    if (this.styleElement) {
      document.head.removeChild(this.styleElement);
      this.styleElement = null;
    }
  },

  shouldNotify(message, channel, currentUser) {
    const {
      preset,
      allowNotificationsInCurrentChannel,
      showDirectMessages,
      showReplies,
      showMentions,
      blockedChannels = "",
      blockedServers = ""
    } = settings.store;

    if (PresenceStore.getStatus(currentUser.id) === "dnd") return false;
    if (RelationshipStore.isBlocked(message.author.id)) return false;
    if (!allowNotificationsInCurrentChannel && channel.id === SelectedChannelStore.getChannelId()) return false;
    if (message.flags & 64) return false;

    if (preset === "custom") {
      const blockedChannelsList = blockedChannels.split(",").map(id => id.trim()).filter(Boolean);
      const blockedServersList = blockedServers.split(",").map(id => id.trim()).filter(Boolean);

      if (blockedChannelsList.includes(channel.id)) return false;
      if (channel.guild_id && blockedServersList.includes(channel.guild_id)) return false;
    }

    const isDM = channel.type === 1 || channel.type === 3;
    if (isDM) {
      if (preset === "custom" && !showDirectMessages) return false;
      return preset !== "admins";
    }

    if (message.message_reference?.message_id) {
      const referencedMessage = MessageStore.getMessage(
        message.message_reference.channel_id || channel.id,
        message.message_reference.message_id
      );

      if (referencedMessage?.author.id === currentUser.id) {
        if (preset === "custom") return showReplies;
        return preset === "all";
      }
    }

    if (preset === "friends") {
      return RelationshipStore.isFriend(message.author.id);
    }

    if (preset === "admins") {
      if (!channel.guild_id) return false;
      const guild = GuildStore.getGuild(channel.guild_id);
      const member = guild?.members?.[message.author.id];
      return member?.roles?.some(roleId => {
        const role = RoleStore.getRole(roleId);
        return role?.permissions & 8;
      }) || false;
    }

    if (preset === "direct" || (preset === "custom" && showMentions)) {
      return message.mentions?.some(u => u.id === currentUser.id) || false;
    }

    if (preset === "all") {
      return (
        message.mentions?.some(u => u.id === currentUser.id) ||
        message.mention_roles?.length > 0 ||
        message.mention_everyone
      );
    }

    return false;
  },

  showNotification(message, channel) {
    const notification = document.createElement("div");
    notification.className = cl("notification-container");

    ReactDOM.render(<NotificationComponent message={message} channel={channel} />, notification);

    document.body.appendChild(notification);
    this.activeNotifications.add(notification);
    this.adjustPositions();

    setTimeout(() => {
      if (notification?.parentNode) {
        notification.parentNode.removeChild(notification);
        this.activeNotifications.delete(notification);
        this.adjustPositions();
      }
    }, 5000);
  },

  adjustPositions() {
    let offset = 30;

    Array.from(this.activeNotifications).reverse().forEach(n => {
      const rect = n.getBoundingClientRect();
      n.style.position = "fixed";
      n.style.zIndex = "9999";
      n.style.bottom = offset + "px";
      n.style.right = "20px";
      offset += rect.height + 10;
    });
  },

  injectStyles() {
    if (this.styleElement) document.head.removeChild(this.styleElement);

    this.styleElement = document.createElement("style");
    this.styleElement.id = "vc-pn-styles";
    this.styleElement.textContent = `
      .${cl("notification")} {
        background: var(--background-tertiary);
        border-radius: 8px;
        padding: 16px;
        width: 340px;
        max-height: 200px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        transition: all 0.2s ease;
        overflow: hidden;
        position: relative;
        margin-bottom: 10px;
        cursor: pointer;
        animation: ${cl("popup")} 0.3s ease-out;
      }
      @keyframes ${cl("popup")} {
        0% { transform: translateY(20px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .${cl("header")} {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      .${cl("avatar")} {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        margin-right: 10px;
      }
      .${cl("user-info")} {
        flex: 1;
        overflow: hidden;
      }
      .${cl("displayname")} {
        font-weight: bold;
        color: var(--header-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .${cl("channel-name")} {
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .${cl("content")} {
        font-size: 14px;
        color: var(--text-normal);
        word-wrap: break-word;
        transition: filter 0.3s ease;
      }
      .${cl("content")}.${cl("blurred")} {
        filter: blur(5px);
      }
      .${cl("attachments")} {
        margin-top: 8px;
        font-size: 12px;
        color: var(--text-muted);
        font-style: italic;
      }
      .${cl("progress-container")} {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background-color: rgba(0, 0, 0, 0.2);
      }
      .${cl("progress")} {
        height: 100%;
        transition: width 0.1s linear;
      }
      .mention {
        background-color: rgba(114, 137, 218, 0.1);
        color: var(--text-link);
        border-radius: 3px;
        padding: 0 2px;
      }
    `;

    document.head.appendChild(this.styleElement);
  }
});