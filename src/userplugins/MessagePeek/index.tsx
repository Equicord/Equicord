import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import MessagePeek from "./components/MessagePeek";
import { MessagePeekProps } from "./types";

export default definePlugin({
    name: "MessagePeek",
    description: "See the last message in a Channel like on mobile",
    authors: [{ name: "domi.btnr", id: 354191516979429376n }],
    patches: [
        {
            // DMs
            find: /let{className:[^],focusProps:[^],...[^]}=[^];return\(/,
            replacement: {
                match: /(?<=\.\.\.([^])[^]*)}=[^];/,
                replace: `$&
                    if ($1.children?.props?.children?.[0]?.props?.children?.props)
                        $1.children.props.children[0].props.children.props.subText = [
                            $1.children.props.children[0].props.children.props?.subText,
                            $self.renderMessagePeek({ channel_url: $1.children.props.children[0].props.to })
                        ];
                `.replace(/\s+/g, "")
            }
        },
        {
            // Guild channels
            find: /{href:[^],children:[^],onClick:[^],onKeyPress:[^],focusProps:[^],/,
            replacement: {
                match: /(?<=children:([^])[^]*)}\);/,
                replace: `$&
                    $1[0].props.children[1].props.children=[
                        $1[0].props.children[1].props.children,
                        $self.renderMessagePeek({ channel: $1[0].props.children[0].props.channel })
                    ];`.replace(/\s+/g, "")
            }
        }
    ],
    renderMessagePeek: (props: MessagePeekProps) => {
        return (
            <ErrorBoundary noop>
                <MessagePeek {...props} />
            </ErrorBoundary>
        );
    }
});