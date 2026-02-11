/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CopyIcon, DeleteIcon, IDIcon, LinkIcon, OpenExternalIcon } from "@components/Icons";
import { ChannelMessage, ChannelRecord, messageClasses, MessageRecord } from "@equicordplugins/holyNotes";
import { noteHandler } from "@equicordplugins/holyNotes/NoteHandler";
import { Note } from "@equicordplugins/holyNotes/types";
import { copyToClipboard } from "@utils/clipboard";
import { fetchUserProfile } from "@utils/discord";
import { proxyLazy } from "@utils/lazy";
import { classes } from "@utils/misc";
import { ContextMenuApi, FluxDispatcher, Menu, NavigationRouter, useEffect, useReducer, useRef, UserStore } from "@webpack/common";

const UserRecord = proxyLazy(() => UserStore.getCurrentUser().constructor) as any;

interface Props {
    note: Note;
    notebook: string;
    updateParent?: () => void;
    fromDeleteModal: boolean;
    closeModal?: () => void;
}

export function RenderMessage({ note, notebook, updateParent, fromDeleteModal, closeModal }: Props) {
    const isHoldingDeleteRef = useRef(false);
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        if (!UserStore.getUser(note.author.id)) {
            fetchUserProfile(note.author.id);
        }
    }, [note.author.id]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key !== "Delete") return;
            const isDown = e.type === "keydown";
            if (isHoldingDeleteRef.current !== isDown) {
                isHoldingDeleteRef.current = isDown;
                forceUpdate();
            }
        };

        document.addEventListener("keydown", handleKey);
        document.addEventListener("keyup", handleKey);
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.removeEventListener("keyup", handleKey);
        };
    }, []);

    const author = UserStore.getUser(note.author.id) ?? note.author;

    const handleClick = () => {
        if (isHoldingDeleteRef.current && !fromDeleteModal) {
            noteHandler.deleteNote(note.id, notebook);
            updateParent?.();
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (fromDeleteModal) return;
        ContextMenuApi.openContextMenu(e, () => (
            <NoteContextMenu
                note={note}
                notebook={notebook}
                updateParent={updateParent}
                closeModal={closeModal}
            />
        ));
    };

    const message = new MessageRecord({
        ...note,
        author: new UserRecord({ ...author, bot: true }),
        timestamp: new Date(note.timestamp),
        embeds: note.embeds?.map(embed =>
            embed.timestamp ? { ...embed, timestamp: new Date(embed.timestamp) } : embed
        ),
    });

    return (
        <div
            className="vc-holy-note"
            style={{ margin: "8px 0", padding: "4px 0" }}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <ChannelMessage
                className={classes("vc-holy-render", messageClasses?.message, messageClasses?.groupStart, messageClasses?.cozyMessage)}
                key={note.id}
                groupId={note.id}
                id={note.id}
                compact={false}
                isHighlight={false}
                isLastItem={false}
                renderContentOnly={false}
                channel={new ChannelRecord({ id: "holy-notes" })}
                message={message}
            />
        </div>
    );
}

interface ContextMenuProps {
    note: Note;
    notebook: string;
    updateParent?: () => void;
    closeModal?: () => void;
}

function NoteContextMenu({ note, notebook, updateParent, closeModal }: ContextMenuProps) {
    const allNotebooks = Object.keys(noteHandler.getAllNotes());

    return (
        <Menu.Menu
            navId="holynotes"
            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
            aria-label="Holy Notes"
        >
            <Menu.MenuItem
                label="Jump To Message"
                id="jump"
                icon={OpenExternalIcon}
                action={() => {
                    NavigationRouter.transitionTo(`/channels/${note.guild_id || "@me"}/${note.channel_id}/${note.id}`);
                    closeModal?.();
                }}
            />
            <Menu.MenuItem
                label="Copy Text"
                id="copy-text"
                icon={CopyIcon}
                action={() => copyToClipboard(note.content)}
            />
            {note.attachments.length > 0 && (
                <Menu.MenuItem
                    label="Copy Attachment URL"
                    id="copy-url"
                    icon={LinkIcon}
                    action={() => copyToClipboard(note.attachments[0].url)}
                />
            )}
            <Menu.MenuItem
                label="Copy ID"
                id="copy-id"
                icon={IDIcon}
                action={() => copyToClipboard(note.id)}
            />
            {allNotebooks.length > 1 && (
                <Menu.MenuItem label="Move Note" id="move-note">
                    {allNotebooks.filter(k => k !== notebook).map(k => (
                        <Menu.MenuItem
                            key={k}
                            label={`Move to ${k}`}
                            id={k}
                            action={() => {
                                noteHandler.moveNote(note, notebook, k);
                                updateParent?.();
                            }}
                        />
                    ))}
                </Menu.MenuItem>
            )}
            <Menu.MenuItem
                color="danger"
                label="Delete Note"
                id="delete"
                icon={DeleteIcon}
                action={() => {
                    noteHandler.deleteNote(note.id, notebook);
                    updateParent?.();
                }}
            />
        </Menu.Menu>
    );
}
