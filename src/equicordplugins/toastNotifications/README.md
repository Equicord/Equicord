# ToastNotifications

Displays a pop-up _'toast'_ notification in a configurable corner of the screen whenever you receive a message in a DM, group DM, or server channel.

- [Configuration](#-configuration)
    - [Notification Position](#notification-position)
    - [Notification Timeout](#notification-timeout)
    - [Opacity](#opacity)
    - [Max Notifications](#max-notifications)
    - [Disable In Streamer Mode](#disable-in-streamer-mode)
    - [Respect Do Not Disturb](#respect-do-not-disturb)
    - [Direct Messages](#direct-messages)
    - [Group Messages](#group-messages)
    - [Friend Server Notifications](#friend-server-notifications)
    - [Ignored Users](#ignored-users)
    - [Notify For](#notify-for)
- [Theming](#-theming)

## 🔧 Configuration

### Notification Position

Determines which corner of your screen the notification will appear in, valid options are:

- Bottom Left _(Default)_
- Bottom Right
- Top Left
- Top Right

## Notification Timeout

The duration _(in seconds)_ for which notifications will be shown on the screen before disappearing, a progress bar is shown below notifications to indicate how long is left before they disappear.

> [!NOTE]
> You can hover over a notification while it is visible to pause the timeout and keep it on screen indefinitely until you move your mouse away from it again.

### Opacity

The visible opacity of the notification message to display, acceptable value is between 10% and 100%.

### Max Notifications

The maximum number of concurrent notifications to display on the screen at once, if this limit is reached, the oldest notification will be removed from the screen to make room for the new one.

### Disable In Streamer Mode

When enabled, notifications are suppressed while Discord's streamer mode is active.

### Respect Do Not Disturb

If enabled, notifications will not be shown when your Discord status is set to Do Not Disturb mode.

### Direct Messages

Toggle notifications for messages sent in direct messages.

### Group Messages

Toggle notifications for messages sent in group DMs.

### Friend Server Notifications

When enabled, messages from friends in shared servers always trigger a notification regardless of the channel's notification level.

### Ignored Users

A comma-separated list of Discord User IDs whose messages will not trigger a notification. This is useful for ignoring messages from users who are not important to you or who send too many messages. Example value:

- `123456789012345678,234567890123456789,345678901234567890`

The above example will ignore messages from the users with IDs `123456789012345678`, `234567890123456789`, and `345678901234567890`. You can find a user's ID by right-clicking on their name in Discord and selecting <kbd>Copy ID</kbd> _(Developer Mode must be enabled in Discord settings)_.

### Notify For

A comma-separated list of channel IDs to **always** receive notifications from, regardless of the channel's notification level or mute state.

---

## 🎨 Theming

This plugin supports theming and exposes a number of CSS variables to allow you to customize the appearance of notifications.

| CSS Variable                                      | Description                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `--vc-toast-notifications-background-color`           | Background color of the notification card.                                 |
| `--vc-toast-notifications-text-color`                 | Default text color inside notifications.                                   |
| `--vc-toast-notifications-border-radius`              | Border radius of the notification card.                                    |
| `--vc-toast-notifications-width`                      | Width of the card. Defaults to `fit-content`.                              |
| `--vc-toast-notifications-min-width`                  | Minimum width to use regardless of content.                                |
| `--vc-toast-notifications-max-width`                  | Maximum width a single notification can grow to.                           |
| `--vc-toast-notifications-min-height`                 | Minimum height to use regardless of content.                               |
| `--vc-toast-notifications-max-height`                 | Maximum height a single notification can grow to.                          |
| `--vc-toast-notifications-padding`                    | Inner padding of the notification card.                                    |
| `--vc-toast-notifications-position-offset`            | Distance from the screen corner the stack is anchored at.                  |
| `--vc-toast-notifications-title-color`                | Color of titles (system notifications) and context headers (group/server). |
| `--vc-toast-notifications-title-font-size`            | Font size of titles and context headers.                                   |
| `--vc-toast-notifications-title-font-weight`          | Font weight of titles and context headers.                                 |
| `--vc-toast-notifications-title-line-height`          | Line height of titles and context headers.                                 |
| `--vc-toast-notifications-image-height`               | Height of the avatar/icon shown in system notifications.                   |
| `--vc-toast-notifications-image-width`                | Width of the avatar/icon shown in system notifications.                    |
| `--vc-toast-notifications-image-border-radius`        | Border radius of the avatar/icon in system notifications.                  |
| `--vc-toast-notifications-close-button-color`         | Color of the dismiss (X) button.                                           |
| `--vc-toast-notifications-close-button-hover-color`   | Color of the dismiss (X) button on hover.                                  |
| `--vc-toast-notifications-close-button-opacity`       | Opacity of the dismiss (X) button at rest.                                 |
| `--vc-toast-notifications-close-button-hover-opacity` | Opacity of the dismiss (X) button on hover.                                |
| `--vc-toast-notifications-progressbar-height`         | Height of the progress bar shown at the bottom of notifications.           |
| `--vc-toast-notifications-progressbar-color`          | Color of the progress bar.                                                 |

