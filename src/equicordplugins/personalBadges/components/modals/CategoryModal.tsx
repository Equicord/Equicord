/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { Margins } from "@utils/margins";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { Alerts, showToast, TextInput, Toasts, useState } from "@webpack/common";

import { cl } from "../..";
import { IPBadgeCategory, IPersonalBadge } from "../../types";
import { BadgeHandler, CategoryHandler } from "../../utils/badge/data";
import { DEFAULT_BADGE_CATEGORY, DEFAULT_BADGE_CATEGORY_URL } from "../../utils/constants";
import { saveJSONFile, somethingWentWrong } from "../../utils/misc";
import { ModalSection } from "./ModalSection";


export interface CategoryModalProps {
    c_id?: string,
    props: ModalProps,
}


export function CategoryModal({ c_id, props }: CategoryModalProps) {
    let category: IPBadgeCategory | undefined;
    if (c_id) category = BadgeHandler.getCache().get(c_id);

    const [name, setName] = useState<string | undefined>(category?.name);
    const [icon, setIcon] = useState<string | undefined>(category?.icon);

    function updateCategoryProperties() {
        if (!category || !name) return;

        category.name = name;
        category.icon = icon;
    }

    return <ModalRoot {...props} size={ModalSize.SMALL}>
        <ModalHeader>
            <BaseText
                color="header-primary"
                weight="semibold"
                tag="h1"
            >
                {category ? "Edit" : "Create"} Category
            </BaseText>

            <Flex style={{ flexDirection: "row-reverse" }} >
                {category ?
                    <Button
                        disabled={!category}
                        style={{ marginLeft: 10 }}
                        variant={"link"}
                        // color={Button.Colors.PRIMARY}
                        onClick={async () => {
                            const { id: _, ...includedData } = category;

                            const badges: object[] = [];
                            includedData.badges?.forEach(x => {
                                const { id: _, c_id: __, profileBadge: ___, ...badge } = x;
                                badges.push(badge);
                            });
                            includedData.badges = badges as IPersonalBadge[];

                            saveJSONFile("pb_category.json", includedData);
                        }}
                    >
                        Export
                    </Button>
                    : (<></>)}
            </Flex>

        </ModalHeader>

        <ModalContent>
            <div className={cl("modal-form")} style={{ display: "inline", justifyContent: "center" }}>
                <ModalSection title="Name">
                    <TextInput style={{ width: "47%", marginBottom: "16px" }}
                        placeholder="✨ Sparkly ✨ Sector"
                        maxLength={20}
                        onChange={v => setName(v)}
                        value={name}
                    />
                </ModalSection>

                <ModalSection title="Icon">
                    <TextInput
                        placeholder="i.imgur.com/.png"
                        onChange={v => setIcon(v)}
                        value={icon}
                    />
                    <Paragraph className={Margins.top8}>
                        The icon for the category. Make sure it's a direct link to the image!<br /><br />
                        <code>Default: <Link href={DEFAULT_BADGE_CATEGORY_URL}>Icon</Link></code>
                    </Paragraph>
                </ModalSection>
            </div>
        </ModalContent>

        <ModalFooter className={cl("modal-footer")}>

            <Button
                disabled={!name || name.trim() === "" || name === DEFAULT_BADGE_CATEGORY}
                onClick={async () => {
                    if (!name) return;

                    const object = {
                        id: category?.id ?? "",
                        icon: icon,
                        name: name,
                        badges: []
                    };

                    if (!category) {
                        if (await CategoryHandler.register(object)) {
                            showToast(`Category "${name}" has been registered. Review the GitHub instructions to learn how to use it.`, Toasts.Type.SUCCESS);
                            props.onClose();
                        } else somethingWentWrong();
                    } else {
                        updateCategoryProperties();
                        if (await CategoryHandler.update(category)) {
                            showToast(`Category "${name}" has been updated.`, Toasts.Type.SUCCESS);
                            props.onClose();
                        } else somethingWentWrong();
                    }
                }}
            >
                {category ? "Update" : "Create"}
            </Button>

            {category ?
                <Button
                    disabled={!category}
                    variant={"dangerPrimary"}
                    // color={Button.Colors.RED}
                    onClick={async () => {
                        if (!category) return;

                        deleteAlert(async () => {
                            if (await CategoryHandler.deregister(category.id)) {
                                showToast(`Category "${name}" has been deleted, including the badges contained within it.`, Toasts.Type.SUCCESS);
                                props.onClose();
                            } else somethingWentWrong();
                        });
                    }}
                >
                    Delete
                </Button>
                : (<></>)}

            <Button variant={"none"} onClick={props.onClose}>
                Cancel
            </Button>

        </ModalFooter>
    </ModalRoot >;
}


function deleteAlert(onConfirm: () => any) {
    Alerts.show({
        title: "Are you sure?",
        body: (
            <>
                You are to be informed that when deleting any category; <b>All of the badges</b> listed under it <b>will be deleted</b>.<br /><br />
                Please consider moving them, or exporting this category before deleting if that is not what you'd intend to happen.<br /><br />
                Would you like to continue with this action? <b>There is no going back</b>.
            </>
        ),
        cancelText: "Nope...",
        confirmText: "Yep!",
        onConfirm: async () => await onConfirm()
    });
}
