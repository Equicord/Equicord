/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { insertTextIntoChatInputBox } from "@utils/discord";
import { ContextMenuApi, Menu } from "@webpack/common";

import { char } from ".";
import { allLanguages } from "./list";

export function ContextMenu() {

    const handleInsertCodeblock = (lang: string) => {
        const selectedText = char;
        const codeblock = `\u0060\u0060\u0060${lang}\n${selectedText || ""}\n\u0060\u0060\u0060`;
        insertTextIntoChatInputBox(codeblock);
    };
    return (
        <Menu.Menu
            navId="codeblock-languages"
            onClose={ContextMenuApi.closeContextMenu}
        >
            <Menu.MenuGroup>
                {Object.entries(allLanguages).map(([letter, langs]) => (
                    <Menu.MenuItem
                        key={letter}
                        id={`lang-group-${letter}`}
                        label={letter}
                    >
                        <>
                            {Object.entries(langs as Record<string, string>).map(([lang, label]) => (
                                <Menu.MenuItem
                                    key={lang}
                                    id={`lang-${lang}`}
                                    label={label as React.ReactNode}
                                    action={() => { handleInsertCodeblock(lang); }}
                                />
                            ))}
                        </>
                    </Menu.MenuItem>
                ))}
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}
