# AGENTS.md

A guide for coding agents working on **Equicord**, a Discord client mod.

---

## Project Overview

**Equicord** is a Discord client mod forked from [Vencord](https://github.com/Vendicated/Vencord). It modifies the Discord web client by patching webpack modules at runtime to inject custom functionality.

**Technology Stack:**
- **TypeScript** - Primary language with strict mode enabled
- **React** - UI components and plugin interfaces
- **Webpack Patching** - Runtime modification of Discord's bundled code

**Project Details:**
- **Package Manager:** pnpm (see package.json for version)
- **Plugin Count:** 300+ plugins
- **License:** GPL-3.0-or-later

**Repository Structure:**
- `src/` - Source code
- `src/plugins/` - Built-in plugins
- `src/equicordplugins/` - Equicord-specific plugins
- `src/utils/` - Utility functions
- `src/api/` - Plugin APIs

---

## Setup Commands

### Installation
- Install dependencies: `pnpm install --frozen-lockfile`
- Build: `pnpm build`
- Build for web: `pnpm buildWeb`
- Inject into desktop client: `pnpm inject`
- Uninject: `pnpm uninject`

### Development
- Start dev server (watch mode): `pnpm dev` or `pnpm watch`
- Watch web build: `pnpm watchWeb`
- Lint code: `pnpm lint`
- Fix lint issues: `pnpm lint:fix`
- Lint CSS: `pnpm lint-styles`
- Type check: `pnpm testTsc`

### Testing
- Full test suite: `pnpm test` (builds, type checks, lints, generates plugin JSON)
- Web test: `pnpm testWeb`
- Generate plugin list: `pnpm generatePluginJson`
- Generate Equicord plugin list: `pnpm generateEquicordPluginJson`
- Generate types: `pnpm generateTypes`

### Requirements
- Node.js >= 18
- pnpm (see package.json for version)

---

## Project Structure

```
src/
├── api/              # Plugin APIs (Settings, DataStore, Commands, etc.)
├── components/       # Reusable React components
├── debug/            # Debugging and reporter tools
├── equicordplugins/  # Equicord-specific plugins
├── main/             # Electron main process code
├── plugins/          # Vencord/upstream plugins
├── shared/           # Shared utilities
├── utils/            # Utility functions
└── webpack/          # Webpack patching system
    └── common/       # Discord exports (stores, components, utils)
```

**Path Aliases** (configured in tsconfig.json):
- `@api/*` → `./src/api/*`
- `@utils/*` → `./src/utils/*`
- `@components/*` → `./src/components/*`
- `@plugins/*` → `./src/plugins/*`
- `@equicordplugins/*` → `./src/equicordplugins/*`
- `@webpack/common` → `./src/webpack/common`
- `@shared/*` → `./src/shared/*`

---

## Code Style

**TypeScript:** Strict mode enabled. Use TypeScript inference - don't annotate obvious types.

**Formatting:**
- Double quotes (ESLint enforced)
- Semicolons required
- Single quotes only where escaping needed

**Patterns to Prefer:**
- `?.` optional chaining
- `??` nullish coalescing (never `||` for defaults)
- `const` over `let`
- Arrow functions
- Destructuring
- Template literals
- Object shorthand
- Array methods (`.map`, `.filter`, `.find`, `.some`)
- Early returns over nested conditions
- Flat over nested code

**Philosophy:**
- Less code is better - KISS over clever
- No comments unless explicitly requested
- Preserve existing comments (they contain important context)
- Delete dead code, never comment it out
- No overengineering or premature abstractions
- Trust TypeScript inference

**Text and Descriptions:**
- Plugin and setting descriptions: capital first letter, end with period.
- Error messages and toasts: natural human text, no dashes or robotic formatting.

```typescript
// GOOD
description: "Adds a button to copy message content."
showToast("Module not found");

// BAD
description: "adds a button to copy message content"
showToast("Module - not found");
```

**Performance:**
- `Map`/`Set` for frequent lookups, not arrays
- `.find()` / `.some()` not `.filter()[0]`
- No spread `...` in loops
- `Promise.all()` for parallel async

**Code Hygiene:**
- **Delete dead code**, don't comment it out. Git preserves history.
- **No overengineering.** No premature abstractions, no "just in case" handling, no features not requested. Three similar lines beats a one-use helper. If code can be half the size and do the same thing, it should be.
- **No bloat.** Flag unnecessary wrapper functions, redundant type annotations, excessive error handling for things that can't fail, useless try/catch around synchronous code, or 50 lines doing what 10 could do. Code should be lean.
- **No unused imports.** Every import must be referenced.
- **No logging in plugin code.** No `console.log/warn/error`, no `Logger`. Remove all logging statements.
- **No empty catch blocks.** Handle every error (show toast, return fallback, rethrow, etc.).

**Example - Good:**
```typescript
const getUser = (id: string) => {
    const user = UserStore.getUser(id);
    if (!user) return null;
    const { username, discriminator } = user;
    return `${username}#${discriminator}`;
};
```

**Example - Bad:**
```typescript
function getUser(id: string): string | null {
    const user = UserStore.getUser(id);
    if (user) {
        const username: string = user.username;
        const discriminator: string = user.discriminator;
        return username + "#" + discriminator;
    } else {
        return null;
    }
}
```

---

## Plugin Structure

**Place Equicord plugins in `src/equicordplugins/PluginName/`, upstream/Vencord plugins in `src/plugins/PluginName/`.**

Default export via `definePlugin` from `@utils/types`. Non-negotiable.

```typescript
import definePlugin from "@utils/types";
import { EquicordDevs } from "@utils/constants";

