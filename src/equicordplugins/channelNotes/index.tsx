/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import {
    openModal,
    SelectedChannelStore,
    Tooltip,
    useEffect,
    useState,
    useStateFromStores
} from "@webpack/common";

import { NoteModal } from "./NoteModal";

const DATA_KEY = "ChannelNotes_notes";

const settings = definePluginSettings({
    noteColor: {
        type: OptionType.STRING,
        description: "Color of the channel note and pencil shown in the header.",
        default: "#b5bac1"
    }
});

type ChannelNotes = Record<string, string>;

let notes: ChannelNotes = {};

const noteListeners = new Set<() => void>();

function notifyNoteListeners() {
    noteListeners.forEach(listener => listener());
}

async function loadNotes() {
    notes = await DataStore.get<ChannelNotes>(DATA_KEY) ?? {};
    notifyNoteListeners();
}

async function saveNote(channelId: string, note: string) {
    const trimmedNote = note.trim().slice(0, 49);

    if (!trimmedNote) {
        delete notes[channelId];
    } else {
        notes[channelId] = trimmedNote;
    }

    await DataStore.set(DATA_KEY, notes);
    notifyNoteListeners();
}

function getNote(channelId: string) {
    return notes[channelId] ?? "";
}

function openNoteModal(channelId: string) {
    openModal(modalProps => (
        <NoteModal
            channelId={channelId}
            initialNote={getNote(channelId)}
            onSave={saveNote}
            modalProps={modalProps}
        />
    ));
}

function PencilIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M17.7 2.3a2.4 2.4 0 0 1 3.4 3.4L8.4 18.4 3 20l1.6-5.4L17.7 2.3Zm-11.5 13-.8 2.6 2.6-.8L17.8 7.3l-1.8-1.8-9.8 9.8Z" />
        </svg>
    );
}

function ChannelNoteButton({ channel }: { channel: Channel; }) {
    if (!channel?.id) return null;

    return (
        <Tooltip text="Channel Note">
            {tooltipProps => (
                <div
                    {...tooltipProps}
                    className="vc-channel-notes-button"
                    role="button"
                    tabIndex={0}
                    onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        openNoteModal(channel.id);
                    }}
                    onKeyDown={event => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            openNoteModal(channel.id);
                        }
                    }}
                >
                    <PencilIcon />
                </div>
            )}
        </Tooltip>
    );
}

function ChannelNoteHeader() {
    const channelId = useStateFromStores(
        [SelectedChannelStore],
        () => SelectedChannelStore.getChannelId()
    );

    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(value => value + 1);

        noteListeners.add(listener);

        return () => {
            noteListeners.delete(listener);
        };
    }, []);

    if (!channelId) return null;

    const note = getNote(channelId);

    if (!note) return null;

    return (
        <Tooltip text="Click to edit channel note">
            {tooltipProps => (
                <div
                    {...tooltipProps}
                    className="vc-channel-notes-header-note"
                    style={{ color: settings.store.noteColor }}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNoteModal(channelId)}
                    onKeyDown={event => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openNoteModal(channelId);
                        }
                    }}
                >
                    <PencilIcon />
                    <span>{note}</span>
                </div>
            )}
        </Tooltip>
    );
}

export default definePlugin({
    name: "ChannelNotes",
    description: "Add private notes to individual channels.",
    authors: [{ name: "noxify", id: 1167135976209002508n }],

    settings,

    dependencies: ["HeaderBarAPI"],

    async start() {
        await loadNotes();
    },

    headerBarButton: {
        icon: PencilIcon,
        render: ChannelNoteHeader
    },

    patches: [
        {
            find: "renderInviteButton(){return",
            replacement: {
                match: /renderInviteButton\(\)\{return\(0,([A-Za-z_$][\w$]*)\.jsx\)\(([A-Za-z_$][\w$]*),\{\.\.\.this\.props\}\)\}/,
                replace: "renderInviteButton(){return[$self.renderNoteButton(this.props.channel),(0,$1.jsx)($2,{...this.props})]}"
            }
        }
    ],

    renderNoteButton(channel: Channel) {
        return <ChannelNoteButton channel={channel} />;
    },

    getNote,
    saveNote,
    openNoteModal
});
