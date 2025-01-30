import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import definePlugin from "@utils/types";
import { cleanMessage } from "./core";

let totalReplacements = 0;

export default definePlugin({
    name: "Dysclusif",
    description: "Remove inclusive writing for dyslexic people",
    authors: [{ name: "candiceetdefondouze", id: 0n }],
    dependencies: ["CommandsAPI"],
    patches: [
        {
            find: "Message must not be a thread starter message",
            replacement: {
                match: /\.memo\(function\((\i)\)\{/,
                replace: ".memo(function($1){$1=$self.editMessage($1);"
            }
        }
    ],
    commands: [
        {
            name: "dyscount",
            description: "Montre le nombre de regex utilisées depuis que discord est actif",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [],
            execute: (_, ctx) => {
                sendBotMessage(ctx.channel.id, {
                    content: totalReplacements + " Regex utilisées depuis le début de la journée"
                });
            }
        },
    ],

    editMessage: (m) => {
        let [newContent, replacementCounts] = cleanMessage(m.message.content);
        totalReplacements += replacementCounts;
        m.message.content = newContent;

        return m;
    }
});
