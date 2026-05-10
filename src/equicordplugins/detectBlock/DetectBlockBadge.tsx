/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NoEntrySignIcon } from "@components/Icons";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { User } from "@vencord/discord-types";
import { Tooltip, useEffect, useState } from "@webpack/common";

import { ensureDetection, getDetectionRecord, getDetectionTtlMs, subscribeToDetection } from "./detection";

const cl = classNameFactory("vc-detect-block-");

function useBlockState(userId: string) {
    const [record, setRecord] = useState(() => getDetectionRecord(userId));

    useEffect(() => {
        const syncState = () => {
            setRecord(getDetectionRecord(userId));
        };

        syncState();

        return subscribeToDetection(userId, syncState);
    }, [userId]);

    useEffect(() => {
        if (!record) {
            void ensureDetection(userId);
            return;
        }

        const remainingMs = record.checkedAt + getDetectionTtlMs(record.state) - Date.now();
        if (remainingMs <= 0) {
            setRecord(undefined);
            return;
        }

        const timeout = window.setTimeout(() => {
            setRecord(undefined);
        }, remainingMs);
        return () => window.clearTimeout(timeout);
    }, [record, userId]);

    return record?.state ?? "unknown";
}

export interface DetectBlockBadgeProps {
    user?: User | null;
    isMemberList?: boolean;
    isMessage?: boolean;
    isProfile?: boolean;
}

export function DetectBlockBadge({ user, isMemberList, isMessage, isProfile }: DetectBlockBadgeProps) {
    if (!user) return null;

    const state = useBlockState(user.id);
    if (state !== "blockedYou") return null;

    return (
        <Tooltip text="This user has blocked you.">
            {tooltipProps => (
                <span
                    {...tooltipProps}
                    className={classes(
                        cl("indicator"),
                        isProfile && cl("indicator-profile"),
                        isMessage && cl("indicator-message"),
                        isMemberList && cl("indicator-member-list")
                    )}
                >
                    <NoEntrySignIcon
                        className={cl("icon")}
                        width={isProfile || isMemberList ? 17 : 20}
                        height={isProfile || isMemberList ? 17 : 20}
                    />
                </span>
            )}
        </Tooltip>
    );
}
