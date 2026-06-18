# SedEnhanced
Expands on Discord's rudimentary `sed` (`s/a/b`) imitation to allow RegEx, alternate separators, and editing the message you're replying to.

## Usage
Format: `s/{match}/{replace}/{flags}`. The flags section is optional.

By default, RegEx mode is not enabled. You either have to specify the `r` flag (e.g. `s/.*/b/r`) or enable the "RegEx by default" setting in the plugin config.

Enabling the "RegEx by default" setting will invert the `r` flag, so that specifying it will disable RegEx mode and leaving it unspecified will enable RegEx mode.

## RegEx flags
SedEnhanced supports all RegEx flags natively supported by JS at the time of writing (**g**lobal, **m**ultiline, case-**i**nsensitive, **s**ingle-line, **u**nicode, in**d**ices, stick**y**, **v**nicode).

## Separators
SedEnchanced supports the following separators: `/`, `|`, `$`, `#`, `@`, `!`.