export default definePlugin({
    name: "PluginName",            // PascalCase, matches directory name
    description: "Does something.", // Capital first, period at end
    authors: [EquicordDevs.Name],   // EquicordDevs for new, Devs for upstream
});
```

**Settings** must use `definePluginSettings` from `@api/Settings`. Reject inline `options` objects.

```typescript
// GOOD
const settings = definePluginSettings({
    myOption: { type: OptionType.BOOLEAN, description: "Enables the feature.", default: true }
});
export default definePlugin({
    settings,
    // ...
});

// BAD
export default definePlugin({
    options: { myOption: { /* ... */ } }
});
```

**Prefer declarative APIs** over manual registration:
- `flux: { EVENT_NAME(data) {} }` not manual FluxDispatcher subscribe
- `contextMenus: { "nav-id": fn }` not manual addContextMenuPatch
- `chatBarButton: { render, icon }` not addChatBarButton
- `messagePopoverButton: { render, icon }` not addMessagePopoverButton
- `managedStyle` for CSS not manual enableStyle/disableStyle

**Reject deprecated fields:** `renderChatBarButton`, `renderMessagePopoverButton`, `options`

**Lifecycle balance:** anything registered in `start()` must be cleaned up in `stop()`.

---

## Forbidden Patterns

Flag these and suggest the fix:

| Bad | Good | Reason |
|-----|------|--------|
| `value !== null && value !== undefined` | `value` or `isNonNullish(value)` | Verbose |
| `array && array.length > 0` | `array.length` | Redundant check |
| `settings?.store?.value` | `settings.store.value` | Store is always defined |
| `value \|\| defaultValue` | `value ?? defaultValue` | `\|\|` falsifies `0`, `""`, `false` |
| `` `${classA} ${classB}` `` | `classes(classA, classB)` | Handles null/false gracefully |
| `"vc-plugin-class"` hardcoded | `cl("class")` via `classNameFactory` | Consistent, typo-proof |
| `console.log/warn/error` | Remove it | No logging in plugin code |
| `new Logger(...)` / `logger.log(...)` | Remove it | No logging in plugin code |
| `cdn.discordapp.com/avatars/...` | `IconUtils.getUserAvatarURL(user)` | Handles animated, sizing, CDN |
| `cdn.discordapp.com/icons/...` | `IconUtils.getGuildIconURL(...)` | Same |
| `cdn.discordapp.com/banners/...` | `IconUtils.getUserBannerURL(...)` | Same |
| `cdn.discordapp.com/emojis/...` | `IconUtils.getEmojiURL(...)` | Same |
| `/assets/*.png` default avatars | `IconUtils.getDefaultAvatarURL(id)` | Same |
| `/api/v9/...` or `/users/@me` | `Constants.Endpoints.*` or `RestAPI` | Endpoints change |
| `@api/Styles` for classNameFactory | `@utils/css` | `@api/Styles` is deprecated |
| `any` for Discord objects | Import from `@vencord/discord-types` | Type safety |
| `as unknown as` casting | Find the correct type | Unsafe |
| `React.memo()` | Remove it | Not needed |
| `React.cloneElement` / `React.isValidElement` / `React.Children` | Find another approach | Forbidden |
| `React.lazy(() => import(...))` | `LazyComponent` from `@utils/lazyReact` | Framework-integrated |
| Empty `catch {}` | Handle the error (toast, fallback, rethrow) | Silent failures |
| CSS-only plugins | Must have actual logic/patches | Not allowed |
| Commented-out dead code | Delete it | Git has history |
| `document.querySelector(...)` | Use webpack patches | DOM manipulation forbidden |
| `Vencord.Plugins.plugins["X"]` | `isPluginEnabled` + direct import | Proper interop |
| `plugin.started` check | `isPluginEnabled(plugin.name)` | Proper interop |
| Unexplained magic numbers | Named constants | Readability |
| Unused imports | Remove them | Cleanliness |

---

## Discord Types

Never use `any` for Discord objects. Import proper types:

```typescript
import { User, Channel, Guild, GuildMember, Message, Role } from "@vencord/discord-types";
```

Store types, component prop types, and action types are all available. Never use `as unknown as` casting as a workaround.

---

## CSS and Class Names

**Every plugin** must use `classNameFactory` from `@utils/css` for class names:

```typescript
import { classNameFactory } from "@utils/css";
const cl = classNameFactory("vc-my-plugin-");
cl("container")  // "vc-my-plugin-container"
```

**Combining classes** from different sources: use `classes()` from `@utils/misc`:

```typescript
className={classes(cl("wrapper"), someDiscordClass, isActive && cl("active"))}
```

---

## React

**Conditional rendering:** return `null`, never `undefined` or bare `return;`

**ErrorBoundary:** wrap complex components: `ErrorBoundary.wrap(MyComponent, { noop: true })`

**useEffect cleanup:** always return cleanup when subscribing to events, timers, or resources:

```typescript
useEffect(() => {
    const handler = () => { /* ... */ };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
}, []);
```

---

## Settings

- `settings.store.key` — reactive, auto-persists (React components)
- `settings.plain.key` — non-reactive raw value (performance-critical code)
- **Never** `settings.use()` with arrays in variables. Mutate then reassign instead.

---

## Patch Quality

Patches modify Discord's minified webpack modules. Stability is paramount.

- **One patch per concern.** Each replacement does one thing.
- **Surgical.** Match only what needs replacing, let `find` target the module.
- **No hardcoded minified vars.** Never `e`, `t`, `n`, `r`, `i`, `eD`, `eH` etc. Use `\i`.
- **Bounded gaps.** `.{0,50}` not `.+?` or `.*?` (unbounded = cross-match bugs).
- **No generic patterns.** `/className:\i/` alone is too broad. Add stable anchors.
- **No raw intl hashes.** Use `#{intl::KEY_NAME}` not `.aA4Vce`.
- **Capture groups only when reused** in replace via `$1`, `$2`.
- **`$&`** for append/prepend, **`$self`** for plugin method calls.

