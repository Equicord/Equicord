/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DeleteIcon } from "@components/Icons";
import { classNameFactory } from "@utils/css";
import { React, useCallback, useEffect, useRef, useState } from "@webpack/common";

import { Entry, getFile, Group, Kind } from "../library";

export const cl = classNameFactory("vc-bie-");

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
    PERSONAL_WIDGET_FIELD: "widget images"
};

const kindName = (kind: Kind) => KIND_NAMES[kind] ?? kind.toLowerCase().replace(/_/g, " ");

const isAnimated = (entry: Entry) => entry.type === "image/gif" || entry.name.toLowerCase().endsWith(".gif");
export const croppedLabel = (kind: Kind) => `Cropped ${kindName(kind)}`;

const PinIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
        <path d="M15 4V9l3 3v2h-5v7l-1 1-1-1v-7H6v-2l3-3V4H8V2h8v2z" />
    </svg>
);

export function Shelf({ kind, group, entries, thumbs, activeId, wornId, onGroup, onPick, onPin, onForget, onPutBack }: {
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
    const shape = SQUARE.has(kind) ? "square" : "wide";

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
        <div className={cl("panel", shape)}>
            <div className={cl("tabs")} role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={group === "original"}
                    className={cl("tab", { on: group === "original" })}
                    onClick={() => onGroup("original")}
                >Originals</button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={group === "cropped"}
                    className={cl("tab", { on: group === "cropped" })}
                    onClick={() => onGroup("cropped")}
                >{croppedLabel(kind)}</button>

                {onPutBack && (
                    <button type="button" className={cl("action")} onClick={onPutBack}>
                        Put back the last one
                    </button>
                )}

            </div>

            <div className={cl("strip")} role="group" aria-label="Saved pictures">
                {entries.map(entry => (
                    <div
                        key={entry.id}
                        className={cl("item", { pinned: entry.pinned, worn: entry.id === wornId })}
                        onMouseEnter={() => play(entry)}
                        onMouseLeave={() => setHovered(null)}
                    >
                        <button
                            type="button"
                            aria-label={entry.name}
                            title={entry.id === wornId ? `${entry.name}
You are wearing this` : entry.name}
                            className={cl("thumb", { active: activeId === entry.id })}
                            style={{ backgroundImage: `url(${(hovered === entry.id && playing[entry.id]) || thumbs[entry.id]})` }}
                            onClick={() => onPick(entry)}
                            onContextMenu={event => {
                                event.preventDefault();
                                onForget(entry, event.shiftKey);
                            }}
                        />
                        <button
                            type="button"
                            className={cl("remove")}
                            aria-label={`Remove ${entry.name}`}
                            title="Remove. Hold Shift to skip the confirmation"
                            onClick={event => onForget(entry, event.shiftKey)}
                        >
                            <DeleteIcon width={10} height={10} />
                        </button>
                        <button
                            type="button"
                            aria-pressed={!!entry.pinned}
                            className={cl("pin", { on: entry.pinned })}
                            aria-label={entry.pinned ? `Unpin ${entry.name}` : `Pin ${entry.name}`}
                            title={entry.pinned ? "Pinned, so it never drops off the shelf" : "Pin so it never drops off the shelf"}
                            onClick={() => onPin(entry)}
                        >
                            <PinIcon width={10} height={10} />
                        </button>
                    </div>
                ))}

                {!entries.length && (
                    <span className={cl("empty")}>
                        {group === "original"
                            ? "Pictures you pick, paste or drop land here"
                            : "Pictures you crop land here"}
                    </span>
                )}
            </div>
        </div>
    );
}
