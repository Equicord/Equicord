import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { Devs, EquicordDevs } from "@utils/constants";
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
import { Message } from "discord-types/general";

const cl = classNameFactory("vc-pn-");

const settings = definePluginSettings({
  notificationMode: {
    type: OptionType.SELECT,
    default: "automatic",
    options: [
      { label: "Automatic (Follow Discord Settings)", value: "automatic" },
      { label: "All Mentions", value: "all" },
      { label: "Direct Mentions Only", value: "direct" },
      { label: "Custom", value: "custom" },
    ],
    description: "Notification Mode",
  },
  showDirectMessages: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Show notifications for Direct Messages",
  },
  showReplies: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Show notifications for Replies",
  },
  showMentions: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Show notifications for Mentions",
  },
  duration: {
    type: OptionType.NUMBER,
    default: 15,
    description: "Notification Duration (seconds)",
  },
  popupLocation: {
    type: OptionType.SELECT,
    default: "bottomRight",
    options: [
      { label: "Top Left", value: "topLeft" },
      { label: "Top Centre", value: "topCentre" },
      { label: "Top Right", value: "topRight" },
      { label: "Bottom Left", value: "bottomLeft" },
      { label: "Bottom Right", value: "bottomRight" },
    ],
    description: "Notification Position",
  },
  allowNotificationsInCurrentChannel: {
    type: OptionType.BOOLEAN,
    default: false,
    description: "Show notifications in current channel",
  },
  hideDND: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Hide notifications when in Do Not Disturb",
  },
  closeOnRightClick: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Right-click to close notification",
  },
  swipeToClose: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Swipe to close notification",
  },
  showTimer: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Show countdown timer",
  },
  maxWidth: {
    type: OptionType.NUMBER,
    default: 370,
    description: "Maximum width (px)",
  },
  maxHeight: {
    type: OptionType.NUMBER,
    default: 300,
    description: "Maximum height (px)",
  },
  privacyMode: {
    type: OptionType.BOOLEAN,
    default: false,
    description: "Privacy Mode (hover to reveal content)",
  },
  privacyModeNSFW: {
    type: OptionType.BOOLEAN,
    default: true,
    description: "Apply Privacy Mode to NSFW channels",
  },
  mentionColor: {
    type: OptionType.STRING,
    default: "#7289DA",
    description: "Color for direct mentions",
  },
  roleMentionColor: {
    type: OptionType.STRING,
    default: "#43b581",
    description: "Color for role mentions",
  },
  blockedUsers: {
    type: OptionType.STRING,
    default: "",
    description: "Blocked Users (comma separated IDs)",
  },
  blockedChannels: {
    type: OptionType.STRING,
    default: "",
    description: "Blocked Channels (comma separated IDs)",
  },
  blockedServers: {
    type: OptionType.STRING,
    default: "",
    description: "Blocked Servers (comma separated IDs)",
  },
});

interface NotificationProps {
  message: Message;
  channel: any;
  duration: number;
  showTimer: boolean;
  closeOnRightClick: boolean;
  swipeToClose: boolean;
  privacyMode: boolean;
  privacyModeNSFW: boolean;
  mentionColor: string;
  roleMentionColor: string;
}

