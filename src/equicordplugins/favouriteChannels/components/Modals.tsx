/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { classNameFactory } from "@utils/css";
import { getIntlMessage } from "@utils/discord";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, TextInput, useState } from "@webpack/common";

import { createCategory, deleteCategory } from "../data";
import { FavouriteCategory } from "../settings";

const cl = classNameFactory("vc-favourites-");

interface NameModalOptions {
    title: string;
    confirmText: string;
    label: string;
    placeholder: string;
    description?: string;
    initialValue?: string;
    allowEmpty?: boolean;
    onSubmit(value: string): void;
}

function NameModal({ modalProps, options }: { modalProps: RenderModalProps; options: NameModalOptions; }) {
    const [value, setValue] = useState(options.initialValue ?? "");
    const disabled = !options.allowEmpty && !value.trim();

    const submit = () => {
        if (disabled) return;
        options.onSubmit(value);
        modalProps.onClose();
    };

    return (
        <form onSubmit={e => { e.preventDefault(); submit(); }}>
            <Modal
                {...modalProps}
                title={options.title}
                actions={[
                    { text: getIntlMessage("CANCEL"), variant: "secondary", onClick: modalProps.onClose },
                    { text: options.confirmText, variant: "primary", onClick: submit, disabled }
                ]}
            >
                <TextInput
                    label={options.label}
                    value={value}
                    onChange={setValue}
                    placeholder={options.placeholder}
                    maxLength={100}
                    autoFocus
                />
                {options.description ? <BaseText size="sm" color="text-default" className={cl("modal-description")}>{options.description}</BaseText> : null}
            </Modal>
        </form>
    );
}

export const openNameModal = (options: NameModalOptions) =>
    openModal(modalProps => <NameModal modalProps={modalProps} options={options} />);

export const openCreateCategoryModal = () =>
    openNameModal({
        title: getIntlMessage("CREATE_CATEGORY"),
        confirmText: getIntlMessage("CREATE_CATEGORY"),
        label: getIntlMessage("CATEGORY_NAME"),
        placeholder: getIntlMessage("CATEGORY_NAME_PLACEHOLDER"),
        onSubmit: createCategory
    });

export const openDeleteCategoryModal = (category: FavouriteCategory) =>
    openModal(modalProps => (
        <Modal
            {...modalProps}
            title={getIntlMessage("DELETE_FAVORITES_CHANNEL_TITLE")}
            subtitle={getIntlMessage("DELETE_FAVORITES_CATEGORY_BODY", { channelName: category.name })}
            actions={[
                { text: getIntlMessage("CANCEL"), variant: "secondary", onClick: modalProps.onClose },
                {
                    text: getIntlMessage("DELETE_FAVORITES_CATEGORY_CONFIRM"),
                    variant: "critical-primary",
                    onClick: () => {
                        modalProps.onClose();
                        deleteCategory(category.id);
                    }
                }
            ]}
        />
    ));
