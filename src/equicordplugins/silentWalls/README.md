# SilentWalls

Sends your first message normally, then adds Discord's `@silent` prefix to consecutive messages sent within 30 seconds of your previous message. The time window is configurable.

Someone else replying or a pause longer than the time window makes your next message send normally again. Detection uses the channel's message history, so each conversation is handled separately.

Applies to DMs and group DMs by default. Disable `dmsOnly` to include server channels. Messages already starting with `@silent` are left alone.
