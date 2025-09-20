/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { EquicordDevs } from "@utils/constants";
import { insertTextIntoChatInputBox } from "@utils/discord";
import definePlugin from "@utils/types";
import { ComponentDispatch, ContextMenuApi, React, useEffect, useRef, useState } from "@webpack/common";

import { ContextMenu } from "./contextmenu";
import { FORMAT_KEYS } from "./list";
import { onClick } from "./utils";

const lastFormats = new Set();
export let char = "";

const formatFrame = { current: null as HTMLDivElement | null };

const FormatButton: ChatBarButtonFactory = () => {
    const [open, setOpen] = useState(false);
    const [activeTags] = useState(new Set(lastFormats));
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<string>("");
    useEffect(() => {
        formatFrame.current?.remove();
        formatFrame.current = null;
        if (!open || !wrapperRef.current) return;

        const panel = document.createElement("div");
        formatFrame.current = panel;
        Object.assign(panel.style, {
            position: "fixed",
            display: "flex",
            flexWrap: "nowrap",
            gap: "4px",
            padding: "4px 2px",
            background: "var(--background-base-low)",
            border: "1px solid var(--interactive-muted)",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 100000,
            animation: "slide-up 300ms cubic-bezier(0,0,0,1), opacity 300ms ease",
            transition: "all 200ms ease",
        });

        FORMAT_KEYS.forEach(({ label, tag, icon }) => {
            const btn = document.createElement("button");
            btn.innerHTML = icon;
            Object.assign(btn.style, {
                width: "28px",
                height: "28px",
                border: "none",
                borderRadius: "3px",
                alignItems: "center",
                justifyContent: "center",
                padding: "0",
                background: activeTags.has(tag)
                    ? "var(--background-base-lower)"
                    : "var(--background-base-low)",
                color: activeTags.has(tag) ? "var(--text-default)" : "var(--text-muted)",
                fontWeight: "normal",
                lineHeight: "0"
            });

            btn.onmouseover = () => {
                document.querySelectorAll(".tooltip").forEach(el => el.remove());

                const tooltip = document.createElement("div");
                tooltip.className = "tooltip";
                tooltip.textContent = label;
                Object.assign(tooltip.style, {
                    position: "absolute",
                    top: `${btn.getBoundingClientRect().top - 30}px`,
                    left: `${btn.getBoundingClientRect().left + btn.offsetWidth / 2}px`,
                    transform: "translateX(-50%)",
                    background: "var(--background-base-low)",
                    color: "var(--text-default)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    pointerEvents: "none",
                    zIndex: 100001,
                    textAlign: "center"
                });

                document.body.appendChild(tooltip);
                btn.style.background = "black";
                btn.style.color = "white";
            };

            btn.onmouseleave = () => {
                document.querySelectorAll(".tooltip").forEach(el => el.remove());
                btn.style.background = activeTags.has(tag)
                    ? "var(--background-base-lower)"
                    : "var(--background-base-low)";
                btn.style.color = activeTags.has(tag) ? "white" : "var(--text-muted)";
            };

            btn.oncontextmenu = e => {
                if (tag === "```") {
                    e.preventDefault();
                    ContextMenuApi.openContextMenu(e as any, () => <ContextMenu />);
                }
            };

            btn.onclick = async () => {
                const formattedText = onClick(tag);
                await ComponentDispatch.dispatch("CLEAR_TEXT", { rawText: "" });
                insertTextIntoChatInputBox(formattedText);

                panel.querySelectorAll("button").forEach((b, i) => {
                    const t = FORMAT_KEYS[i].tag;
                    (b as HTMLButtonElement).style.background = activeTags.has(t)
                        ? "black"
                        : "var(--button-secondary-background)";
                    (b as HTMLButtonElement).style.color = activeTags.has(t)
                        ? "white"
                        : "var(--text-muted)";
                });

                setOpen(false);
            };

            panel.appendChild(btn);
        });

        document.body.append(panel);
        const rect = wrapperRef.current.getBoundingClientRect();
        const panelWidth = panel.offsetWidth;
        const viewportWidth = window.innerWidth;
        let leftPosition = rect.left + -300;
        if (leftPosition < 0) {
            leftPosition = 10;
        } else if (leftPosition + panelWidth > viewportWidth) {
            leftPosition = viewportWidth - panelWidth - 10;
        }

        panel.style.left = `${leftPosition}px`;
        panel.style.top = `${rect.top - panel.offsetHeight - 6}px`;

        return () => {
            panel.remove();
            formatFrame.current = null;
        };
    }, [open, activeTags]);

    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(e.target as Node) &&
                formatFrame.current &&
                !formatFrame.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open]);

    console.log(tooltip);

    return (
        <div
            ref={wrapperRef}
            style={{ position: "relative", display: "inline-block", zIndex: 9999 }}
            onMouseEnter={() => {
                if (!open) setTooltip("Formatting Options");
            }}
            onMouseLeave={() => {
                if (!open) setTooltip("");
            }}
        >
            <ChatBarButton
                tooltip={tooltip}
                onClick={e => {
                    setOpen(o => !o);
                    setTooltip("");
                }}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <path
                        fill="currentColor"
                        d="m21.18 2.82-.45-1.2a.25.25 0 0 0-.46 0l-.45 1.2-1.2.45a.25.25 0 0 0 0 .46l1.2.45.45 1.2c.08.21.38.21.46 0l.45-1.2 1.2-.45a.25.25 0 0 0 0-.46l-1.2-.45ZM6.97 4.25l.76 2.02 2.02.76a.5.5 0 0 1 0 .94l-2.02.76-.76 2.02a.5.5 0 0 1-.94 0l-.76-2.02-2.02-.76a.5.5 0 0 1 0-.94l2.02-.76.76-2.02a.5.5 0 0 1 .94 0ZM18.53 7.6c.3-.3.3-.78 0-1.07l-1.06-1.06a.75.75 0 0 0-1.06 0l-1.94 1.94c-.3.3-.3.77 0 1.06l1.06 1.06c.3.3.77.3 1.06 0l1.94-1.94ZM14.53 11.6c.3-.3.3-.78 0-1.07l-1.06-1.06a.75.75 0 0 0-1.06 0l-9.94 9.94c-.3.3-.3.77 0 1.06l1.06 1.06c.3.3.77.3 1.06 0l9.94-9.94ZM20.73 13.27l-.76-2.02a.5.5 0 0 0-.94 0l-.76 2.02-2.02.76a.5.5 0 0 0 0 .94l2.02.76.76 2.02a.5.5 0 0 0 .94 0l.76-2.02 2.02-.76a.5.5 0 0 0 0-.94l-2.02-.76ZM10.73 1.62l.45 1.2 1.2.45c.21.08.21.38 0 .46l-1.2.45-.45 1.2a.25.25 0 0 1-.46 0l-.45-1.2-1.2-.45a.25.25 0 0 1 0-.46l1.2-.45.45-1.2a.25.25 0 0 1 .46 0Z"
                    />
                </svg>
            </ChatBarButton>
        </div>
    );
};

export default definePlugin({
    name: "BetterFormattingRedux",
    description: "Adds a button to enable different text formatting options in the input-bar.",
    authors: [EquicordDevs.omaw],
    dependencies: ["MessageEventsAPI", "ChatInputButtonAPI"],
    patches: [
        {
            find: ".CREATE_FORUM_POST||",
            replacement: {
                match: /(textValue:(\i).{0,50}channelId:\i\.id\}\)),\i/,
                replace: "$1,$self.setChar($2)"
            }
        },
    ],
    renderChatBarButton: FormatButton,
    setChar(value) {
        char = value;
    },
    stop: () => {
        formatFrame.current?.remove();
    }
});
