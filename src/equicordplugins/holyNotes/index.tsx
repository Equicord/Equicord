/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { HeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import { EquicordDevs } from "@utils/constants";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { findByCodeLazy, findComponentByCodeLazy, findCssClassesLazy, findExportedComponentLazy } from "@webpack";
import { ChannelStore, Menu } from "@webpack/common";

import { Popover as NoteButtonPopover } from "./components/icons/NoteButton";
import { NoteModal } from "./components/modals/Notebook";
import { noteHandler, noteHandlerCache } from "./NoteHandler";
import { DataStoreToCache, HolyNoteStore } from "./utils";

const BookmarkIcon = findExportedComponentLazy("BookmarkIcon");

export const MessageType = findByCodeLazy("isEdited(){");
export const iconClasses = findCssClassesLazy("iconWrapper", "clickable");
export const resultsClasses = findCssClassesLazy("emptyResultsWrap", "emptyResultsContent", "errorImage", "emptyResultsText", "noResultsImage", "alt");
export const quickSelectClasses = findCssClassesLazy("quickSelect", "quickSelectLabel", "quickSelectClick", "quickSelectValue", "quickSelectArrow");
export const messageClasses = findCssClassesLazy("message", "groupStart", "cozyMessage");
export const Channel = findByCodeLazy("computeLurkerPermissionsAllowList(){");
export const ChannelMessage = findComponentByCodeLazy("Message must not be a thread");

const messageContextMenuPatch: NavContextMenuPatchCallback = async (children, { message }: { message: Message; }) => {
    children.push(
        <Menu.MenuItem label="Add Message To" id="add-message-to-note">
            {Object.keys(noteHandler.getAllNotes()).map((notebook: string, index: number) => (
                <Menu.MenuItem
                    key={notebook}
                    label={notebook}
                    id={notebook}
                    action={() => noteHandler.addNote(message, notebook)}
                />
            ))}
        </Menu.MenuItem>
    );
};

function ToolBarHeader() {
    return (
        <HeaderBarButton
            tooltip="Holy Notes"
            position="bottom"
            className="vc-note-button"
            icon={BookmarkIcon}
            onClick={() => openModal(props => <NoteModal {...props} />)}
        />
    );
}

export default definePlugin({
    name: "HolyNotes",
    description: "Holy Notes allows you to save messages",
    authors: [EquicordDevs.Wolfie],

    toolboxActions: {
        async "Open Notes"() {
            openModal(props => <NoteModal {...props} />);
        }
    },

    contextMenus: {
        "message": messageContextMenuPatch
    },

    headerBarButton: {
        icon: BookmarkIcon,
        render: ToolBarHeader
    },

    messagePopoverButton: {
        icon: NoteButtonPopover,
        render(message) {
            return {
                label: "Save Note",
                icon: NoteButtonPopover,
                message: message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => noteHandler.addNote(message, "Main")

            };
        }
    },
    async start() {
        if (await DataStore.keys(HolyNoteStore).then(keys => !keys.includes("Main"))) return noteHandler.newNoteBook("Main");
        if (!noteHandlerCache.has("Main")) await DataStoreToCache();
    },
});