```typescript
// GOOD
patches: [{
    find: "#{intl::PIN_MESSAGE}),icon:",
    replacement: {
        match: /#{intl::PIN_MESSAGE}\)/,
        replace: "$self.getPinLabel(arguments[0]))"
    }
}]

// BAD
patches: [{
    find: "pinMessage",
    replacement: {
        match: /label:e\.pinned\?.+?pinMessage\)/,
        replace: "$self.getPinLabel(e))"
    }
}]
```

---

## Memory Leaks and Cleanup

Plugins that don't use patches don't require a Discord restart to apply. Their `start()` and `stop()` must work cleanly so users can toggle them on/off without leaking resources.

**Every `start()` must have a matching `stop()`.** If `start()` subscribes, registers, or creates anything, `stop()` must undo it. Common leaks to flag:

- Event listeners added but never removed (FluxDispatcher, DOM events, MessageEvents)
- Intervals/timeouts set but never cleared
- MutationObservers created but never disconnected
- Context menu patches added but never removed (use declarative `contextMenus` instead)
- Chat bar buttons added but never removed (use declarative `chatBarButton` instead)
- Styles enabled but never disabled (use `managedStyle` instead)
- Flux subscriptions without corresponding unsubscriptions

**Prefer declarative APIs** that handle cleanup automatically: `flux`, `contextMenus`, `chatBarButton`, `messagePopoverButton`, `managedStyle`. These don't need manual cleanup.

