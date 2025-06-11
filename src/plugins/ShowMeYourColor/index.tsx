import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Message, User } from "discord-types/general";

interface UsernameProps {
    author: { nick: string; };
    message: Message;
    withMentionPrefix?: boolean;
    isRepliedMessage: boolean;
    userOverride?: User;
}

const settings = definePluginSettings({
    colorMode: {
        type: OptionType.SELECT,
        description: "How to generate unique colors",
        options: [
            { label: "Based on User ID", value: "id", default: true },
            { label: "Random", value: "random" }
        ],
    },
    colorIntensity: {
        type: OptionType.SLIDER,
        description: "Color intensity (0-100)",
        default: 70,
        markers: [0, 25, 50, 75, 100],
    }
});

function stringToColor(str: string, intensity: number = 70): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const h = hash % 360;
    const s = intensity;
    const l = 50;

    return `hsl(${h}, ${s}%, ${l}%)`;
}

export default definePlugin({
    name: "ShowMeYourColor",
    description: "Gives each user a unique color based on their ID",
    authors: [Devs.eyadmkv],
    patches: [
        {
            find: '"BaseUsername"',
            replacement: {
                match: /(?<=onContextMenu:\i,children:)(?:\i\+\i|\i)/,
                replace: "$self.renderUsername(arguments[0])"
            }
        },
    ],
    settings,

    renderUsername: ErrorBoundary.wrap(({ author, message, isRepliedMessage, withMentionPrefix, userOverride }: UsernameProps) => {
        try {
            const user = userOverride ?? message.author;
            const { username } = user;
            const { nick } = author;
            const prefix = withMentionPrefix ? "@" : "";

            const color = stringToColor(user.id, settings.store.colorIntensity);

            const style = {
                color: color,
                fontWeight: "bold"
            };

            return <span style={style}>{prefix}{nick}</span>;
        } catch {
            return <>{author?.nick}</>;
        }
    }, { noop: true }),
});
