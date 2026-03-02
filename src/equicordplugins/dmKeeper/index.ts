import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "DMKeeper",
    description: "Prevents Discord from automatically hiding old DM conversations from your sidebar.",
    authors: [EquicordDevs.Awizz],

    patches: [{
        find: "sortedPrivateChannels(){",
        noWarn: true,
        replacement: {
            match: /(\i)\.length>(\i)&&(\i)\.shift\(\)/,
            replace: "false"
        }
    }],
});
