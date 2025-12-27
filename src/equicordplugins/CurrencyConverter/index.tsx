import "./style.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { Menu } from "@webpack/common";
import { Devs, EquicordDevs } from "@utils/constants";
import { settings } from "./settings";
import { Accessory, handleConvert } from "./accessory";
import { Icon } from "./icon";


const messageCtxPatch: NavContextMenuPatchCallback = (children, { message }) => {
    if (!message?.content) return;

    const group = findGroupChildrenByChildId("copy-text", children);
    if (!group) return;

    const idx = group.findIndex(c => c?.props?.id === "copy-text");
    if (idx === -1) return;

    group.splice(idx + 1, 0, (
        <Menu.MenuItem
            id="ec-currency-convert"
            label="Convert Currency"
            icon={Icon}
            action={() => handleConvert(message)}
        />
    ));
};

export default definePlugin({
    name: "Currency Converter",
    description: "Convert currencies found in messages and show the result under them.",
    settings,
    authors: [EquicordDevs.xMimiez],

    contextMenus: {
        "message": messageCtxPatch
    },

    renderMessageAccessory: props => <Accessory message={props.message} />
});

