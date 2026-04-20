/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { Button, TabBar, Text, useEffect, useState } from "@webpack/common";

import { clearLogs } from "../logs";
import {
    cl,
    clearAllData,
    flushCurrentSession,
    formatDuration,
    getChannelStats,
    getFriendsStats,
    getServerStats,
    getTotalMessages,
    getTotalTime,
    getUserStats,
} from "../store";
import { LogsTab } from "./LogsTab";
import { ChannelTab, FriendsTab, ServerTab, UsersTab } from "./Tabs";

export function VoiceTimeModal({ modalProps }: { modalProps: ModalProps; }) {
    const [tab, setTab] = useState<string>("servers");
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            flushCurrentSession();
            forceUpdate(n => n + 1);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const serverStats = getServerStats();
    const channelStats = getChannelStats();
    const userStats = getUserStats();
    const friendsStats = getFriendsStats();
    const totalTime = getTotalTime();

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader className={cl("head")}>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Voice Time Tracker</Text>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <div className={cl("sticky")}>
                <div className={cl("total")}>
                    <div className={cl("total-item")}>
                        <span className={cl("total-label")}>Total Voice Time</span>
                        <span className={cl("total-value")}>{formatDuration(totalTime)}</span>
                    </div>
                    <div className={cl("total-item")}>
                        <span className={cl("total-label")}>Total Messages</span>
                        <span className={cl("total-value")}>{getTotalMessages().toLocaleString()}</span>
                    </div>
                </div>

                <TabBar
                    type="top"
                    look="brand"
                    className={classes("vc-settings-tab-bar", cl("tab-bar"))}
                    selectedItem={tab}
                    onItemSelect={setTab}
                >
                    <TabBar.Item className="vc-settings-tab-bar-item" id="servers">By Server</TabBar.Item>
                    <TabBar.Item className="vc-settings-tab-bar-item" id="channels">By Channel</TabBar.Item>
                    <TabBar.Item className="vc-settings-tab-bar-item" id="users">Users</TabBar.Item>
                    <TabBar.Item className="vc-settings-tab-bar-item" id="friends">Friends</TabBar.Item>
                    <TabBar.Item className="vc-settings-tab-bar-item" id="logs">Logs</TabBar.Item>
                </TabBar>
            </div>

            <ModalContent className={cl("contents")}>
                {tab === "servers" && <ServerTab stats={serverStats} />}
                {tab === "channels" && <ChannelTab stats={channelStats} />}
                {tab === "users" && <UsersTab channelStats={channelStats} userStats={userStats} />}
                {tab === "friends" && <FriendsTab stats={friendsStats} />}
                {tab === "logs" && <LogsTab />}
            </ModalContent>

            <ModalFooter>
                <Button
                    color={Button.Colors.RED}
                    onClick={() => {
                        clearAllData();
                        clearLogs();
                        forceUpdate(n => n + 1);
                    }}
                >
                    Clear data
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