**useEffect must return cleanup** when it creates subscriptions, timers, observers, or any persistent resource. No exceptions.

**Watch for stale closures and references.** If a plugin stores references to DOM nodes, channels, or users in module scope, check that they're nulled out in `stop()`.

```typescript
// GOOD — clean start/stop, no leaks
start() {
    this.interval = setInterval(this.update, 5000);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
},
stop() {
    clearInterval(this.interval);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
}

// BAD — leaks interval and listener forever
start() {
    setInterval(this.update, 5000);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
},
stop() {}
}
```

---

## Plugin Interop

Use the correct import path based on plugin location:
- `@equicordplugins/pluginName` for Equicord plugins
- `@plugins/pluginName` for Vencord/upstream plugins

```typescript
// GOOD - Equicord plugin
import { isPluginEnabled } from "@api/PluginManager";
import myEquicordPlugin from "@equicordplugins/myEquicordPlugin";
if (!isPluginEnabled(myEquicordPlugin.name)) return null;
myEquicordPlugin.someFunction();

// GOOD - Vencord plugin
import vencordPlugin from "@plugins/vencordPlugin";
if (!isPluginEnabled(vencordPlugin.name)) return null;
vencordPlugin.someFunction();

// BAD
Vencord.Plugins.plugins["OtherPlugin"].someFunction();
(somePlugin as unknown as { method(): void }).method();
```

---

## Platform-Specific Plugins

Plugins can target specific platforms by using directory suffixes:

- `pluginName.desktop/` - Desktop client only
- `pluginName.web/` - Web browser only
- `pluginName.discordDesktop/` - Discord desktop client only

Example: `src/plugins/youtubeAdblock.desktop/index.ts` only runs on desktop clients.

Use these when a plugin relies on APIs or features only available on specific platforms.

---

## Built-in Utilities Reference

If a PR reimplements any of these, flag it. They already exist:

**@utils/misc:** `classes`, `sleep`, `isObject`, `isObjectEmpty`, `parseUrl`, `pluralise`, `identity`
**@utils/guards:** `isTruthy`, `isNonNullish`
**@utils/text:** `formatDuration`, `formatDurationMs`, `humanFriendlyJoin`, `makeCodeblock`, `toInlineCode`, `escapeRegExp`
**@utils/discord:** `getCurrentChannel`, `getCurrentGuild`, `getIntlMessage`, `openPrivateChannel`, `insertTextIntoChatInputBox`, `sendMessage`, `copyWithToast`, `openUserProfile`, `fetchUserProfile`, `getUniqueUsername`, `openInviteModal`
**@utils/css:** `classNameFactory`, `classNameToSelector`
**@utils/clipboard:** `copyToClipboard`
**@utils/modal:** `openModal`, `closeModal`, `ModalRoot`, `ModalHeader`, `ModalContent`, `ModalFooter`, `ModalCloseButton`
**@utils/margins:** `Margins.top8`, `.top16`, `.bottom8`, `.bottom16` etc.
**@utils/web:** `saveFile`, `chooseFile`
**@utils/lazy:** `proxyLazy`, `makeLazy`
**@utils/lazyReact:** `LazyComponent`
**@utils/react:** `useAwaiter`, `useForceUpdater`, `useTimer`
**@api/DataStore:** `get`, `set`, `del` (IndexedDB, async)
**@api/Commands:** `sendBotMessage`, `findOption`

