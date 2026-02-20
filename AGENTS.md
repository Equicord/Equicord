# AGENTS.md

**IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.** When uncertain about APIs, patterns, or existing implementations, read the relevant source files rather than relying on assumptions.

---

## Quick Reference

| Task | Command/Location |
|------|------------------|
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build` |
| Dev/Watch | `pnpm dev` |
| Lint | `pnpm lint` |
| Type check | `pnpm testTsc` |
| Full test | `pnpm test` |
| New Equicord plugin | `src/equicordplugins/PluginName/index.ts` |
| New Vencord plugin | `src/plugins/PluginName/index.ts` |

**Key Files Index:**
| Need | File |
|------|------|
| Plugin types | `src/utils/types.ts` |
| Settings API | `src/api/Settings.ts` |
| Constants/devs | `src/utils/constants.ts` |
| CSS utilities | `src/utils/css.ts` |
| Webpack common exports | `src/webpack/common/*.ts` |
| Example plugins | `src/plugins/*/index.ts` or `src/equicordplugins/*/index.ts` |
| Discord types | `@vencord/discord-types` (external) |

---

## Project Overview

**Equicord** is a Discord client mod forked from [Vencord](https://github.com/Vendicated/Vencord). It modifies the Discord web client by patching webpack modules at runtime to inject custom functionality.

**Technology Stack:** TypeScript (strict), React, Webpack patching
**Package Manager:** pnpm | **License:** GPL-3.0-or-later

---

## Workflow

**Before writing code:**
1. Explore relevant source files to understand existing patterns
2. Check the Key Files Index for API/type references
3. Look at similar plugins for examples
4. Then proceed with implementation

This "explore first, then act" approach produces better results than jumping straight to implementation.

---

## Setup Commands

| Command | Description |
|---------|-------------|
| `pnpm install --frozen-lockfile` | Install dependencies |
| `pnpm build` | Build project |
| `pnpm buildWeb` | Build for web |
| `pnpm dev` / `pnpm watch` | Start dev server (watch mode) |
| `pnpm watchWeb` | Watch web build |
| `pnpm lint` | Lint code |
| `pnpm lint:fix` | Fix lint issues |
| `pnpm lint-styles` | Lint CSS |
| `pnpm testTsc` | Type check |
| `pnpm test` | Full test suite (builds, type checks, lints, generates plugin JSON) |
| `pnpm generatePluginJson` | Generate plugin list |
| `pnpm generateEquicordPluginJson` | Generate Equicord plugin list |

**Requirements:** Node.js >= 18, pnpm (see package.json for version)

---

## Code Style

**TypeScript:** Strict mode. Use inference - don't annotate obvious types.

**Formatting:** Double quotes, semicolons required, single quotes only for escaping.

**Patterns:** `?.` optional chaining, `??` nullish coalescing (never `||` for defaults), `const` over `let`, arrow functions, destructuring, template literals, early returns, flat code.

**Philosophy:** Less code is better. No comments unless requested. Delete dead code, never comment it out. No overengineering or premature abstractions. Trust TypeScript inference.

**Text:** Plugin/setting descriptions: capital first letter, end with period. Error messages: natural human text, no robotic formatting.

**Performance:** `Map`/`Set` for lookups, `.find()`/`.some()` not `.filter()[0]`, no spread in loops, `Promise.all()` for parallel async.

**Hygiene:** Delete dead code. No unused imports. No logging (`console.log`, `Logger`). No empty catch blocks.

---

## Plugin Structure

**Place Equicord plugins in `src/equicordplugins/PluginName/`, upstream/Vencord plugins in `src/plugins/PluginName/`.**

```typescript
import definePlugin from "@utils/types";
import { EquicordDevs } from "@utils/constants";

export default definePlugin({
    name: "PluginName",            // PascalCase, matches directory name
    description: "Does something.", // Capital first, period at end
    authors: [EquicordDevs.Name],   // EquicordDevs for new, Devs for upstream
});
```

**Settings:** Use `definePluginSettings` from `@api/Settings`. Reject inline `options` objects.

**Prefer declarative APIs:** `flux`, `contextMenus`, `chatBarButton`, `messagePopoverButton`, `managedStyle` instead of manual registration.

**Reject deprecated fields:** `renderChatBarButton`, `renderMessagePopoverButton`, `options`

**Lifecycle:** Anything registered in `start()` must be cleaned up in `stop()`.

---

## Forbidden Patterns

| Bad | Good | Reason |
|-----|------|--------|
| `value !== null && value !== undefined` | `value` or `isNonNullish(value)` | Verbose |
| `array && array.length > 0` | `array.length` | Redundant |
| `settings?.store?.value` | `settings.store.value` | Store always defined |
| `value \|\| defaultValue` | `value ?? defaultValue` | `\|\|` falsifies `0`, `""`, `false` |
| `` `${classA} ${classB}` `` | `classes(classA, classB)` | Handles null/false |
| `"vc-plugin-class"` hardcoded | `cl("class")` via `classNameFactory` | Typo-proof |
| `console.log/warn/error` | Remove it | No logging |
| `cdn.discordapp.com/...` | `IconUtils.*` methods | Handles animated, sizing |
| `/api/v9/...` | `Constants.Endpoints.*` | Endpoints change |
| `@api/Styles` | `@utils/css` | Deprecated |
| `any` for Discord objects | Import from `@vencord/discord-types` | Type safety |
| `as unknown as` | Find correct type | Unsafe |
| `React.memo()` | Remove it | Not needed |
| `React.cloneElement/isValidElement/Children` | Find another approach | Forbidden |
| `React.lazy(() => import(...))` | `LazyComponent` | Framework-integrated |
| Empty `catch {}` | Handle error | Silent failures |
| CSS-only plugins | Must have logic/patches | Not allowed |
| `document.querySelector(...)` | Use webpack patches | DOM forbidden |
| `Vencord.Plugins.plugins["X"]` | `isPluginEnabled` + import | Proper interop |
| `plugin.started` | `isPluginEnabled(plugin.name)` | Proper interop |
| Unexplained magic numbers | Named constants | Readability |
| Unused imports | Remove them | Cleanliness |

---

## CSS, React, Settings

**CSS:** Use `classNameFactory` from `@utils/css`: `const cl = classNameFactory("vc-my-plugin-");` Combine with `classes()` from `@utils/misc`.

**React:** Return `null` for conditional rendering, never `undefined`. Wrap complex components with `ErrorBoundary.wrap()`. useEffect must return cleanup for subscriptions/timers.

**Settings:** `settings.store.key` (reactive), `settings.plain.key` (non-reactive). Never `settings.use()` with arrays in variables.

---

## Patch Quality

Patches modify Discord's minified webpack modules. Stability is paramount.

- **One patch per concern.** Each replacement does one thing.
- **Surgical.** Match only what needs replacing, let `find` target the module.
- **No hardcoded minified vars.** Use `\i`, never `e`, `t`, `n`, `r`, `i`, `eD`, `eH`.
- **Bounded gaps.** `.{0,50}` not `.+?` or `.*?`.
- **No generic patterns.** Add stable anchors.
- **No raw intl hashes.** Use `#{intl::KEY_NAME}`.
- **`$&`** for append/prepend, **`$self`** for plugin method calls.

---

## Memory Leaks

**Every `start()` must have matching `stop()`.** Common leaks: event listeners, intervals/timeouts, MutationObservers, context menu patches, chat bar buttons, styles, Flux subscriptions.

**Prefer declarative APIs** that handle cleanup automatically: `flux`, `contextMenus`, `chatBarButton`, `messagePopoverButton`, `managedStyle`.

**useEffect must return cleanup** for subscriptions, timers, observers, or any persistent resource.

---

## Plugin Interop

- `@equicordplugins/pluginName` for Equicord plugins
- `@plugins/pluginName` for Vencord/upstream plugins

Use `isPluginEnabled(plugin.name)` to check if enabled. Never access `Vencord.Plugins.plugins["X"]` directly.

---

## Platform-Specific Plugins

Directory suffixes: `pluginName.desktop/`, `pluginName.web/`, `pluginName.discordDesktop/`

---

## Built-in Utilities

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

**@webpack/common:** Stores (`UserStore`, `GuildStore`, `ChannelStore`, 30+ more), Actions (`RestAPI`, `FluxDispatcher`, `MessageActions`, `NavigationRouter`), Utils (`Constants.Endpoints`, `SnowflakeUtils`, `Parser`, `PermissionsBits`, `moment`, `lodash`, `IconUtils`), Components (`Tooltip`, `TextInput`, `Select`, `Avatar`, `Menu`, `Popout`), Toasts (`Toasts`, `showToast`)

**@webpack finders:** `findByPropsLazy`, `findByCodeLazy`, `findStoreLazy`, `findComponentByCodeLazy`, `findExportedComponentLazy`

**@components/:** `ErrorBoundary`, `Flex`, `Button`, `Paragraph`, `Heading`, `BaseText`, `Span`, `ErrorCard`, `Link`, `CodeBlock`, `FormSwitch`

---

## Ethical Guidelines & Acceptance Rules

**Not accepted:** Fake deafen/mute, trolling plugins, selfbot/API abuse (auto-replies, animated statuses, message pruning, Nitro snipers).

**Instant reject:** Simple slash-commands, text replacement, DOM manipulation, UI-only hide/redesign, third-party bot targeting, untrusted APIs, user-provided API keys, new dependencies without justification.

---

## Git Workflow

- Never commit to `main` (protected)
- Never commit to fork's `dev` branch
- Create feature branch from `dev`: `feature/plugin-name` or `fix/plugin-name`
- Keep commits atomic
- Squash commits before merging if addressing same issue
- Run `pnpm lint` and `pnpm build` before committing

**PR title format:** `[PluginName] Description`

---
