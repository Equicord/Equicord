/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Flex } from "@components/Flex";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, SearchableSelect, useState } from "@webpack/common";

import { LANGUAGES } from "../utils/languages";
import { TranscriptionModal } from "./TranscriptionModal";

type RadioGroup = React.ComponentType<{ options: { name: string; value: string; }[]; value: string; onChange: (v: string) => void; }>;

let ManaBaseRadioGroup: RadioGroup;

export function setManaBaseRadioGroup(component: RadioGroup) {
    ManaBaseRadioGroup = component;
}

export function LanguageSelectionModal(props: { modalProps: RenderModalProps, src: string; }) {
    const { modalProps, src } = props;
    const [language, setLanguage] = useState<string>("auto");
    const [task, setTask] = useState<string>("transcribe");

    const languageOptions = [
        { label: "Auto Detect", value: "auto" },
        ...Object.entries(LANGUAGES).map(([code, name]) => ({
            label: name.charAt(0).toUpperCase() + name.slice(1),
            value: code
        }))
    ];

    const start = () => {
        modalProps.onClose();
        openModal(modalProps => (
            <TranscriptionModal
                modalProps={modalProps}
                src={src}
                options={{ language, task }}
            />
        ));
    };

    return (
        <Modal
            {...modalProps}
            size="md"
            title="Transcription Options"
            actions={[
                {
                    text: "Start",
                    variant: "primary",
                    onClick: start
                }
            ]}
        >
            <Flex flexDirection="column" gap={20} style={{ padding: "16px" }}>
                <div>
                    <BaseText size="sm" weight="semibold" style={{ marginBottom: "8px" }}>
                        Audio Language
                    </BaseText>
                    <SearchableSelect
                        options={languageOptions}
                        value={languageOptions.find(o => o.value === language)?.value}
                        onChange={setLanguage}
                    />
                </div>

                <div>
                    <BaseText size="sm" weight="semibold" style={{ marginBottom: "8px" }}>
                        Action
                    </BaseText>
                    <ManaBaseRadioGroup
                        options={[{
                            name: "Transcribe",
                            value: "transcribe"
                        }, {
                            name: "Translate to English",
                            value: "translate"
                        }]}
                        value={task}
                        onChange={v => setTask(v as string)}
                    />
                </div>
            </Flex>
        </Modal>
    );
}