**@webpack/common:**
- Stores: `UserStore`, `GuildStore`, `ChannelStore`, `GuildMemberStore`, `SelectedChannelStore`, `SelectedGuildStore`, `PresenceStore`, `RelationshipStore`, `MessageStore`, `EmojiStore`, `ThemeStore`, `PermissionStore`, `VoiceStateStore`, 30+ more
- Actions: `RestAPI`, `FluxDispatcher`, `MessageActions`, `NavigationRouter`, `ChannelRouter`, `ChannelActionCreators`, `SettingsRouter`
- Utils: `Constants` (`.Endpoints`), `SnowflakeUtils`, `Parser`, `PermissionsBits`, `moment`, `lodash`, `IconUtils`, `ColorUtils`, `ImageUtils`, `DateUtils`, `UsernameUtils`, `DisplayProfileUtils`
- Components: `Tooltip`, `TextInput`, `TextArea`, `Select`, `Slider`, `Avatar`, `Menu`, `Popout`, `ScrollerThin`, `Timestamp`, `MaskedLink`, `ColorPicker`
- Toasts: `Toasts`, `showToast`
- React: `useState`, `useEffect`, `useCallback`, `useStateFromStores`

**@webpack finders:** `findByPropsLazy`, `findByCodeLazy`, `findStoreLazy`, `findComponentByCodeLazy`, `findExportedComponentLazy`

**@components/:** `ErrorBoundary`, `Flex`, `Button`, `Paragraph`, `Heading`, `BaseText`, `Span`, `ErrorCard`, `Link`, `CodeBlock`, `FormSwitch`

---

## Ethical Guidelines

Plugins that facilitate deceptive or malicious behavior are not accepted:

- **No fake deafen/mute plugins** - Deceiving other users about your audio state
- **No trolling plugins** - Any plugin designed primarily to annoy, deceive, or harass other users
- **No selfbot/API abuse** - Auto-replies, animated statuses, message pruning, Nitro snipers, etc.

Some exceptions may apply for legitimate accessibility or moderation use cases. When in doubt, ask first.

---

## Plugin Acceptance Rules

Instant reject if plugin:

1. Is a simple slash-command (use Discord user-installable app instead)
2. Is simple text replacement (use built-in TextReplace plugin)
3. Uses raw DOM manipulation
4. Is UI-only hide/redesign (use CSS - negotiable in rare cases)
5. Targets specific third-party Discord bots (official Discord apps are fine)
6. Uses untrusted third-party APIs (well-known services like Google, GitHub are acceptable)
7. Requires users to provide their own API keys
8. Adds new dependencies without strict justification

Additionally, see [Ethical Guidelines](#ethical-guidelines) for behavioral restrictions.

---

## Testing

Run `pnpm lint` and `pnpm build` before committing. Ensure no type errors.

---

## PR Guidelines

- Title format: `[PluginName] Description`
- Always run lint and build before committing
- Delete dead code instead of commenting
- No logging in plugin code

---

## Git Workflow

- **Never commit directly to `main`.** The main branch is protected.
- **Never commit directly to your fork's `dev` branch.** This is an antipattern.
- **Always create a feature branch from `dev`** in your fork for each change.
- Feature branch naming: `feature/plugin-name` or `fix/plugin-name`
- Keep commits atomic and focused on a single change
- Squash commits before merging if they address the same issue

**Example workflow:**
1. Fork the repository
2. Create feature branch from `dev`: `git checkout -b feature/my-plugin`
3. Make changes and commit
4. Push to your fork
5. Open PR against upstream's `dev` branch

---
