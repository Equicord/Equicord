/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import {
    Modal,
    openModal,
    SelectedChannelStore,
    TextInput,
    Tooltip,
    useEffect,
    useState,
    useStateFromStores
} from "@webpack/common";

interface NoteStore {
    [channelId: string]: string;
}

const noteListeners = new Set<() => void>();
const NOTES_KEY = "ChannelNotes_data";
let notes: NoteStore = {};

export async function loadNotes() {
    notes = (await DataStore.get<NoteStore>(NOTES_KEY)) ?? {};
}

export function getNote(channelId: string): string | null {
    return notes[channelId] ?? null;
}

export async function saveNote(channelId: string, note: string) {
    if (note.trim()) {
        notes[channelId] = note.trim();
    } else {
        delete notes[channelId];
    }
    await DataStore.set(NOTES_KEY, notes);
    noteListeners.forEach(listener => listener());
}

export const settings = definePluginSettings({
    noteColor: {
        type: OptionType.STRING,
        description: "Color for the note preview in header bar",
        default: "#a7aab1"
    }
});

const SETTINGS_KEYS = ["noteColor"] as const;

function PencilIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
    );
}

function NoteEditModal({ channelId, ...modalProps }: { channelId: string; [key: string]: any }) {
    const currentNote = getNote(channelId) ?? "";
    const [text, setText] = useState(currentNote);

    const handleSave = async () => {
        await saveNote(channelId, text);
        modalProps.onClose?.();
    };

    return (
        <Modal
            {...modalProps}
            size="small"
            title="Edit Channel Note"
        >
            <div style={{ padding: "16px 0" }}>
                <TextInput
                    value={text}
                    onChange={setText}
                    placeholder="Type your note for this channel..."
                    maxLength={49}
                />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button className="button" onClick={handleSave}>
                    Save
                </button>
                <button className="button-link" onClick={() => modalProps.onClose?.()}>
                    Cancel
                </button>
            </div>
        </Modal>
    );
}

export function openNoteModal(channelId: string) {
    openModal(props => <NoteEditModal channelId={channelId} {...props} />);
}

function ChannelNoteHeader() {
    const { noteColor } = settings.use(SETTINGS_KEYS);
    const [, forceUpdate] = useState(0);
    const channelId = useStateFromStores(
        [SelectedChannelStore],
        () => SelectedChannelStore.getChannelId()
    );

    useEffect(() => {
        const unlisten = () => forceUpdate(v => v + 1);
        noteListeners.add(unlisten);

        return () => void noteListeners.delete(unlisten);
    }, []);

    if (!channelId) return null;

    const note = getNote(channelId);
    if (!note) return null;

    return (
        <Tooltip text="Click to edit channel note">
            {props => (
                <div
                    {...props}
                    className="vc-channel-notes-header-note"
                    style={{ color: noteColor }}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNoteModal(channelId)}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
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

function ChannelNoteButton({ channel }: { channel: Channel }) {
    return (
        <Tooltip text="Edit Channel Note">
            {props => (
                <div
                    {...props}
                    className="vc-channel-notes-button"
                    role="button"
                    tabIndex={0}
                    onClick={() => openNoteModal(channel.id)}
                >
                    <PencilIcon />
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
