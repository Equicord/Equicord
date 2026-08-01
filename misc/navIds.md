# NavIDs

If you have `ConsoleShortcuts` enabled you can run loadLazyChunks()
after it says Finished loading all chunks! in console
you can run the snippet below to list and copy all the navIds currently available

```js
const wp = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
const navIds = [...new Set(
  Object.values(wp.m).flatMap(f =>
    [...Function.prototype.toString.call(f)
      .matchAll(/navId:\s*["'`]([^"'`]+)["'`]/g)]
      .map(m => m[1])
  )
)].sort().join("\n");
console.log(navIds);
copy(navIds);
```

```md
accept-invite-modal-settings-menu
activity-popout-overflow-popout
add-questions
application-directory-profile
audio-device-context
authorized-app-action-menu
avatar-edit-context
banner-edit-context
channel-attach
channel-autocomplete
channel-context
clean-up-inactive-gdms
collectibles-game-shops-menu
collectibles-index-page-menu
collectibles-shop-tabs-overflow-menu
component-button
device-detected-panel-more-actions
devtools-overflow
devtools-popout
edit-profile-popout
exit-options
favorite-guild-header-add-context
favorites-channel-list-context
friend-row
global-discovery-search-filter-options
global-discovery-tabs-overflow-menu
guild-entry-context
guild-product-context
guild-settings-role-context
guild-sort-order-menu
join-call-context
manage-multi-account
manage-streams
member-list-settings-menu
member-safety-flags
member-safety-roles
members-table-join-method-menu
members-table-sort-menu
members-tabs-overflow-menu
message
message-actions
message-reminder-create
more-settings-context
non-user-bot-profile-overflow-menu
now-playing-menu
overlay-channel-context
overlay-clips-menu
pip-menu
plaintext-preview-overflow-menu
play-on-distributor-menu
playground-copy-link-menu
playground-settings-menu
quests-entry
schedule-actions
search-results
send-announcement-options
set-status-submenu
set-status-submenu-mobile-web
settings-menu
slayer-storefront-shop-dropdown
social-layer-storefront-entry
sort-and-view
staff-help-popout
subscription-context
switch-accounts-submenu
thread-context
unapplied-boost-actions
user-bot-profile-overflow-menu
user-profile-friend-request-buttons
user-profile-overflow-menu
user-profile-widget-context-menu
user-settings-change-avatar
video-player-overflow
widget-game-tags
wishlist-overflow-menu
```
