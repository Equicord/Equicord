import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { MessageActions, MessageStore, UserStore } from "@webpack/common";

let currentReply: Message | null = null;

// This regex tries to match messages whose contents resemble sed substitutions:
// `s/foo/bar/r`. However, it also allows escaping the separator: `s/abc\/def/ghi\/jkl/g`.
// Most parts of the regex are fairly self-explanatory, but the separator
// escaping complicates it considerably (in the `match` and `replace` groups):
//      \1((?!\1)(?:(?![^\\]\1).)*.|)
// Note: `\1` here refers to the `sep` match.
//
// This part of the regex is actually responsible for handling escaped separators:
//      \1((?!\1)(?:(?![^\\]\1).)*.|)
//               ^^^^^^^^^^^^^^^^^^
// In `(?![^\\]\1).`, the `.` matches any character, but the negative lookahead
// fails the match if there is a separator with anything but `\` before it. This
// is then repeated 0 or more times with the `*` around it, resulting in `foo\/`
// matching, but `foo/` failing (because the character before the `/` is `o`).
// However, when it fails, `fo` is matched but the `o` before the `/` is left
// behind; the `.` at the end of the highlighted part deals with it.
//
// Using just `(?:(?![^\\]\1).)*.`, however, has a problem: it doesn't handle an
// empty section, as in `s/foo//r`, because at least one character is expected
// (by the `.` at the end). Making it optional with a `?` reveals a new problem:
// while the negative lookahead prevents a separator preceded by a non-`\`
// character, there is no character before the last `/` in `s/foo//r`—resulting
// in it passing the negative lookahead—as everything before it is matched by
// the previous parts of the regex. This means that `s/foo//r` parses as
// `match: "foo", replace: "/r", modes: ""`, since the `replace` group matches
// the `/` at the start.
//
// Empty sections are hence dealt with by this part:
//      \1((?!\1)(?:(?![^\\]\1).)*.|)
//      ^^ ^^^^^^                  ^
// In the `s/foo//r` example,  assuming `s/foo` has already been matched by
// everything before it, the `\1` outside the capture group consumes the next
// `/`, leaving `/r` to be parsed; `(?!\1)` then fails the match if another
// separator is present immediately after—as in this example—which is then
// recovered from with the `|` at the end that always matches an empty string,
// making the `replace` group essentially optional (n.b.: using `?` on the whole
// group would make `replace` *undefined* instead of an empty string). The final
// `/r` that hasn't yet been matched is then consumed by the rest of the regex.
const sedRegex = /^s(?<sep>[/|$#@!])(?<match>(?!\1)(?:(?![^\\]\1).)*.|)\1(?<replace>(?!\1)(?:(?![^\\]\1).)*.|)\1?(?<modes>[rgmisudyv]*)$/;

const settings = definePluginSettings({
    regexByDefault: {
        description: "Inverts the `r` flag, so using the `r` flag enables non-regex mode, and omitting it uses regex mode",
        type: OptionType.BOOLEAN,
        default: false
    }
});

export default definePlugin({
    name: "SedEnhanced",
    description: "Expands on Discord's rudimentary `sed` support",
    authors: [EquicordDevs.dawn, EquicordDevs.Willow, EquicordDevs.kat],
    patches: [
        {
            find: "searchReplace:{",
            replacement: {
                match: /searchReplace:\{match:(.*?)\.anyScopeRegex.*?action\(.*?\)\{.*?\}{3},/gs,
                replace: "searchReplace:{match:$1.anyScopeRegex($self.sedRegex),action:$self.searchReplace},"
            }
        }
    ],
    settings,
    sedRegex,
    searchReplace(content, { isEdit, channel }) {
        if (isEdit) return;
        let toEdit: Message | null | undefined = null;
        if (currentReply) {
            toEdit = currentReply;
            if (currentReply.author.id !== UserStore.getCurrentUser()?.id) return { content: "" };
        } else {
            toEdit = MessageStore.getLastEditableMessage(channel.id);
        }
        if (toEdit == null || toEdit.id == null) {
            return { content: "" };
        }
        let contentMatch = content.match(sedRegex);
        if (contentMatch == null) return;
        let { match, replace, modes } = contentMatch.groups;
        let flags = modes?.split("") ?? [];
        let regexMode = flags.includes("r") != settings.store.regexByDefault;
        if (!regexMode) {
            // Discord uses this to make their non-regex sed easier for regex users, but it breaks regex mode
            // We keep this only for non-regex mode to keep backwards compatibility
            let thisIsntRegex = /\\([*?+/])/g;
            match = match.replace(thisIsntRegex, (_, x) => x);
            replace = replace.replace(thisIsntRegex, (_, x) => x);
        }

        let replaced = toEdit.content;
        if (regexMode) {
            match = new RegExp(match, "gmisudyv".split("").filter(f => flags.includes(f)).join(""));
        }
        if (flags.includes("g")) {
            replaced = replaced.replaceAll(match, replace);
        } else {
            replaced = replaced.replace(match, replace);
        }

        return (replaced == null || replaced.trim() === "") && toEdit.attachments.length === 0 ? MessageActions.deleteMessage(channel.id, toEdit.id) : replaced !== toEdit.content && MessageActions.editMessage(channel.id, toEdit.id, {
            content: replaced
        }), {
            content: ""
        };
    },
    flux: {
        DELETE_PENDING_REPLY() {
            currentReply = null;
        },
        CREATE_PENDING_REPLY({ message }: { message: Message; }) {
            currentReply = message;
        }
    }
});