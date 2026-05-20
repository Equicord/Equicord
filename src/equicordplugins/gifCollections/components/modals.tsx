/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { classes } from "@utils/misc";
import { RenderModalProps } from "@vencord/discord-types";
import { Button, FluxDispatcher, Modal, openModal, TextInput, useCallback, useState } from "@webpack/common";

import { settings } from "../settings";
import { Collection, Gif } from "../types";
import { cache_collections, createCollection, getItemCollectionNameFromId, moveGifToCollection, renameCollection } from "../utils/collectionManager";
import { cl, stripPrefix } from "../utils/misc";

export function openCollectionInfoModal(collection: Collection) {
    openModal(props => (
        <InfoModal props={props} title="Collection Information" rows={[
            { label: "Name", value: stripPrefix(collection.name) },
            { label: "Gifs", value: String(collection.gifs.length) },
            { label: "Created At", value: collection.createdAt ? new Date(collection.createdAt).toLocaleString() : "Unknown" },
            { label: "Last Updated", value: collection.lastUpdated ? new Date(collection.lastUpdated).toLocaleString() : "Unknown" },
        ]} />
    ));
}

export function openGifInfoModal(gif: Gif) {
    openModal(props => (
        <InfoModal props={props} title="Information" rows={[
            { label: "Added At", value: gif.addedAt ? new Date(gif.addedAt).toLocaleString() : "Unknown" },
            { label: "Width", value: String(gif.width) },
            { label: "Height", value: String(gif.height) },
        ]} />
    ));
}

export function openMoveToCollectionModal(gifId: string) {
    openModal(props => <MoveToCollectionModal props={props} gifId={gifId} />);
}

export function openCreateCollectionModal(gif: Gif) {
    openModal(props => <CreateCollectionModal props={props} gif={gif} />);
}

export function openRenameCollectionModal(name: string) {
    openModal(props => <RenameCollectionModal props={props} name={name} />);
}

function InfoModal({ props, title, rows }: { props: RenderModalProps; title: string; rows: { label: string; value: string; }[]; }) {
    return (
        <Modal
            {...props}
            size="sm"
            title={title}
            actions={[
                { text: "Close", variant: "secondary", onClick: props.onClose }
            ]}
        >
            <section>
                {rows.map(row => (
                    <Flex key={row.label} className={cl("info-row")}>
                        <Heading className={cl("info-title")}>{row.label}</Heading>
                        <Paragraph className={cl("info-text")}>{row.value}</Paragraph>
                    </Flex>
                ))}
            </section>
        </Modal>
    );
}

function MoveToCollectionModal({ props, gifId }: { props: RenderModalProps; gifId: string; }) {
    return (
        <Modal
            {...props}
            size="sm"
            title="Move To Collection"
            actions={[
                { text: "Close", variant: "secondary", onClick: props.onClose }
            ]}
        >
            <Heading style={{ marginBottom: "10px" }}>Select a collection to move the item to</Heading>
            <div className={cl("buttons")}>
                {cache_collections
                    .filter(col => col.name !== getItemCollectionNameFromId(gifId))
                    .map(col => (
                        <Button
                            key={col.name}
                            className={cl("button")}
                            onClick={async () => {
                                const fromCollection = getItemCollectionNameFromId(gifId);
                                if (!fromCollection) return;
                                await moveGifToCollection(gifId, fromCollection, col.name);
                                FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY", query: "" });
                                FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY", query: fromCollection });
                                props.onClose();
                            }}
                        >
                            {stripPrefix(col.name)}
                        </Button>
                    ))}
            </div>
        </Modal>
    );
}

function CreateCollectionModal({ props, gif }: { props: RenderModalProps; gif: Gif; }) {
    const [name, setName] = useState("");
    const onSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        if (!name.length) return;
        createCollection(name, [gif]);
        props.onClose();
    }, [name, gif, props]);

    return (
        <Modal
            {...props}
            size="sm"
            title="Create Collection"
            actions={[
                { text: "Create", onClick: onSubmit, disabled: !name.length, variant: "primary" }
            ]}
        >
            <form onSubmit={onSubmit}>
                <Heading className={cl("rename-text")}>Collection Name</Heading>
                <TextInput onChange={setName} />
            </form>
        </Modal>
    );
}

function RenameCollectionModal({ props, name }: { props: RenderModalProps; name: string; }) {
    const prefix = settings.store.collectionPrefix;
    const strippedName = name.startsWith(prefix) ? name.slice(prefix.length) : name;
    const [newName, setNewName] = useState(strippedName);
    const tooLong = newName.length >= 25;

    const onSubmit = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newName.length || tooLong) return;
        await renameCollection(name, newName);
        props.onClose();
    }, [newName, name, tooLong, props]);

    return (
        <Modal
            {...props}
            size="sm"
            title="Rename Collection"
            actions={[
                { text: "Rename", onClick: onSubmit, disabled: !newName.length || tooLong, variant: "primary" }
            ]}
        >
            <form onSubmit={onSubmit}>
                <Paragraph className={cl("rename-text")}>New Collection Name</Paragraph>
                <TextInput value={newName} className={classes(cl("rename-input"), tooLong ? cl("input-warning") : "")} onChange={setNewName} />
                {tooLong && <Paragraph className={cl("warning-text")}>Name can't be longer than 24 characters</Paragraph>}
            </form>
        </Modal>
    );
}
