/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Margins } from "@utils/margins";
import {
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalProps,
    ModalRoot,
    ModalSize,
} from "@utils/modal";
import {
    Checkbox,
    React,
    SearchableSelect,
    Slider,
    TextInput
} from "@webpack/common";

import { settings } from "./index";

interface ExportModalProps {
    modalProps: ModalProps;
    guild: { id: string; name: string };
    onExport: (guildId: string) => void;
}

export function ExportModal({ modalProps, guild, onExport }: ExportModalProps) {
    const s = settings.use();

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Heading tag="h2" style={{ flexGrow: 1 }}>
                    Export Guild "{guild.name}"
                </Heading>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent className={Margins.bottom20}>
                <section className={Margins.bottom16}>
                    <Heading tag="h3">Export Mode</Heading>
                    <SearchableSelect
                        options={[
                            { label: "Folder", value: "Folder" },
                            { label: "Zip (Save)", value: "ZipSave" },
                            { label: "Zip (Send)", value: "ZipSend" },
                        ]}
                        value={s.exportMode as any}
                        onChange={v => settings.store.exportMode = v as any}
                    />
                </section>

                {s.exportMode === "Folder" && (
                    <section className={Margins.bottom16}>
                        <Heading tag="h3">Export Directory</Heading>
                        <TextInput
                            value={s.exportDirectory}
                            placeholder="C:\GuildExports"
                            onChange={v => settings.store.exportDirectory = v}
                        />
                    </section>
                )}

                {s.exportMode === "ZipSend" && (
                    <section className={Margins.bottom16}>
                        <Heading tag="h3">Send to Channel ID</Heading>
                        <TextInput
                            value={s.sendToChannelId}
                            placeholder="1234567890..."
                            onChange={v => settings.store.sendToChannelId = v}
                        />
                    </section>
                )}

                <Divider className={Margins.bottom16} />

                <Heading tag="h3" className={Margins.bottom8}>What to export</Heading>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <Checkbox
                        value={s.exportInfo}
                        onChange={(_e, v) => settings.store.exportInfo = v}
                    >
                        Info
                    </Checkbox>
                    <Checkbox
                        value={s.exportChannels}
                        onChange={(_e, v) => settings.store.exportChannels = v}
                    >
                        Channels
                    </Checkbox>
                    <Checkbox
                        value={s.exportRoles}
                        onChange={(_e, v) => settings.store.exportRoles = v}
                    >
                        Roles
                    </Checkbox>
                    <Checkbox
                        value={s.exportAutomod}
                        onChange={(_e, v) => settings.store.exportAutomod = v}
                    >
                        Automod
                    </Checkbox>
                    <Checkbox
                        value={s.exportBans}
                        onChange={(_e, v) => settings.store.exportBans = v}
                    >
                        Banned Users
                    </Checkbox>
                    <Checkbox
                        value={s.exportMembers}
                        onChange={(_e, v) => settings.store.exportMembers = v}
                    >
                        Members
                    </Checkbox>
                    <Checkbox
                        value={s.exportEmojis}
                        onChange={(_e, v) => settings.store.exportEmojis = v}
                    >
                        Emojis
                    </Checkbox>
                    <Checkbox
                        value={s.exportStickers}
                        onChange={(_e, v) => settings.store.exportStickers = v}
                    >
                        Stickers
                    </Checkbox>
                    <Checkbox
                        value={s.exportSounds}
                        onChange={(_e, v) => settings.store.exportSounds = v}
                    >
                        Sounds
                    </Checkbox>
                </div>

                <Divider className={Margins.top16} />
                <Divider className={Margins.bottom16} />

                <section className={Margins.bottom16}>
                    <Heading tag="h3">Export files as</Heading>
                    <SearchableSelect
                        options={[
                            { label: "IDs (Unique, Safe)", value: "IDs" },
                            { label: "Names (Sanitized)", value: "Names" },
                        ]}
                        value={s.filenameFormat as any}
                        onChange={v => settings.store.filenameFormat = v as any}
                    />
                </section>

                <section className={Margins.bottom16}>
                    <Heading tag="h3">Delay between actions (ms)</Heading>
                    <Slider
                        markers={[0, 100, 250, 500, 1000, 2000]}
                        minValue={0}
                        maxValue={2000}
                        initialValue={s.actionDelay}
                        onValueChange={v => settings.store.actionDelay = Math.round(v)}
                        onValueRender={v => `${Math.round(v)}ms`}
                        stickToMarkers={false}
                    />
                </section>
            </ModalContent>

            <ModalFooter>
                <Button
                    onClick={() => {
                        onExport(guild.id);
                        modalProps.onClose();
                    }}
                    variant="positive"
                >
                    Export
                </Button>
                <div style={{ width: "16px" }} />
                <Button
                    onClick={modalProps.onClose}
                    variant="link"
                >
                    Cancel
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
