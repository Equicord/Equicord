title: Equicord Review Guidelines

rules:
  critical:
    licenseHeader: NEVER edit existing license headers, new files use 2026
    checkDeprecated: always verify components/functions arent deprecated before using
    noAnyTypes: NEVER use any for Discord objects, import proper types from @vencord/discord-types
    minimalChanges: fix with smallest possible change, no refactoring unless explicitly asked
    noOverengineering: solve the problem at hand only, no patterns for patterns sake
    humanText: write natural human text in errors, descriptions, messages. No dashes or robotic formatting. Write like "Module not found" not "Module - not found". Keep it simple and conversational
  code:
    deleteNotComment: DELETE dead code, dont comment it, git preserves history
    noHardcoded: no hardcoded values, unused imports, magic numbers
    useClassNameFactory: import classNameFactory from @utils/css (NOT @api/Styles which is deprecated), ALWAYS use cl() for class names, never hardcode strings like "vc-plugin-name-class"
    useClasses: when combining multiple class names use classes() from @utils/misc, not template strings like `${a} ${b}`
    useExisting: use utilities from @utils/, @api/, @components/
    logger: use Logger from @utils/Logger, not console.log
    descriptions: capital first letter, end with period
    minimal: less code with same functionality is ALWAYS better
    noComments: NEVER add comments unless explicitly asked
    preserveComments: keep existing comments, they contain important context
    performance: use Map/Set, .some/.find, no spread in loops, Promise.all
    simple: KISS over clever, flat over nested, explicit over implicit
  typescript:
    prefer: optional chaining (?.), nullish coalescing (??), const, arrow functions
    use: destructuring, template literals, object shorthand, array methods
    style: early returns, trust inference, inline single-use variables
  react:
    errorBoundary: wrap complex components with ErrorBoundary.wrap(Component, { noop: true })
    nullNotUndefined: return null for conditional rendering not undefined
    forbidden: React.cloneElement, React.isValidElement, React.memo(), React.lazy, React.Children
    cleanup: always return cleanup functions in useEffect
  forbidden:
    DOM: direct DOM manipulation (use patches)
    cssOnly: CSS-only plugins
    emptyCatch: empty catch blocks
    hardcodedVars: hardcoded minified vars in patches (e,t,n)
    settingsArrays: NEVER use settings.use() with arrays, mutate then reassign
  antiPatterns{bad ⟹ good}:
    "value !== null && value !== undefined" ⟹ "value"
    "array && array.length > 0" ⟹ "array.length"
    "settings?.store?.value" ⟹ "settings.store.value"
    "value || defaultValue" ⟹ "value ?? defaultValue"

patching:
  core:
    surgical: minimum code touched, stability over cleverness, one patch per concern
    iterate: try multiple approaches, keep simplifying until you find the cleanest solution
    minimize: remove any regex character that doesnt change the match result
    balanced: not overengineered, not overlooked, just clean and future-proof
  find:
    preferIntl: use #{intl::KEY} in find when possible, most stable anchor
    makeUnique: if find matches multiple modules, add nearby stable string like "),icon:" or function name
    combine: "#{intl::PIN_MESSAGE}),icon:" is better than generic strings
  match:
    shortestPath: match only what you need to replace, let find do the targeting
    intlInMatch: can use #{intl::KEY} in match too, gets canonicalized to hash
    simpleWins: /#{intl::KEY}\)/ beats /label:\i\.pinned\?.{0,60}#{intl::KEY}\)/
    useAmpersand: $& keeps original, append/prepend to it
    boundedGaps: .{0,50} not .+? or .*?
    captureOnlyIfNeeded: only use capture groups if reusing in replace
  NEVER:
    hardcodedMinified: e,t,n,r,i,o,s,l,c,u,$_,xx,eD,eH,eW ⟹ use \i instead
    minifiedChains: \i\.\i alone ⟹ surround with stable strings
    unboundedGaps: .+? or .*? ⟹ use .{0,N}
    genericPatterns: /className:\i/ alone ⟹ add anchor
    rawIntlHash: .aA4Vce ⟹ #{intl::KEY_NAME}
  examples:
    clean: |
      find: "#{intl::PIN_MESSAGE}),icon:"
      match: /#{intl::PIN_MESSAGE}\)/
      replace: "$self.getPinLabel(arguments[0]))"
    append: |
      find: "#{intl::VIEW_AS_ROLES_MENTIONS_WARNING}"
      match: /#{intl::VIEW_AS_ROLES_MENTIONS_WARNING}.{0,100}(?=])/
      replace: "$&,$self.renderTooltip(arguments[0].guild)"
    wrap: |
      find: "#{intl::THREE_USERS_TYPING}"
      match: /(?<="aria-atomic":!0,children:)\i/
      replace: "$self.renderTypingUsers({ children: $& })"

