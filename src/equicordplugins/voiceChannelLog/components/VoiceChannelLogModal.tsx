/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";
import { Channel, RenderModalProps } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { Modal, openModal, React, ScrollerThin } from "@webpack/common";

import { clearLogs, getVcLogs, vcLogSubscribe } from "../logs";
import { cl } from "../utils";
import { VoiceChannelLogEntryComponent } from "./VoiceChannelLogEntryComponent";

const AccessibilityStore = findStoreLazy("AccessibilityStore");

export function openVoiceChannelLog(channel: Channel) {
    return openModal(props => (
        <VoiceChannelLogModal props={props} channel={channel} />
    ));
}

export function VoiceChannelLogModal({ channel, props }: { channel: Channel; props: RenderModalProps; }) {
    const logs = React.useSyncExternalStore(vcLogSubscribe, () => getVcLogs(channel.id));

    return (
        <Modal
            {...props}
            size="lg"
            title={`${channel.name} logs`}
            actions={[
                {
                    text: "Clear logs",
                    variant: "dangerPrimary",
                    onClick: () => clearLogs(channel.id)
                }
            ]}
        >
            <ScrollerThin fade className={classes(cl("scroller"), `group-spacing-${AccessibilityStore.messageGroupSpacing}`)}>
                {logs.length > 0 ? logs.map((entry, i) => {
                    const elements: React.ReactNode[] = [];

                    if (i === 0 || entry.timestamp.toDateString() !== logs[i - 1].timestamp.toDateString()) {
                        elements.push(
                            <div key={`sep-${i}`} className={cl("date-separator")} role="separator" aria-label={entry.timestamp.toDateString()}>
                                <span>{entry.timestamp.toDateString()}</span>
                            </div>
                        );
                    }

                    elements.push(
                        <VoiceChannelLogEntryComponent key={`entry-${i}`} logEntry={entry} channel={channel} />
                    );

                    return elements;
                }) : (
                    <div className={cl("empty")}>No logs to display.</div>
                )}
            </ScrollerThin>
        </Modal>
    );
}
