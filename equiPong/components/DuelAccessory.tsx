/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { classNameFactory } from "@utils/css";
import { sendMessage } from "@utils/discord";
import { ChannelStore, IconUtils, PermissionsBits, PermissionStore, React, showToast, Toasts, UserStore } from "@webpack/common";

import { buildShareMessage, decryptPayload, type EmojiPayload, encryptPayload, isValidSnowflake, normalizeScore, parseShareMessage } from "../utils/crypto";
import { openChallenge } from "../utils/launcher";

const cl = classNameFactory("emoji-pong-");

const HIGHSCORE_KEY = "emojiPongHighScore";

interface DuelAccessoryProps {
    message: { content: string; channel_id: string; author: { id: string } };
}

export function DuelAccessory({ message }: DuelAccessoryProps) {
    const [payloadScore, setPayloadScore] = React.useState<number | null>(null);
    const [myScore, setMyScore] = React.useState<number | null>(null);
    const [payloadEmoji, setPayloadEmoji] = React.useState<EmojiPayload | null>(null);

    React.useEffect(() => {
        let active = true;
        (async () => {
            setPayloadScore(null);
            setMyScore(null);
            setPayloadEmoji(null);
            const encrypted = parseShareMessage(message.content);
            if (!encrypted) return;
            if (!isValidSnowflake(message.channel_id) || !isValidSnowflake(message.author.id)) return;
            const channel = ChannelStore.getChannel(message.channel_id);
            if (!channel) return;
            const contextId = channel.guild_id ?? channel.id;
            if (!isValidSnowflake(contextId)) return;
            const decrypted = await decryptPayload(encrypted, message.channel_id, contextId, message.author.id);
            if (!active || !decrypted) return;
            setPayloadScore(decrypted.highScore ?? decrypted.score);
            setPayloadEmoji(decrypted.emoji ?? null);
            const stored = await DataStore.get(HIGHSCORE_KEY);
            const parsed = normalizeScore(stored);
            setMyScore(parsed ?? 0);
        })();
        return () => {
            active = false;
        };
    }, [message.content, message.channel_id, message.author.id]);

    if (payloadScore == null || myScore == null) return null;

    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) return null;

    const currentUser = UserStore.getCurrentUser();
    const authorUser = UserStore.getUser(message.author.id) ?? null;
    const contextId = channel.guild_id ?? channel.id;

    const authorAvatar = authorUser
        ? (IconUtils.getUserAvatarURL(authorUser, true) ?? IconUtils.getDefaultAvatarURL(message.author.id))
        : IconUtils.getDefaultAvatarURL(message.author.id);
    const viewerAvatar = currentUser
        ? (IconUtils.getUserAvatarURL(currentUser, true) ?? IconUtils.getDefaultAvatarURL(currentUser.id))
        : undefined;
    const leftScore = payloadScore;
    const rightScore = myScore;
    const leftAvatar = authorAvatar;
    const rightAvatar = viewerAvatar;
    const showLeftCrown = leftScore > rightScore;
    const showRightCrown = rightScore > leftScore;
    const isSelfEmbed = !!currentUser && message.author.id === currentUser.id;

    const handleShare = async () => {
        if (!currentUser) return;
        if (!isValidSnowflake(currentUser.id) || !isValidSnowflake(message.channel_id) || !isValidSnowflake(contextId)) {
            showToast("Could not validate channel or user id.", Toasts.Type.FAILURE);
            return;
        }
        if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) {
            showToast("You do not have permission to send messages here.", Toasts.Type.FAILURE);
            return;
        }
        const score = normalizeScore(myScore);
        if (score == null) {
            showToast("Could not validate score value.", Toasts.Type.FAILURE);
            return;
        }
        const includeDuel = isValidSnowflake(message.author.id) && message.author.id !== currentUser.id;
        const encrypted = await encryptPayload({
            userId: currentUser.id,
            channelId: message.channel_id,
            contextId,
            score,
            highScore: score,
            timestamp: Date.now(),
            emoji: payloadEmoji ?? undefined,
            duel: includeDuel
                ? {
                    opponentId: message.author.id,
                    opponentScore: payloadScore
                }
                : undefined
        });
        if (!encrypted) {
            showToast("Failed to encrypt score.", Toasts.Type.FAILURE);
            return;
        }
        await sendMessage(message.channel_id, { content: buildShareMessage(encrypted) });
        showToast("Equipong score shared.", Toasts.Type.SUCCESS);
    };

    const handleChallenge = () => {
        if (!currentUser) return;
        const opponentScore = normalizeScore(payloadScore);
        const viewerScore = normalizeScore(myScore);
        if (!isValidSnowflake(message.author.id) || opponentScore == null || viewerScore == null) return;
        openChallenge({
            opponentId: message.author.id,
            opponentScore,
            viewerScore,
            channelId: message.channel_id,
            contextId,
            opponentEmoji: payloadEmoji ?? undefined
        });
    };

    return (
        <div className={cl("duel")}>
            {isSelfEmbed ? (
                <div className={cl("duel-row")}>
                    <div className={cl("duel-player")}>
                        <div className={cl("duel-avatar-wrap")}>
                            <span className={cl("duel-crown")}>👑</span>
                            {viewerAvatar ? <img className={cl("duel-avatar")} src={viewerAvatar} alt="" /> : null}
                        </div>
                        <div className={cl("duel-score")}>{`HI ${String(Math.max(leftScore, rightScore)).padStart(3, "0")}`}</div>
                    </div>
                </div>
            ) : (
                <div className={cl("duel-row")}>
                    <div className={cl("duel-player")}>
                        <div className={cl("duel-avatar-wrap")}>
                            {showLeftCrown ? <span className={cl("duel-crown")}>👑</span> : null}
                            {leftAvatar ? <img className={cl("duel-avatar")} src={leftAvatar} alt="" /> : null}
                        </div>
                        <div className={cl("duel-score")}>{`HI ${String(leftScore).padStart(3, "0")}`}</div>
                    </div>
                    <div className={cl("duel-player")}>
                        <div className={cl("duel-avatar-wrap")}>
                            {showRightCrown ? <span className={cl("duel-crown")}>👑</span> : null}
                            {rightAvatar ? <img className={cl("duel-avatar")} src={rightAvatar} alt="" /> : null}
                        </div>
                        <div className={cl("duel-score")}>{`HI ${String(rightScore).padStart(3, "0")}`}</div>
                    </div>
                </div>
            )}
            <div className={cl("duel-actions")}>
                <button type="button" className={cl("duel-challenge")} onClick={handleChallenge}>
                    Challenge Score
                </button>
                <button type="button" className={cl("duel-share")} onClick={handleShare}>
                    Share Your Score
                </button>
            </div>
        </div>
    );
}
