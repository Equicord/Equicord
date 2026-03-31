import definePlugin from "@utils/types";
import { Devs , EquicordDevs } from "@utils/constants";
import { ChannelRouter, UserStore } from "@webpack/common";

export default definePlugin({
    name: "AutoJumpToMention",
    description: "يوديك تلقائياً للرسالة لما أحد يمنشنك",
    authors: [Devs.rz30, EquicordDevs.engz, Devs.r3r1],
    patches: [],

    flux: {
        MESSAGE_CREATE({ message }: { message: any; }) {
            if (!message?.content) return;

            const me = UserStore.getCurrentUser();
            if (!me) return;

            const isDirectlyMentioned = message.mentions?.some((u: any) => u.id === me.id);

            if (!isDirectlyMentioned) return;

            if (message.author?.id === me.id) return;

            try {

                (ChannelRouter as any).transitionToChannel(message.channel_id, message.id);
            } catch (e) {

                (ChannelRouter as any).transitionTo(`/channels/${message.guild_id || "@me"}/${message.channel_id}/${message.id}`);
            }
        }
    },

    start() {
        console.log("[AutoJumpToMention] ✅ Started (Original Logic with Dual Authors)");
    },

    stop() {
        console.log("[AutoJumpToMention] Stopped");
    },
});