intl:
  syntax: "#{intl::KEY}" or "#{intl::HASH::raw}" if key unknown
  workflow: hash in code → reverse to get key → use #{intl::KEY} or fallback to #{intl::HASH::raw}

pluginInterop:
  checkEnabled: isPluginEnabled(name) from @api/PluginManager takes a string, checks required/isDependency/enabled
  import: import the plugin directly from its path to access .name and functions
  avoid: dont use Vencord.Plugins.plugins or plugin.started, dont use "as unknown as" casting
  example: |
    import { isPluginEnabled } from "@api/PluginManager";
    import otherPlugin from "@equicordplugins/otherPlugin";
    if (!isPluginEnabled(otherPlugin.name)) return null;
    otherPlugin.someFunction();

reference:
  types: Channel, Guild, GuildMember, User, Role, Message from @vencord/discord-types
  components: Paragraph, BaseText, Flex, Button, ErrorCard from @components/
  settings: use definePluginSettings from @api/Settings, not inline settings object
  utilities:
    clipboard: copyToClipboard from @utils/clipboard
    discord: insertTextIntoChatInputBox, getCurrentChannel, getCurrentGuild, getIntlMessage, openUserProfile, openPrivateChannel, sendMessage, copyWithToast, getUniqueUsername, fetchUserProfile from @utils/discord
    css: classNameFactory, classNameToSelector from @utils/css
    misc: classes, sleep, isObject, isObjectEmpty, pluralise, parseUrl, identity from @utils/misc
    text: formatDuration, formatDurationMs, humanFriendlyJoin, makeCodeblock, toInlineCode, escapeRegExp from @utils/text
    modal: openModal, closeModal, ModalRoot, ModalHeader, ModalContent, ModalCloseButton from @utils/modal
    margins: Margins from @utils/margins (Margins.top8, Margins.bottom16, etc.)
    guards: isTruthy, isNonNullish from @utils/guards
    web: saveFile, chooseFile from @utils/web
  webpackCommon:
    icons: IconUtils from @webpack/common, NEVER hardcode cdn.discordapp.com URLs
      getUserAvatarURL: IconUtils.getUserAvatarURL(user, canAnimate?, size?)
      getDefaultAvatarURL: IconUtils.getDefaultAvatarURL(id)
      getUserBannerURL: IconUtils.getUserBannerURL({ id, banner, canAnimate?, size })
      getGuildIconURL: IconUtils.getGuildIconURL({ id, icon, size?, canAnimate? })
      getGuildBannerURL: IconUtils.getGuildBannerURL(guild, canAnimate?)
      getChannelIconURL: IconUtils.getChannelIconURL({ id, icon })
      getEmojiURL: IconUtils.getEmojiURL({ id, animated, size })
      getApplicationIconURL: IconUtils.getApplicationIconURL(data)
      getGameAssetURL: IconUtils.getGameAssetURL(data)
    stores: UserStore, GuildStore, ChannelStore, GuildMemberStore, SelectedChannelStore, SelectedGuildStore, PresenceStore, RelationshipStore, MessageStore, EmojiStore, ThemeStore, PermissionStore, VoiceStateStore from @webpack/common
    actions: RestAPI, FluxDispatcher, MessageActions, NavigationRouter, ChannelRouter, ChannelActionCreators, SettingsRouter from @webpack/common
    utils: Constants (Constants.Endpoints), SnowflakeUtils, Parser, PermissionsBits, moment, lodash, ColorUtils, ImageUtils, DateUtils, UsernameUtils, DisplayProfileUtils from @webpack/common
    components: Tooltip, TextInput, TextArea, Select, Slider, Avatar, Menu, Popout, ScrollerThin, Timestamp from @webpack/common
    toasts: Toasts, showToast from @webpack/common
  imports:
    lazy: findByPropsLazy, findStoreLazy, findComponentByCodeLazy, findExportedComponentLazy from @webpack
    common: useState, useEffect, useCallback, useStateFromStores from @webpack/common
  neverHardcode:
    cdnURLs: NEVER use "cdn.discordapp.com/avatars/", "cdn.discordapp.com/banners/", "cdn.discordapp.com/emojis/", "cdn.discordapp.com/icons/", "cdn.discordapp.com/channel-icons/" ⟹ use IconUtils
    apiEndpoints: NEVER hardcode "/api/v9", "/users/@me" ⟹ use Constants.Endpoints or RestAPI
    console: NEVER use console.log/warn/error ⟹ use Logger from @utils/Logger
    classConcat: NEVER use `${a} ${b}` for class names ⟹ use classes(a, b) from @utils/misc
    defaultAvatars: NEVER hardcode "/assets/*.png" for default avatars ⟹ use IconUtils.getDefaultAvatarURL(id)
