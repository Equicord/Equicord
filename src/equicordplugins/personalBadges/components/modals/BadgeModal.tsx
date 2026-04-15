/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./modal.css";
import "../../styles.css";

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { Margins } from "@utils/margins";
import { identity } from "@utils/misc";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { SelectOption } from "@vencord/discord-types";
import { Alerts, Select, showToast, TextInput, Toasts, useState } from "@webpack/common";

import { cl } from "../..";
import { IPersonalBadge } from "../../types";
import { BadgeHandler } from "../../utils/badge/data";
import { DEFAULT_BADGE_CATEGORY, DEFAULT_BADGE_URL, GITHUB_URL } from "../../utils/constants";
import { openJSONFile, saveJSONFile, somethingWentWrong } from "../../utils/misc";
import { BadgeMenuItemLabel, CategoryMenuItemLabel } from "../context";
import { ModalSection } from "./ModalSection";


export function BadgeModal(props: ModalProps) {
    const defaultCategory = Array.from(BadgeHandler.getCache().entries()).find(x => x[1].name === DEFAULT_BADGE_CATEGORY)?.[1];

    const [category, setCategory] = useState<string | undefined>(defaultCategory?.id);

    const [badge, setBadge] = useState<IPersonalBadge>();

    const [image, setImage] = useState<string | undefined>();
    const [tooltip, setTooltip] = useState<string | undefined>();
    const [link, setLink] = useState<string | undefined>();

    const [position, setPosition] = useState<string>("Start");
    const [squircle, setSquircle] = useState<boolean>(false);
    const [global, setGlobal] = useState<boolean>(false);

    const [excluded, setExcluded] = useState<string[] | undefined>([]);
    const [users, setUsers] = useState<string[] | undefined>([]);
    const [guilds, setGuilds] = useState<string[] | undefined>([]);


    const categoryOptions: SelectOption[] = [];

    Array.from(BadgeHandler.getCache().entries()).map(x => {
        categoryOptions.push({
            label: x[1].name,
            value: x[1],
            disabled: !x[1].id,
            default: category === defaultCategory?.id
        });
    });

    const badgeOptions: SelectOption[] = [];

    badgeOptions.push({
        label: "None",
        value: undefined,
        default: true
    });

    Array.from(BadgeHandler.getCache().entries()).map(x => {
        for (const badge of x[1].badges ?? []) {
            badgeOptions.push({
                label: badge.tooltip ?? "No Tooltip",
                value: [x[1].id, badge],
                disabled: !x[1].id
            });
        }
    });

    function updateBadgeProperties() {
        if (!badge) return;

        badge.image = image;
        badge.tooltip = tooltip;
        badge.link = link;

        badge.position = position;
        badge.squircle = squircle;
        badge.global = global;
    }

    function setAll(c_id: string | undefined, b: IPersonalBadge | undefined, setBadgeUndefined: boolean = false) {
        const formattedPosition = b?.position ? b.position.charAt(0).toUpperCase() + b.position.slice(1).toLowerCase() : undefined;

        setCategory(c_id ?? defaultCategory?.id);
        setBadge(setBadgeUndefined ? undefined : b);

        setImage(b?.image ?? "");
        setTooltip(b?.tooltip ?? "");
        setLink(b?.link ?? "");

        setPosition(formattedPosition ?? "Start");
        setSquircle(b?.squircle ?? false);
        setGlobal(b?.global ?? false);

        setExcluded(b?.excluded ?? []);
        setUsers(b?.users ?? []);
        setGuilds(b?.guilds ?? []);
    }


    return <ModalRoot {...props} size={ModalSize.LARGE}>
        <ModalHeader className={cl("modal-header")}>
            <BaseText
                color="header-primary"
                weight="semibold"
                tag="h1"
            >
                {badge ? "Edit" : "Create"} Badge
            </BaseText>

            <Select popoutWidth={270}
                options={categoryOptions}
                select={v => setCategory(v?.id)}
                serialize={identity}
                isSelected={v => category === v?.id}
                renderOptionLabel={o => (
                    o.value ? CategoryMenuItemLabel(o.value) : o.label
                )}
                renderOptionValue={opts => (
                    opts.map(o => o.value ? CategoryMenuItemLabel(o.value) : o.label)
                )}
            />

            <Select popoutWidth={270}
                options={badgeOptions}
                serialize={identity}
                isSelected={v => badge === v?.[1]}
                renderOptionLabel={o => (
                    o.value?.[1] ? BadgeMenuItemLabel(o.value?.[1]) : o.label
                )}
                renderOptionValue={opts => (
                    opts.map(o => o.value?.[1] ? BadgeMenuItemLabel(o.value[1]) : o.label)
                )}
                select={(v: [string, IPersonalBadge]) => {
                    const category = v?.[0];
                    const badge = v?.[1];
                    setAll(category, badge);
                }}
            />

            <Flex style={{ flexDirection: "row-reverse", gap: "16px" }}>

                <Button
                    variant={"link"}
                    // color={Button.Colors.PRIMARY}
                    onClick={async () => {
                        await openJSONFile(async (data: IPersonalBadge) => {
                            if (Array.isArray(data))
                                data = data[0]; // sorry only support adding one badge at a time, please manually modify the file to be in the format of a category instead
                            setAll(undefined, data, true);
                            showToast(`Badge "${tooltip}" data has been imported into the modal. (This includes users, guilds, etc.)`, Toasts.Type.SUCCESS);
                        });
                    }}
                >
                    Import
                </Button>

                {badge ?
                    <Button
                        disabled={!badge}
                        variant={"link"}
                        // color={Button.Colors.PRIMARY}
                        onClick={async () => {
                            const { id: _, c_id: __, profileBadge: ___, ...includedData } = badge;
                            saveJSONFile("p_badge.json", includedData);
                        }}
                    >
                        Export
                    </Button>
                    : (<></>)}

            </Flex>

        </ModalHeader>

        <ModalContent>
            <div className={cl("modal-form")}>
                <ModalSection title="Image">
                    <TextInput
                        placeholder="i.imgur.com/.png"
                        onChange={v => setImage(v)}
                        value={image}
                    />
                    <Paragraph className={Margins.top8}>
                        The icon for the badge. Make sure it's a direct link to the image!<br /><br />
                        <code>Default: <Link href={DEFAULT_BADGE_URL}>Icon</Link></code>
                    </Paragraph>
                </ModalSection>

                <ModalSection title="Tooltip">
                    <TextInput
                        placeholder="You're so ✨ Sparkly ✨"
                        onChange={v => setTooltip(v)}
                        value={tooltip}
                    />
                    <Paragraph className={Margins.top8}>
                        The text that appears when you hover over the badge.<br /><br />
                        <code>Default: None</code>
                    </Paragraph>
                </ModalSection>

                <ModalSection title="Link">
                    <TextInput
                        placeholder="https://..."
                        onChange={v => setLink(v)}
                        value={link}
                    />
                    <Paragraph className={Margins.top8}>
                        The link to open when you click on the badge.<br /><br />
                        <code>Default: <Link href={GITHUB_URL}>GitHub</Link></code>
                    </Paragraph>
                </ModalSection>
            </div>

            <Divider className={cl("form-divider")} />

            <div className={cl("modal-form")}>
                <ModalSection title="Position">
                    <Select
                        options={[
                            { label: "Start", value: "Start" },
                            { label: "End", value: "End" }
                        ]}
                        select={v => setPosition(v)}
                        serialize={identity}
                        isSelected={v => position === v}
                    />
                    <Paragraph style={{ marginTop: 8 }}>
                        This will position the badge closer to the end or start of your badges.<br /><br />
                        <code>Default: Start</code>
                    </Paragraph>
                </ModalSection>

                <ModalSection title="Is Squircle">
                    <Select
                        options={[
                            { label: "True", value: true },
                            { label: "False", value: false }
                        ]}
                        select={v => setSquircle(v)}
                        serialize={identity}
                        isSelected={v => squircle === v}
                    />
                    <Paragraph className={Margins.top8}>
                        If <code>True</code>, this badge will instead appear as a rounded square rather than a circle.<br /><br />
                        <code>Default: False</code>
                    </Paragraph>
                </ModalSection>

                <ModalSection title="Is Global">
                    <Select
                        options={[
                            { label: "True", value: true },
                            { label: "False", value: false }
                        ]}
                        select={v => setGlobal(v)}
                        serialize={identity}
                        isSelected={v => global === v}
                    />
                    <Paragraph className={Margins.top8}>
                        If <code>True</code>, this badge will be applied to every user that you view.<br /><br />
                        <code>Default: False</code>
                    </Paragraph>
                </ModalSection>
            </div>
        </ModalContent>

        <ModalFooter className={cl("modal-footer")}>
            <Button
                disabled={!category}
                onClick={async () => {
                    if (!category) return;

                    const object = {
                        id: "",
                        c_id: "",

                        image: image,
                        tooltip: tooltip,
                        link: link,

                        position: position,
                        squircle: squircle,
                        global: global,

                        excluded: excluded,
                        users: users,
                        guilds: guilds
                    };

                    if (!badge) {
                        if (await BadgeHandler.register(category, object)) {
                            showToast(`Badge "${tooltip}" has been registered. Review the GitHub instructions to learn how to use it.`, Toasts.Type.SUCCESS);
                            props.onClose();
                        } else somethingWentWrong();
                    } else {
                        updateBadgeProperties();
                        if (await BadgeHandler.update(category, badge)) {
                            showToast(`Badge "${tooltip}" has been updated.`, Toasts.Type.SUCCESS);
                            props.onClose();
                        } else somethingWentWrong();
                    }
                }}
            >
                {badge ? "Update" : "Create"}
            </Button>

            {badge ?
                <Button
                    disabled={!category || !badge}
                    variant={"dangerPrimary"}
                    // color={Button.Colors.RED}
                    onClick={async () => {
                        if (!category) return;
                        if (!badge) return;

                        deleteAlert(async () => {
                            if (await BadgeHandler.deregister(category, badge.id)) {
                                showToast(`Badge "${tooltip}" has been deleted.`, Toasts.Type.SUCCESS);
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
                You are to be informed that deleting a badge is irreversible.<br /><br />
                Please consider exporting this badge beforehand, if this is not what you'd intend.<br /><br />
                Would you like to continue with this action? <b>There is no going back</b>.
            </>
        ),
        cancelText: "Nope...",
        confirmText: "Yep!",
        onConfirm: async () => await onConfirm()
    });
}
