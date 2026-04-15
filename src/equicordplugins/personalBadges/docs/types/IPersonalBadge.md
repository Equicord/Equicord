## IPersonalBadge

These are the current modifiable properties for all badges created with this plugin, an interface defined as `IPersonalBadge`.

| Property | Description | Default | Required?
| --- | --- | --- | --- |
| `image` | A **direct image link** that is set for the badge. I don't think the file type matters; feel free to use gifs, etc. | [`Icon`](https://i.imgur.com/3CQhzM6.png) | `false` |
| `tooltip` | The **tooltip / description** that appears when hovering over the badge. | `undefined` | `false` |
| `link` | A **link** that is opened upon clicking the badge. If this is not set by default, it will link to this repository. :] | [`GitHub`](https://github.com/YLohkuhl/personalBadges) | `false` |
| `position` | The **badge position** of which can be either `START` or `END`. It is also *case-insensitive*. | `START` | `false` |
| `squircle` | This modifies the default style properties to make it more of a **rounded square**... otherwise known as a **"squircle"**? | `false` | `true` |
| `global` | Whether or not the badge is **globally** visible. This just means it's added to everyone; *it will* override `guilds` and `users`. | `false` | `true` |
| `excluded` | An array of **strings** of which list **user IDs** to **not be included** in the badge. *This will* override `global`, `guilds` and `users`. | `[]` | `false` |
| `users` | An array of **strings** of which list **user IDs** to **be included** in the badge. *This will not* override anything. | `[]` | `false` |
| `guilds` | An array of **strings** of which list **guild IDs** to **be included** in the badge. *This will* override `users`. | `[]` | `false` |