const NotificationComponent: React.FC<NotificationProps> = ({
  message,
  channel,
  duration,
  showTimer,
  closeOnRightClick,
  swipeToClose,
  privacyMode,
  privacyModeNSFW,
  mentionColor,
  roleMentionColor
}) => {
  const [remaining, setRemaining] = useState(duration * 1000);
  const [revealed, setRevealed] = useState(!privacyMode);
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const currentUser = UserStore.getCurrentUser();
  
  const user = UserStore.getUser(message.author.id) || UserUtils.getUser(message.author.id) || { username: "Unknown", globalName: "" };
  const displayName = user.globalName || user.username || "Unknown";
  const avatarUrl = user.getAvatarURL ? user.getAvatarURL(undefined, 128) : "";
  
  const isNSFW = channel.nsfw || false;
  const usePrivacy = privacyMode || (privacyModeNSFW && isNSFW);
  
  const guild = channel.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
  const channelName = channel.name || (channel.recipients ? "Direct Message" : "Unknown Channel");
  const guildName = guild ? guild.name : (channel.recipients ? "DM" : "");
  
  const handleMouseEnter = () => {
    if (usePrivacy) {
      setRevealed(true);
    }
  };
  
  const handleMouseLeave = () => {
    if (usePrivacy) {
      setRevealed(false);
    }
  };
  
  const handleTouchStart = (e) => {
    if (swipeToClose) {
      setStartX(e.touches[0].clientX);
    }
  };
  
  const handleTouchMove = (e) => {
    if (swipeToClose) {
      const currentX = e.touches[0].clientX;
      const diff = currentX - startX;
      setOffsetX(diff);
    }
  };
  
  const handleTouchEnd = () => {
    if (swipeToClose && Math.abs(offsetX) > 100) {
      if (ref.current?.parentNode) {
        ref.current.parentNode.removeChild(ref.current);
      }
    } else {
      setOffsetX(0);
    }
  };
  
  const formatMentions = (content) => {
    if (!content) return "";
    
    const mentionRegex = /<@!?(\d+)>/g;
    const roleMentionRegex = /<@&(\d+)>/g;
    
    let formattedContent = content.replace(mentionRegex, (match, id) => {
      const mentionedUser = UserStore.getUser(id);
      const name = mentionedUser ? (mentionedUser.globalName || mentionedUser.username) : id;
      return `<span style="color: ${mentionColor}; font-weight: bold;">@${name}</span>`;
    });
    
    formattedContent = formattedContent.replace(roleMentionRegex, (match, id) => {
      let roleName = "role";
      if (guild && guild.roles) {
        const role = RoleStore.getRole(id) || guild.roles[id];
        if (role) roleName = role.name;
      }
      return `<span style="color: ${roleMentionColor}; font-weight: bold;">@${roleName}</span>`;
    });
    
    return formattedContent;
  };

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(prev - 100, 0));
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
        NavigationRouter.transitionTo(
          `/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`
        );
        if (ref.current?.parentNode) {
          ref.current.parentNode.removeChild(ref.current);
        }
      }}
      onContextMenu={(e) => {
        if (closeOnRightClick) {
          e.preventDefault();
          if (ref.current?.parentNode) {
            ref.current.parentNode.removeChild(ref.current);
          }
        }
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={cl("header")}>
        <img src={avatarUrl} className={cl("avatar")} alt="avatar" />
        <div className={cl("user-info")}>
          <div className={cl("displayname")}>
            <strong>{displayName}</strong>
          </div>
          <div className={cl("channel-name")}>
            {guildName ? `${guildName} - #${channelName}` : channelName}
          </div>
        </div>
      </div>
      <div className={cl("content") + (usePrivacy && !revealed ? " " + cl("blurred") : "")}>
        <div dangerouslySetInnerHTML={{ __html: formatMentions(message.content) }} />
        {message.attachments && message.attachments.length > 0 && (
          <div className={cl("attachments")}>
            {message.attachments.length} attachment{message.attachments.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
      {showTimer && (
        <div className={cl("progress-container")}>
          <div
            className={cl("progress")}
            style={{
              width: `${(remaining / (duration * 1000)) * 100}%`,
              backgroundColor: `hsl(${(remaining / (duration * 1000)) * 120}, 80%, 50%)`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default definePlugin({
  name: "PingNotification",
  description: "In-app notifications for mentions, DMs, and in-line replies",
  authors: [EquicordDevs.smuki], // https://betterdiscord.app/plugin/PingNotification i ported this, didnt make it myself
  settings,
  activeNotifications: new Set<HTMLElement>(),
  messageHandler: null,
  styleElement: null,

  start() {
    this.injectStyles();
    
    this.messageHandler = ({ message }: { message: Message }) => {
      try {
        if (!message || !message.channel_id) return;
        const channel = ChannelStore.getChannel(message.channel_id);
        const currentUser = UserStore.getCurrentUser();
        if (!channel || message.author?.id === currentUser.id) return;
        if (this.shouldNotify(message, channel, currentUser)) {
          this.showNotification(message, channel);
        }
      } catch (error) {
        console.error("[PingNotification] Error handling message:", error);
      }
    };
    
    FluxDispatcher.subscribe("MESSAGE_CREATE", this.messageHandler);
  },

  stop() {
    if (this.messageHandler) {
      FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.messageHandler);
      this.messageHandler = null;
    }
    
    this.activeNotifications.forEach((notification: HTMLElement) => {
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
    this.activeNotifications.clear();
    
    if (this.styleElement) {
      document.head.removeChild(this.styleElement);
      this.styleElement = null;
    }
  },

  shouldNotify(message: Message, channel: any, currentUser: any): boolean {
    const settingsStore = settings.store || {};
    const mode = settingsStore.notificationMode || "automatic";
    const hideDND = settingsStore.hideDND ?? true;
    const allowInCurrentChannel = settingsStore.allowNotificationsInCurrentChannel ?? false;
    const showDirectMessages = settingsStore.showDirectMessages ?? true;
    const showReplies = settingsStore.showReplies ?? true;
    const showMentions = settingsStore.showMentions ?? true;
    
    if (hideDND && PresenceStore.getStatus(currentUser.id) === "dnd") return false;
    if (RelationshipStore.isBlocked(message.author.id)) return false;
    if (!allowInCurrentChannel && channel.id === SelectedChannelStore.getChannelId()) return false;
    if (message.flags & 64) return false;
    
    const blockedUsers = (settingsStore.blockedUsers || "").split(",").map(id => id.trim()).filter(Boolean);
    const blockedChannels = (settingsStore.blockedChannels || "").split(",").map(id => id.trim()).filter(Boolean);
    const blockedServers = (settingsStore.blockedServers || "").split(",").map(id => id.trim()).filter(Boolean);
    
    if (blockedUsers.includes(message.author.id)) return false;
    if (blockedChannels.includes(channel.id)) return false;
    if (channel.guild_id && blockedServers.includes(channel.guild_id)) return false;
    
    const isDM = channel.type === 1 || channel.type === 3;
    
    if (isDM && !showDirectMessages) return false;
    
    if (message.message_reference && message.message_reference.message_id) {
      const referencedMessage = MessageStore.getMessage(
        message.message_reference.channel_id || channel.id,
        message.message_reference.message_id
      );
      
      if (referencedMessage && referencedMessage.author.id === currentUser.id) {
        return showReplies;
      }
    }
    
    if (mode === "direct" && showMentions) {
      return message.mentions?.some(u => u.id === currentUser.id) || false;
    }
    
    if (mode === "all" && showMentions) {
      return (
        message.mentions?.some(u => u.id === currentUser.id) || 
        message.mention_roles?.length > 0 ||
        message.mention_everyone
      );
    }
    
    if (mode === "automatic") {
      return true;
    }
    
    if (mode === "custom" && showMentions) {
      return message.mentions?.some(u => u.id === currentUser.id) || false;
    }
    
    return false;
  },

  showNotification(message: Message, channel: any) {
    const settingsStore = settings.store || {};
    const duration = settingsStore.duration ?? 15;
    const showTimer = settingsStore.showTimer ?? true;
    const closeOnRightClick = settingsStore.closeOnRightClick ?? true;
    const swipeToClose = settingsStore.swipeToClose ?? true;
    const privacyMode = settingsStore.privacyMode ?? false;
    const privacyModeNSFW = settingsStore.privacyModeNSFW ?? true;
    const mentionColor = settingsStore.mentionColor ?? "#7289DA";
    const roleMentionColor = settingsStore.roleMentionColor ?? "#43b581";
    
    const notification = document.createElement("div");
    notification.className = cl("notification-container");
    
    ReactDOM.render(
      <NotificationComponent 
        message={message} 
        channel={channel} 
        duration={duration}
        showTimer={showTimer}
        closeOnRightClick={closeOnRightClick}
        swipeToClose={swipeToClose}
        privacyMode={privacyMode}
        privacyModeNSFW={privacyModeNSFW}
        mentionColor={mentionColor}
        roleMentionColor={roleMentionColor}
      />, 
      notification
    );
    
    document.body.appendChild(notification);
    this.activeNotifications.add(notification);
    this.adjustPositions();

    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
        this.activeNotifications.delete(notification);
        this.adjustPositions();
      }
    }, duration * 1000);
  },

  adjustPositions() {
    const settingsStore = settings.store || {};
    const loc = settingsStore.popupLocation ?? "bottomRight";
    let offset = 30;
    const isTop = loc.startsWith("top");
    const isLeft = loc.endsWith("Left");
    const isCentre = loc.endsWith("Centre");
    
    Array.from(this.activeNotifications)
      .reverse()
      .forEach((notification: HTMLElement) => {
        const rect = notification.getBoundingClientRect();
        notification.style.position = "fixed";
        notification.style.zIndex = "9999";
        
        if (isTop) {
          notification.style.top = offset + "px";
          notification.style.bottom = "";
        } else {
          notification.style.bottom = offset + "px";
          notification.style.top = "";
        }
        
        if (isCentre) {
          notification.style.left = "50%";
          notification.style.transform = "translateX(-50%)";
        } else if (isLeft) {
          notification.style.left = "20px";
          notification.style.right = "";
        } else {
          notification.style.right = "20px";
          notification.style.left = "";
        }
        
        offset += rect.height + 10;
      });
  },

  injectStyles() {
    const settingsStore = settings.store || {};
    const maxWidth = settingsStore.maxWidth ?? 370;
    const maxHeight = settingsStore.maxHeight ?? 300;
    
    if (this.styleElement) {
      document.head.removeChild(this.styleElement);
    }
    
    this.styleElement = document.createElement("style");
    this.styleElement.id = "vc-pn-styles";
    this.styleElement.textContent = `
      .${cl("notification")} {
        background: var(--background-tertiary);
        border-radius: 8px;
        padding: 16px;
        width: ${maxWidth}px;
        max-height: ${maxHeight}px;
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
    `;
    
    document.head.appendChild(this.styleElement);
  },

  onSettingsUpdate() {
    this.injectStyles();
  }
});