/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { DeleteIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { chooseFile, saveFile } from "@utils/web";
import { Alerts, Button, FluxDispatcher, React, Toasts, useCallback, useEffect, useRef, useState } from "@webpack/common";

import { add, byRecency, clear, CropState, currentApplied, Entry, exportAll, forget, forgetCrops, getFile, getThumbs, Group, importAll, Kind, previousApplied, readIndex, recordApplied, saveCrop, toDataUrl, togglePin, touch } from "./library";

interface Picked {
    id: string;
    uri: string;
    file: File;
    group: Group;
}

const logger = new Logger("BetterImageEditor");

const settings = definePluginSettings({
    librarySize: {
        type: OptionType.SLIDER,
        description: "How many pictures to keep on each shelf",
        markers: [6, 12, 24, 48],
        default: 24,
        stickToMarkers: true
    },
    rememberCrop: {
        type: OptionType.BOOLEAN,
        description: "Restore the zoom and position you last used for a picture",
        default: true
    },
    forgetFraming: {
        type: OptionType.COMPONENT,
        description: "Drop every remembered crop and open each picture the way Discord would",
        component: () => (
            <Button
                color={Button.Colors.PRIMARY}
                onClick={() => Alerts.show({
                    title: "Forget every remembered crop?",
                    body: <p>Your pictures stay. Each one opens unframed from now on, until you crop it again.</p>,
                    confirmColor: Button.Colors.RED,
                    confirmText: "Forget",
                    cancelText: "Cancel",
                    onConfirm: () => forgetCrops()
                        .then(count => Toasts.show(Toasts.create(
                            count ? `Forgot the framing on ${count} picture${count === 1 ? "" : "s"}` : "Nothing was framed",
                            Toasts.Type.SUCCESS
                        )))
                        .catch(err => logger.error("could not forget the remembered crops", err))
                })}
            >
                Forget remembered framing
            </Button>
        )
    },
    saveCropped: {
        type: OptionType.BOOLEAN,
        description: "Keep a copy of each picture after you crop it",
        default: true
    },
    askBeforeSavingCropped: {
        type: OptionType.BOOLEAN,
        description: "Ask first, instead of keeping the cropped copy automatically",
        default: false
    },
    transfer: {
        type: OptionType.COMPONENT,
        description: "Carry your pictures, and how each one is framed, to another device",
        component: () => (
            <div className="bie-buttons">
                <Button color={Button.Colors.PRIMARY} onClick={exportLibrary}>Export to a file</Button>
                <Button color={Button.Colors.PRIMARY} onClick={importLibrary}>Import from a file</Button>
            </div>
        )
    },
    clearLibrary: {
        type: OptionType.COMPONENT,
        description: "Throw away every picture you have saved",
        component: () => (
            <Button
                color={Button.Colors.PRIMARY}
                onClick={() => Alerts.show({
                    title: "Clear saved pictures?",
                    body: <p>Every picture you have saved here goes, along with the crop remembered for each one. Discord's own archive and your current avatar and banner are not touched.</p>,
                    confirmColor: Button.Colors.RED,
                    confirmText: "Clear",
                    cancelText: "Cancel",
                    onConfirm: () => clear().catch(err => logger.error("could not clear the library", err))
                })}
            >
                Clear saved pictures
            </Button>
        )
    }
});

let handoff: { id: string | null; transform: CropState | null; } | null = null;
let handedOver: { id: string; kind: Kind; } | null = null;

const kindOf = (uploadType: string): Kind => uploadType || "AVATAR";

const SQUARE = new Set(["AVATAR", "AVATAR_DECORATION", "GUILD_ICON", "PERSONAL_WIDGET_FIELD"]);

const KIND_NAMES: Record<string, string> = {
    AVATAR: "avatars",
    BANNER: "banners",
    GUILD_ICON: "server icons",
    GUILD_BANNER: "server banners",
    SCHEDULED_EVENT_IMAGE: "event covers",
    HOME_HEADER: "home headers",
    AVATAR_DECORATION: "decorations",
    PERSONAL_WIDGET_COVER: "widget covers",
    PERSONAL_WIDGET_FIELD: "widget images",
    VIDEO_BACKGROUND: "video backgrounds"
};

const kindName = (kind: Kind) => KIND_NAMES[kind] ?? kind.toLowerCase().replace(/_/g, " ");

const isAnimated = (entry: Entry) => entry.type === "image/gif" || entry.name.toLowerCase().endsWith(".gif");
const croppedLabel = (kind: Kind) => `Cropped ${kindName(kind)}`;

const EXTENSIONS: Record<string, string> = {
    "image/gif": "gif",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
};

const PinIcon = (props: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
        <path d="M15 4V9l3 3v2h-5v7l-1 1-1-1v-7H6v-2l3-3V4H8V2h8v2z" />
    </svg>
);

const FILENAME = "better-image-editor.json";

async function exportLibrary() {
    try {
        const data = new TextEncoder().encode(await exportAll());

        if (IS_DISCORD_DESKTOP) DiscordNative.fileManager.saveWithDialog(data, FILENAME);
        else saveFile(new File([data], FILENAME, { type: "application/json" }));
    } catch (err) {
        logger.error("could not export the library", err);
        Toasts.show(Toasts.create("Could not export your pictures", Toasts.Type.FAILURE));
    }
}

async function readChosenFile() {
    if (!IS_DISCORD_DESKTOP) return (await chooseFile("application/json"))?.text() ?? null;

    const [file] = await DiscordNative.fileManager.openFiles({
        filters: [{ name: "Picture library", extensions: ["json"] }]
    });
    return file ? new TextDecoder().decode(file.data) : null;
}

async function importLibrary() {
    try {
        const json = await readChosenFile();
        if (!json) return;

        const added = await importAll(json, settings.store.librarySize);
        Toasts.show(Toasts.create(
            added ? `Added ${added} picture${added === 1 ? "" : "s"}` : "Nothing new in that file",
            Toasts.Type.SUCCESS
        ));
    } catch (err) {
        logger.error("could not import the library", err);
        Toasts.show(Toasts.create("Could not read that file", Toasts.Type.FAILURE));
    }
}

function useLibrary(kind: Kind) {
    const [group, setGroup] = useState<Group>("original");
    const [version, setVersion] = useState(0);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [thumbs, setThumbs] = useState<Record<string, string>>({});
    const [worn, setWorn] = useState<string | null>(null);

    const urls = useRef<string[]>([]);
    const bump = useCallback(() => setVersion(v => v + 1), []);
    const track = useCallback((url: string) => { urls.current.push(url); return url; }, []);

    useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

    useEffect(() => {
        let live = true;

        (async () => {
            const mine = byRecency((await readIndex()).filter(entry => entry.kind === kind && entry.group === group))
                .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
            const blobs = await getThumbs(mine.map(entry => entry.id));
            if (!live) return;

            const next: Record<string, string> = {};
            mine.forEach((entry, index) => {
                const blob = blobs[index];
                if (blob) next[entry.id] = track(URL.createObjectURL(blob));
            });

            setThumbs(next);
            setEntries(mine);
        })();

        return () => { live = false; };
    }, [kind, group, version]);

    useEffect(() => {
        currentApplied(kind)
            .then(setWorn)
            .catch(err => logger.error("could not read what you are wearing", err));
    }, [kind, version]);

    return { group, setGroup, entries, thumbs, worn, bump, track };
}

function useForget(bump: () => void) {
    return useCallback((entry: Entry, immediate: boolean) => {
        const run = () => forget(entry.id)
            .then(bump)
            .catch(err => logger.error("could not remove that picture", err));

        if (immediate) return void run();

        Alerts.show({
            title: "Remove this picture?",
            body: <p>{entry.name} goes from your saved pictures, along with the crop remembered for it.</p>,
            confirmColor: Button.Colors.RED,
            confirmText: "Remove",
            cancelText: "Cancel",
            onConfirm: run
        });
    }, [bump]);
}

// the picker stays mounted under the cropper, so only the topmost surface takes a paste
let editorsOpen = 0;

function usePasteAndDrop(accept: (file: File) => void, active: () => boolean) {
    useEffect(() => {
        const imageIn = (list: FileList | undefined) =>
            [...(list ?? [])].find(file => file.type.startsWith("image/"));

        const take = (file: File | undefined, event: Event) => {
            if (!file || !active()) return;
            event.preventDefault();
            event.stopPropagation();
            accept(file);
        };

        const onPaste = (event: ClipboardEvent) => take(imageIn(event.clipboardData?.files), event);
        const onDrop = (event: DragEvent) => take(imageIn(event.dataTransfer?.files), event);
        const onDragOver = (event: DragEvent) => {
            if (!event.dataTransfer?.types.includes("Files")) return;
            event.preventDefault();
            event.stopPropagation();
        };

        document.addEventListener("paste", onPaste, true);
        document.addEventListener("drop", onDrop, true);
        document.addEventListener("dragover", onDragOver, true);

        return () => {
            document.removeEventListener("paste", onPaste, true);
            document.removeEventListener("drop", onDrop, true);
            document.removeEventListener("dragover", onDragOver, true);
        };
    }, [accept, active]);
}

function Shelf({ kind, group, entries, thumbs, activeId, wornId, onGroup, onPick, onPin, onForget, onPutBack }: {
    kind: Kind;
    group: Group;
    entries: Entry[];
    thumbs: Record<string, string>;
    activeId: string | null;
    wornId: string | null;
    onGroup(group: Group): void;
    onPick(entry: Entry): void;
    onPin(entry: Entry): void;
    onForget(entry: Entry, immediate: boolean): void;
    onPutBack?(): void;
}) {
    const shape = SQUARE.has(kind) ? "bie-square" : "bie-wide";

    const [hovered, setHovered] = useState<string | null>(null);
    const [playing, setPlaying] = useState<Record<string, string>>({});
    const played = useRef<string[]>([]);

    useEffect(() => () => played.current.forEach(URL.revokeObjectURL), []);

    const play = useCallback(async (entry: Entry) => {
        setHovered(entry.id);
        if (!isAnimated(entry) || playing[entry.id]) return;

        const blob = await getFile(entry.id);
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        played.current.push(url);
        setPlaying(current => ({ ...current, [entry.id]: url }));
    }, [playing]);

    return (
        <div className={`bie-panel ${shape}`}>
            <div className="bie-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={group === "original"}
                    className={`bie-tab${group === "original" ? " bie-on" : ""}`}
                    onClick={() => onGroup("original")}
                >Originals</button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={group === "cropped"}
                    className={`bie-tab${group === "cropped" ? " bie-on" : ""}`}
                    onClick={() => onGroup("cropped")}
                >{croppedLabel(kind)}</button>

                {onPutBack && (
                    <button type="button" className="bie-action" onClick={onPutBack}>
                        Put back the last one
                    </button>
                )}

            </div>

            <div className="bie-strip" role="group" aria-label="Saved pictures">
                {entries.map(entry => (
                    <div
                        key={entry.id}
                        className={`bie-item${entry.pinned ? " bie-pinned" : ""}${entry.id === wornId ? " bie-worn" : ""}`}
                        onMouseEnter={() => play(entry)}
                        onMouseLeave={() => setHovered(null)}
                    >
                        <button
                            type="button"
                            aria-label={entry.name}
                            title={entry.id === wornId ? `${entry.name}
You are wearing this` : entry.name}
                            className={`bie-thumb${activeId === entry.id ? " bie-active" : ""}`}
                            style={{ backgroundImage: `url(${(hovered === entry.id && playing[entry.id]) || thumbs[entry.id]})` }}
                            onClick={() => onPick(entry)}
                            onContextMenu={event => {
                                event.preventDefault();
                                onForget(entry, event.shiftKey);
                            }}
                        />
                        <button
                            type="button"
                            className="bie-remove"
                            aria-label={`Remove ${entry.name}`}
                            title="Remove. Hold Shift to skip the confirmation"
                            onClick={event => onForget(entry, event.shiftKey)}
                        >
                            <DeleteIcon width={10} height={10} />
                        </button>
                        <button
                            type="button"
                            aria-pressed={!!entry.pinned}
                            className={`bie-pin${entry.pinned ? " bie-on" : ""}`}
                            aria-label={entry.pinned ? `Unpin ${entry.name}` : `Pin ${entry.name}`}
                            title={entry.pinned ? "Pinned, so it never drops off the shelf" : "Pin so it never drops off the shelf"}
                            onClick={() => onPin(entry)}
                        >
                            <PinIcon width={10} height={10} />
                        </button>
                    </div>
                ))}

                {!entries.length && (
                    <span className="bie-empty">
                        {group === "original"
                            ? "Pictures you pick, paste or drop land here"
                            : "Pictures you crop land here"}
                    </span>
                )}
            </div>
        </div>
    );
}

function PickerShelf({ kind, open, complete }: {
    kind: Kind;
    open(imageUri: string, file: File): void;
    complete(result: { imageUri: string; file: File; }): void;
}) {
    const { group, setGroup, entries, thumbs, worn, bump } = useLibrary(kind);
    const onForget = useForget(bump);

    // a data URI, never an object URL: that dies with the surface that made it
    const hand = useCallback(async (id: string | null, file: File, crop: CropState | null) => {
        handoff = { id, transform: crop };
        if (id) handedOver = { id, kind };
        open(await toDataUrl(file), file);
    }, [open]);

    const [putBack, setPutBack] = useState<Entry | null>(null);

    useEffect(() => {
        previousApplied(kind)
            .then(setPutBack)
            .catch(err => logger.error("could not read what you wore before", err));
    }, [kind]);

    const onPick = useCallback(async (entry: Entry) => {
        const blob = await getFile(entry.id);
        if (!blob) return;

        const file = new File([blob], entry.name, { type: blob.type });
        await touch(entry.id);
        bump();

        if (entry.group === "cropped") {
            handedOver = { id: entry.id, kind };
            return complete({ imageUri: await toDataUrl(blob), file });
        }

        await hand(entry.id, file, settings.store.rememberCrop ? entry.crop ?? null : null);
    }, [hand, complete, kind, bump]);

    const onPin = useCallback((entry: Entry) => {
        togglePin(entry.id).then(bump).catch(err => logger.error("could not pin that picture", err));
    }, [bump]);

    const accept = useCallback(async (file: File) => {
        try {
            const id = await add(file, kind, "original", settings.store.librarySize);
            bump();
            await hand(id, file, null);
        } catch (err) {
            logger.error("could not take that picture", err);
        }
    }, [kind, hand, bump]);

    usePasteAndDrop(accept, useCallback(() => editorsOpen === 0, []));

    return (
        <Shelf
            kind={kind}
            group={group}
            entries={entries}
            thumbs={thumbs}
            activeId={null}
            wornId={worn}
            onGroup={setGroup}
            onPick={onPick}
            onPin={onPin}
            onForget={onForget}
            onPutBack={putBack ? () => onPick(putBack) : undefined}
        />
    );
}

function EditorShelf({ Original, ownProps }: { Original: React.ComponentType<any>; ownProps: any; }) {
    const kind = kindOf(ownProps.uploadType);

    const { group, setGroup, entries, thumbs, worn, bump } = useLibrary(kind);
    const onForget = useForget(bump);

    const [picked, setPicked] = useState<Picked | null>(null);
    const [transform, setTransform] = useState<CropState | null>(() => handoff?.transform ?? null);

    const incomingId = useRef<string | null>(null);
    const pickedId = useRef<string | null>(null);
    const pickedName = useRef<string | null>(null);
    const pickedGroup = useRef<Group>("original");
    const captured = useRef(false);

    pickedId.current = picked?.id ?? null;
    pickedGroup.current = picked?.group ?? "original";
    pickedName.current = picked?.file.name ?? ownProps.file?.name ?? null;

    const show = useCallback(async (id: string, file: File, crop: CropState | null, group: Group = "original") => {
        setTransform(crop);
        setPicked({ id, uri: await toDataUrl(file), file, group });
    }, []);

    useEffect(() => {
        if (captured.current) return;
        captured.current = true;

        if (handoff) {
            incomingId.current = handoff.id;
            handoff = null;
            return;
        }

        if (!(ownProps.file instanceof File)) return;

        add(ownProps.file, kind, "original", settings.store.librarySize)
            .then(id => {
                incomingId.current = id;
                bump();
            })
            .catch(err => logger.error("could not save that picture", err));
    }, []);

    useEffect(() => {
        editorsOpen++;
        return () => { editorsOpen--; };
    }, []);

    // Discord's arrow-key nudging only listens on hidden inputs that Tab reaches, not a click
    useEffect(() => {
        const container = document.querySelector('[class*="editingContainer"]')?.parentElement;
        if (!container) return;

        const focusPan = () => container
            .querySelector<HTMLInputElement>('input[type="range"][aria-orientation="horizontal"]')
            ?.focus({ preventScroll: true });

        container.addEventListener("mouseup", focusPan);
        return () => container.removeEventListener("mouseup", focusPan);
    }, [picked?.id]);

    const accept = useCallback(async (file: File) => {
        try {
            const id = await add(file, kind, "original", settings.store.librarySize);
            setGroup("original");
            bump();
            await show(id, file, null);
        } catch (err) {
            logger.error("could not take that picture", err);
        }
    }, [kind, show, bump, setGroup]);

    usePasteAndDrop(accept, useCallback(() => true, []));

    const onPick = useCallback(async (entry: Entry) => {
        const blob = await getFile(entry.id);
        if (!blob) return;

        await touch(entry.id);
        bump();
        await show(entry.id, new File([blob], entry.name, { type: blob.type }), settings.store.rememberCrop ? entry.crop ?? null : null, entry.group);
    }, [show, bump]);

    const onPin = useCallback((entry: Entry) => {
        togglePin(entry.id).then(bump).catch(err => logger.error("could not pin that picture", err));
    }, [bump]);

    const keepCropped = useCallback((result: any) => {
        const uri = result?.imageUri;
        if (typeof uri !== "string") return logger.warn("the cropper returned something that cannot be saved", result);

        const source = pickedId.current ?? incomingId.current ?? undefined;
        const save = async () => {
            const stem = (pickedName.current ?? "picture").replace(/\.[^.]+$/, "");
            const blob = await fetch(uri).then(r => r.blob());
            const name = `${stem} (cropped).${EXTENSIONS[blob.type] ?? "png"}`;

            await add(new File([blob], name, { type: blob.type }), kind, "cropped", settings.store.librarySize, source);
            bump();
        };
        const run = () => save().catch(err => logger.error("could not keep the cropped copy", err));

        if (!settings.store.askBeforeSavingCropped) return void run();

        Alerts.show({
            title: "Keep the cropped copy?",
            body: <p>It goes on the {croppedLabel(kind).toLowerCase()} shelf, next to your originals.</p>,
            confirmText: "Keep",
            cancelText: "No thanks",
            onConfirm: run
        });
    }, [kind, bump]);

    const onCrop = useCallback((...args: any[]) => {
        const id = pickedId.current ?? incomingId.current;
        const transform = args[0]?.transform;

        if (id) handedOver = { id, kind };
        if (id && transform && settings.store.rememberCrop) {
            saveCrop(id, transform).catch(err => logger.error("could not remember that crop", err));
        }

        if (settings.store.saveCropped && pickedGroup.current !== "cropped") keepCropped(args[0]);

        return ownProps.onCrop?.(...args);
    }, [ownProps.onCrop, keepCropped]);

    const props = picked
        ? { ...ownProps, imageUri: picked.uri, file: picked.file, originalAsset: null, onCrop, initialTransform: transform }
        : { ...ownProps, onCrop, initialTransform: transform ?? ownProps.initialTransform };

    return (
        <Original
            key={picked?.id ?? "incoming"}
            {...props}
            bieShelf={
                <ErrorBoundary noop>
                    <Shelf
                        kind={kind}
                        group={group}
                        entries={entries}
                        thumbs={thumbs}
                        activeId={picked?.id ?? null}
                        wornId={worn}
                        onGroup={setGroup}
                        onPick={onPick}
                        onPin={onPin}
                        onForget={onForget}
                    />
                </ErrorBoundary>
            }
        />
    );
}

function onProfileSaved() {
    if (!handedOver) return;

    const { id, kind } = handedOver;
    handedOver = null;
    recordApplied(kind, id).catch(err => logger.error("could not note what you put on", err));
}

let wrapped: React.ComponentType<any> | null = null;

export default definePlugin({
    name: "BetterImageEditor",
    description: "Keeps your own pictures on the image picker and under the crop window, for avatars and banners, on an uncropped shelf and a cropped one. Remembers how you framed each picture, and takes a paste or a dropped file straight in.",
    authors: [EquicordDevs.heart_menace],
    settings,

    start() {
        FluxDispatcher.subscribe("USER_PROFILE_SETTINGS_SUBMIT_SUCCESS", onProfileSaved);
    },

    stop() {
        FluxDispatcher.unsubscribe("USER_PROFILE_SETTINGS_SUBMIT_SUCCESS", onProfileSaved);
    },

    patches: [
        {
            find: '"SET_IMAGE_ZOOM_RATIO"',
            replacement: {
                match: /\{default:\(\)=>(\i)\}/,
                replace: "{default:()=>$self.wrapEditor($1)}"
            }
        },
        {
            // grouped: rendering bieShelf without destructuring it throws
            find: '"SET_IMAGE_ZOOM_RATIO"',
            group: true,
            replacement: [
                {
                    match: /\{file:(\i),imageUri:/,
                    replace: "{bieShelf,file:$1,imageUri:"
                },
                {
                    match: /(\(0,\i\.jsx\)\(\i\.A,\{id:\i,children:)/,
                    replace: "bieShelf,$1"
                }
            ]
        },
        {
            find: 'displayName="RecentAvatarsStore"',
            replacement: {
                // takes over the slot Discord renders its own recent avatars into
                match: /(uploadType:(\i),guild:\i,handleOpenImageEditingModal:(\i),[\s\S]{0,500}?)\i&&\(0,\i\.jsx\)\(\i,\{onComplete:(\i),returnRef:\i\}\)/,
                replace: "$1$self.pickerRow($2,$3,$4)"
            }
        }
    ],

    wrapEditor(Original: React.ComponentType<any>) {
        wrapped ??= (props: any) => <EditorShelf Original={Original} ownProps={props} />;
        return wrapped;
    },

    pickerRow(uploadType: string, open: (imageUri: string, file: File) => void, complete: (result: any) => void) {
        return (
            <ErrorBoundary noop key="bie-picker">
                <PickerShelf kind={kindOf(uploadType)} open={open} complete={complete} />
            </ErrorBoundary>
        );
    }
});
