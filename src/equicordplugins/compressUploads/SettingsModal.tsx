/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { BaseText } from "@components/BaseText";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Margins } from "@components/margins";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import type { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, Select, showToast, TextInput, Toasts, useState } from "@webpack/common";

import { settings } from "./settings";
import { useCompressing } from "./state";

const cl = classNameFactory("vc-compress-uploads-");

type BoolKey = "enabled" | "compressOversized" | "enableImages" | "enableVideos" | "losslessImages" | "h265" | "notifyOnError";
type NumberKey = "minSizeKB" | "minSavingsPercent" | "imageQuality" | "videoCrf" | "videoMaxHeight" | "audioKbps";

export function CompressIcon({ className, enabled = true }: { className?: string; enabled?: boolean; }) {
    return (
        <svg
            className={classes(className, !enabled && cl("disabled"))}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {/* the "package" being squeezed */}
            <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="5.2" strokeWidth="1.5" opacity="0.45" />
            {/* arrows pressing inwards */}
            <path d="M9.7 6.8 12 9.1l2.3-2.3" strokeWidth="1.9" />
            <path d="M9.7 17.2 12 14.9l2.3 2.3" strokeWidth="1.9" />
            <path d="M8 12h8" strokeWidth="2.1" />
            {!enabled && <path d="M6.6 6.6 17.4 17.4" strokeWidth="1.8" />}
        </svg>
    );
}

function toggleEnabled() {
    const next = !settings.store.enabled;
    settings.store.enabled = next;
    showToast(`Compression ${next ? "enabled" : "disabled"}`, next ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE);
}

export function openCompressUploadsModal() {
    openModal(modalProps => <CompressUploadsModal modalProps={modalProps} />);
}

export const CompressChatBarIcon: ChatBarButtonFactory = ({ isMainChat }) => {
    const { enabled } = settings.use(["enabled"]);
    const compressing = useCompressing();

    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={compressing ? "Compressing, please wait" : "Open Compress Modal"}
            onClick={e => {
                if (e.shiftKey) return toggleEnabled();
                openCompressUploadsModal();
            }}
            onContextMenu={e => {
                e.preventDefault();
                toggleEnabled();
            }}
            buttonProps={{
                "aria-haspopup": "dialog"
            }}
        >
            <CompressIcon className={compressing ? cl("busy") : undefined} enabled={enabled} />
        </ChatBarButton>
    );
};

function Section({ title }: { title: string; }) {
    return (
        <>
            <Divider className={classes(Margins.top16, Margins.bottom8)} />
            <BaseText className={cl("section-title")} color="text-muted" size="sm" weight="bold">{title}</BaseText>
        </>
    );
}

function RowLabel({ title, description }: { title?: string; description: string; }) {
    return (
        <>
            <BaseText color="text-strong" size="md" weight="medium">{title}</BaseText>
            <BaseText color="text-subtle" size="sm">{description}</BaseText>
        </>
    );
}

function SwitchRow({ settingKey, disabled }: { settingKey: BoolKey; disabled?: boolean; }) {
    const def = settings.def[settingKey];
    const value = settings.use([settingKey])[settingKey];

    return (
        <FormSwitch
            className={Margins.top16}
            title={def.displayName}
            description={def.description}
            value={value}
            onChange={next => { settings.store[settingKey] = next; }}
            disabled={disabled}
        />
    );
}

function NumberRow({ settingKey, disabled }: { settingKey: NumberKey; disabled?: boolean; }) {
    const def = settings.def[settingKey];
    const value = settings.use([settingKey])[settingKey];
    const [text, setText] = useState(String(value));

    return (
        <Flex className={Margins.top16} flexDirection="column" gap="8px">
            <RowLabel title={def.displayName} description={def.description} />
            <TextInput
                type="number"
                value={text}
                onChange={input => {
                    setText(input);
                    const parsed = Number(input);
                    if (input.trim() !== "" && Number.isFinite(parsed)) settings.store[settingKey] = parsed;
                }}
                disabled={disabled}
            />
        </Flex>
    );
}

function TextRow({ settingKey, disabled }: { settingKey: "ffmpegPath"; disabled?: boolean; }) {
    const def = settings.def[settingKey];
    const [text, setText] = useState(settings.use([settingKey])[settingKey]);

    return (
        <Flex className={Margins.top16} flexDirection="column" gap="8px">
            <RowLabel title={def.displayName} description={def.description} />
            <TextInput
                type="text"
                value={text}
                maxLength={null}
                onChange={input => {
                    setText(input);
                    settings.store[settingKey] = input;
                }}
                disabled={disabled}
            />
        </Flex>
    );
}

function SelectRow({ settingKey, disabled }: { settingKey: "videoPreset"; disabled?: boolean; }) {
    const def = settings.def[settingKey];
    const value = settings.use([settingKey])[settingKey];

    return (
        <Flex className={Margins.top16} flexDirection="column" gap="8px">
            <RowLabel title={def.displayName} description={def.description} />
            <Select
                placeholder="Select an option"
                options={def.options}
                maxVisibleItems={5}
                closeOnSelect={true}
                select={selected => { settings.store[settingKey] = selected; }}
                isSelected={selected => selected === value}
                serialize={value => String(value)}
                isDisabled={disabled}
            />
        </Flex>
    );
}

export function CompressUploadsModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const { enabled } = settings.use(["enabled"]);

    return (
        <Modal {...modalProps} size="lg" title="Compress Uploads">
            <div className={Margins.bottom20}>
                <SwitchRow settingKey="enabled" />

                <Section title="General" />
                <SwitchRow settingKey="compressOversized" disabled={!enabled} />
                <NumberRow settingKey="minSizeKB" disabled={!enabled} />
                <NumberRow settingKey="minSavingsPercent" disabled={!enabled} />
                <SwitchRow settingKey="notifyOnError" disabled={!enabled} />

                <Section title="Images" />
                <SwitchRow settingKey="enableImages" disabled={!enabled} />
                <SwitchRow settingKey="losslessImages" disabled={!enabled} />
                <NumberRow settingKey="imageQuality" disabled={!enabled} />

                <Section title="Videos" />
                <SwitchRow settingKey="enableVideos" disabled={!enabled} />
                <SwitchRow settingKey="h265" disabled={!enabled} />
                <NumberRow settingKey="videoCrf" disabled={!enabled} />
                <NumberRow settingKey="videoMaxHeight" disabled={!enabled} />
                <SelectRow settingKey="videoPreset" disabled={!enabled} />
                <NumberRow settingKey="audioKbps" disabled={!enabled} />
                <TextRow settingKey="ffmpegPath" disabled={!enabled} />
            </div>
        </Modal>
    );
}
