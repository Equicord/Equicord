/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { HeadingSecondary } from "@components/Heading";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, SearchableSelect, useEffect, useMemo, useState } from "@webpack/common";

import { DATASTORE_KEY, getSystemTimezone, resolveUserTimezone, settings, timezones } from ".";
import { setTimezone, setUserDatabaseTimezone } from "./database";

export async function setUserTimezone(userId: string, timezone: string | null) {
    timezones[userId] = timezone;
    await DataStore.set(DATASTORE_KEY, timezones);
}

const cl = classNameFactory("vc-timezone-");

export function SetTimezoneModal({ userId, modalProps, database }: { userId: string, modalProps: RenderModalProps; database?: boolean; }) {
    const [currentValue, setCurrentValue] = useState<string | null>(null);

    useEffect(() => {
        const resolvedTimezone = resolveUserTimezone(userId);
        setCurrentValue(resolvedTimezone ?? getSystemTimezone());
    }, [userId, settings.store.useDatabase, settings.store.preferDatabaseOverLocal]);

    const options = useMemo(() => {
        return Intl.supportedValuesOf("timeZone").map(timezone => {
            const offset = new Intl.DateTimeFormat(undefined, { timeZone: timezone, timeZoneName: "short" })
                .formatToParts(new Date())
                .find(part => part.type === "timeZoneName")!.value;

            return { label: `${timezone} (${offset})`, value: timezone };
        });
    }, []);

    const actions = [
        {
            text: "Save",
            variant: "primary",
            disabled: currentValue === null,
            onClick: async () => {
                if (database) {
                    const success = await setTimezone(currentValue!);
                    if (success) {
                        await setUserDatabaseTimezone(userId, currentValue);
                    }
                } else {
                    await setUserTimezone(userId, currentValue);
                }

                modalProps.onClose();
            }
        }
    ];

    if (!database) {
        actions.unshift({
            text: "Delete Timezone",
            variant: "dangerPrimary",
            disabled: false,
            onClick: async () => {
                await setUserTimezone(userId, null);
                modalProps.onClose();
            }
        });
    }

    return (
        <Modal
            {...modalProps}
            size="sm"
            title="Timezones"
            actions={actions}
        >
            <section className={Margins.bottom16}>
                <HeadingSecondary>
                    Select Timezone
                </HeadingSecondary>

                <SearchableSelect
                    options={options}
                    value={options.find(o => o.value === currentValue)?.value}
                    placeholder={"Select a Timezone"}
                    maxVisibleItems={5}
                    closeOnSelect={true}
                    onChange={v => setCurrentValue(v)}
                />
            </section>
        </Modal>
    );
}
