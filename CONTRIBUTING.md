# Introduction

> [!NOTE]
> **AI Usage Notice**
>
> Your contribution must be majority human written! Some AI assistance like inline suggestions is acceptable, but "vibecoded" contributions are not welcome.
> Also **do not** use AI to generate your pull request description, README.md or in communication. Ignoring this rule will lead to a permanent block.

Equicord is a community project and welcomes any kind of contribution from anyone!

We have development documentation for new contributors, which can be found at <https://docs.equicord.org>.

> [!IMPORTANT]
> All contributions must follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to contribute

Contributions are submitted through pull requests. If you are new to Git or GitHub, we recommend reading [this guide](https://opensource.com/article/19/7/create-pull-request-github).

Pull requests can be made either to the `main` or the `dev` branch. However, unless you're an advanced user, I recommend sticking to `main`.
This is because the dev branch might contain unstable changes and be force pushed frequently, which could cause conflicts in your pull request.

Before working on a major change, I highly recommend opening a feature request for it, making sure to check "I am willing to work on this myself",
so we can discuss before you invest time. Alternatively, you can also do so in our Discord server's development
channels. This saves you a lot of time in case your feature is considered too niche or rejected for any other reason.

## Writing a Plugin

Developing a plugin is the primary way to contribute.

Before starting your plugin:

- Consider if this plugin would be useful to a large portion of the userbase. We do not accept niche plugins
- Check existing pull requests to see if someone is already working on a similar plugin
- Familarise yourself with our plugin rules below to ensure your plugin is not banned

- Join our Discord server.
- Check existing pull requests to avoid duplicate work.
- Check the [plugin requests tracker](https://discord.com/channels/1173279886065029291/1419347113745059961) to see if your idea already exists or was rejected.
- If no request exists, open one and clearly state that you want to work on it yourself.
- Wait for feedback before starting development, as some ideas may not be accepted or may need adjustments.
- Familiarize yourself with the plugin rules below.

> [!WARNING]
> Skipping these steps may result in your plugin being rejected, even if it is technically correct.

## Plugin Rules

To keep Equicord stable, secure and maintainable, all plugins must follow these rules:

1. No simple slash-command plugins (e.g. `/cat`). If applicable, create a [user-installable Discord app](https://discord.com/developers/docs/change-log#userinstallable-apps-preview) instead.
2. No simple text replacement plugins (the built-in TextReplace plugin already covers this).
3. No raw DOM manipulation - always use proper patches and React.
4. No FakeDeafen or FakeMute functionality.
5. No StereoMic-related plugins.
6. No plugins that only hide or redesign UI elements (use CSS for that). This rule may be negotiable.
7. No plugins that interact with specific third-party Discord bots (official Discord apps are allowed).
8. No selfbots or API abuse (auto-replies, animated statuses, message pruning, Nitro snipers, etc.).
9. No untrusted third-party APIs (well-known services like Google or GitHub are acceptable).
10. No plugins that require users to provide their own API keys.
11. Do not introduce new dependencies unless they are strictly necessary and well justified.

**Plugins that violate any of these rules will not be accepted.**

## Improving Equicord Itself

If you want to improve Equicord beyond plugins, such as internal features or performance improvements, you are welcome to open a feature request so it can be discussed.

Bug fixes, refactors, and documentation improvements are also highly appreciated!

## Helping the Community

We have an open support channel in our [Discord community](https://equicord.org/discord).
Helping out users there is always appreciated! The more, the merrier.
