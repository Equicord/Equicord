/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { characters } from "@equicordplugins/sekaiStickers/characters.json";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal,React, ScrollerThin, TextInput } from "@webpack/common";

export default function CharSelectModal({ modalProps, setCharacter }: { modalProps: RenderModalProps; setCharacter?: any; }) {
    const [search, setSearch] = React.useState<string>("");

    const memoedSearchChar = React.useMemo(() => {
        const s = search.toLowerCase();
        return characters.map((c, index) => {
            if (
                s === c.id ||
                c.name.toLowerCase().includes(s) ||
                c.character.toLowerCase().includes(s)
            ) {
                return (
                    <img key={index} onClick={() => { modalProps.onClose(); setCharacter(index); }} src={`https://st.ayaka.one/img/${c.img}`} srcSet={`https://st.ayaka.one/img/${c.img}`} loading="lazy" />
                );
            }

            return null;
        });
    }, [search, characters]);
    return (
        <Modal {...modalProps} size="lg" title="Select character menu">
            <Flex flexDirection="column" style={{ paddingTop: 12 }}>
                <TextInput content="mafuyu" placeholder="Mafuyu" onChange={(e: string) => setSearch(e)} />
                <ScrollerThin style={{ height: 520 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 330px)", rowGap: 6, columnGap: 5, gridTemplateRows: "repeat(3, 256px)" }}>
                        {memoedSearchChar}
                    </div>
                </ScrollerThin>
            </Flex>
        </Modal>
    );
}
