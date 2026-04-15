## IPBadgeCategory

These are the current modifiable properties for all categories created with this plugin, an interface defined as `IPBadgeCategory`.

| Property | Description | Default | Required?
| --- | --- | --- | --- |
| `icon` | A **direct image link** that is set for the category. I don't think the file type matters; feel free to use gifs, etc. | [`Icon`](https://i.imgur.com/8D4hCSK.png) | `false` |
| `name` | The **name** of the category. This has a character limit of **20** and will be cut off if any longer. | `None` | `true` |
| `badges` | An array of **objects** of which list [`IPersonalBadge`](../types/IPersonalBadge.md)s to **be contained** within the category. They're automatically imported & registered upon importing the category. | `[]` | `false` |
