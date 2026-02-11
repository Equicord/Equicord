/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { classNameFactory } from "@utils/css";
import { sendMessage } from "@utils/discord";
import { ChannelStore, IconUtils, PermissionsBits, PermissionStore, React, SelectedChannelStore, showToast, Toasts, useEffect, useMemo, useRef, UserStore, useState } from "@webpack/common";

import { buildShareMessage, type EmojiPayload, encryptPayload, isValidSnowflake, normalizeScore } from "../utils/crypto";

const cl = classNameFactory("emoji-pong-");

type GameState = "playing" | "dying" | "gameover";

type StartEmoji =
    | { type: "text"; value: string; }
    | { type: "image"; url: string; alt?: string; };
type StartEmojiWithContext = StartEmoji & {
    channelId?: string;
    contextId?: string;
    messageId?: string;
    duel?: {
        opponentId: string;
        opponentScore: number;
        viewerScore: number;
    };
};

interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    emoji: StartEmoji;
    rotation: number;
}

interface Base {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface EmojiDrop {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    angle: number;
    angularVelocity: number;
    settled: boolean;
    targetY: number;
}

interface DeathState {
    active: boolean;
    startedAt: number;
    angle: number;
    alpha: number;
    shake: number;
    gameOverAlpha: number;
}

interface GameProps {
    onClose: () => void;
    startEmoji: StartEmojiWithContext | null;
}

const WIDTH = 375;
const HEIGHT = 667;
const PADDLE_WIDTH = WIDTH * 0.26;
const PADDLE_HEIGHT = 30;
const EMOJI_RADIUS = 24;

const PHYSICS = {
    initialSpeedMin: 4.5,
    initialSpeedMax: 6.5,
    perHitSpeedMultiplier: 1.04,
    maxSpeed: 28,
    maxBounceAngleDeg: 60,
    minVerticalRatio: 0.68,
    maxHorizontalRatio: 0.74,
    deathDurationMs: 1300,
    deathFallSpeed: 8,
    deathFadeStart: 0.75
};

const STAGE_COLORS = [
    "#FFEB3B",
    "#FFC107",
    "#FF9800",
    "#FF5722",
    "#E91E63",
    "#6A1B9A"
];

const STAGE_SPEED_MULTIPLIERS = [
    1.0,
    1.08,
    1.18,
    1.3,
    1.45,
    1.65
];

function randBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function randDeg(min: number, max: number) {
    return randBetween(min, max) * (Math.PI / 180);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function clampSpeed(ball: Ball) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > PHYSICS.maxSpeed && speed > 0) {
        ball.vx = (ball.vx / speed) * PHYSICS.maxSpeed;
        ball.vy = (ball.vy / speed) * PHYSICS.maxSpeed;
    }
}

function getStage(score: number) {
    return clamp(Math.floor(score / 5), 0, STAGE_COLORS.length - 1);
}

function getEmojiText(emoji: StartEmoji | null | undefined) {
    if (!emoji) return "🏀";
    if (emoji.type === "text") return emoji.value;
    return emoji.alt ?? "🏀";
}

function getEmojiImage(emoji: StartEmoji | null | undefined, cache: Map<string, HTMLImageElement>) {
    if (!emoji || emoji.type !== "image") return null;
    const existing = cache.get(emoji.url);
    if (existing) return existing;
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.referrerPolicy = "no-referrer";
    img.src = emoji.url;
    cache.set(emoji.url, img);
    return img;
}

function stripContext(emoji: StartEmojiWithContext): EmojiPayload {
    if (emoji.type === "text") return { type: "text", value: emoji.value };
    return { type: "image", url: emoji.url, alt: emoji.alt };
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export function Game({ onClose, startEmoji }: GameProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const emojiImageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

    const [state, setState] = useState<GameState>("playing");
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const mouseXRef = useRef(WIDTH / 2);
    const stateRef = useRef<GameState>("playing");
    const selectedEmojiRef = useRef<StartEmojiWithContext | null>(startEmoji);
    const scoreRef = useRef(0);
    const highScoreRef = useRef(0);
    const baseSpeedRef = useRef(0);
    const rotateOnWallNextRef = useRef(true);
    const contextRef = useRef<{ channelId?: string; contextId?: string; } | null>(null);
    const duelRef = useRef<StartEmojiWithContext["duel"] | null>(null);
    const rainRef = useRef<EmojiDrop[]>([]);
    const lastFrameRef = useRef<number | null>(null);
    const deathRef = useRef<DeathState>({
        active: false,
        startedAt: 0,
        angle: 0,
        alpha: 1,
        shake: 0,
        gameOverAlpha: 0
    });

    const baseRef = useRef<Base>({
        x: WIDTH / 2 - PADDLE_WIDTH / 2,
        y: HEIGHT - 50 - PADDLE_HEIGHT,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
    });

    const ballRef = useRef<Ball>({
        x: WIDTH / 2,
        y: HEIGHT * 0.3,
        vx: 0,
        vy: 0,
        radius: EMOJI_RADIUS,
        emoji: { type: "text", value: "🏀" },
        rotation: 0
    });

    const highScoreLabel = useMemo(() => `HI ${String(highScore).padStart(3, "0")}`, [highScore]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stored = await DataStore.get("emojiPongHighScore");
                const safeScore = normalizeScore(stored) ?? 0;
                if (!mounted) return;
                highScoreRef.current = safeScore;
                setHighScore(safeScore);
            } catch {
                if (!mounted) return;
                highScoreRef.current = 0;
                setHighScore(0);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    function setGameState(next: GameState) {
        stateRef.current = next;
        setState(next);
    }

    function setScoreValue(next: number) {
        scoreRef.current = next;
        setScore(next);
    }

    function setHighScoreValue(next: number) {
        highScoreRef.current = next;
        setHighScore(next);
    }

    useEffect(() => {
        if (!startEmoji) return;
        selectedEmojiRef.current = startEmoji;
        resetGame(startEmoji);
    }, [startEmoji]);

    const resetGame = (emoji: StartEmojiWithContext) => {
        const initialSpeed = randBetween(PHYSICS.initialSpeedMin, PHYSICS.initialSpeedMax);
        baseSpeedRef.current = initialSpeed;
        rotateOnWallNextRef.current = true;
        contextRef.current = { channelId: emoji.channelId, contextId: emoji.contextId };
        duelRef.current = emoji.duel ?? null;
        setScoreValue(0);
        rainRef.current = [];
        deathRef.current = {
            active: false,
            startedAt: 0,
            angle: 0,
            alpha: 1,
            shake: 0,
            gameOverAlpha: 0
        };
        ballRef.current = {
            x: WIDTH / 2,
            y: HEIGHT * 0.5,
            vx: Math.max(1.5, initialSpeed * 0.6),
            vy: -initialSpeed,
            radius: EMOJI_RADIUS,
            emoji: stripContext(emoji),
            rotation: 0
        };
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctxRef.current = ctx;

        const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
        canvas.width = WIDTH * dpr;
        canvas.height = HEIGHT * dpr;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        function update(dt: number) {
            const ball = ballRef.current;
            const base = baseRef.current;

            base.x = mouseXRef.current - base.width / 2;
            base.x = clamp(base.x, 10, WIDTH - base.width - 10);

            if (stateRef.current === "playing") {
                ball.x += ball.vx * dt;
                ball.y += ball.vy * dt;
                clampSpeed(ball);
            }

            if (stateRef.current === "playing") {
                if (ball.x - ball.radius <= 0) {
                    ball.x = ball.radius;
                    ball.vx = -ball.vx;
                    if (rotateOnWallNextRef.current) {
                        ball.rotation += randDeg(-35, 35);
                    }
                    rotateOnWallNextRef.current = !rotateOnWallNextRef.current;
                }

                if (ball.x + ball.radius >= WIDTH) {
                    ball.x = WIDTH - ball.radius;
                    ball.vx = -ball.vx;
                    if (rotateOnWallNextRef.current) {
                        ball.rotation += randDeg(-35, 35);
                    }
                    rotateOnWallNextRef.current = !rotateOnWallNextRef.current;
                }

                if (ball.y - ball.radius <= 0) {
                    ball.y = ball.radius;
                    ball.vy = -ball.vy;
                    if (rotateOnWallNextRef.current) {
                        ball.rotation += randDeg(-35, 35);
                    }
                    rotateOnWallNextRef.current = !rotateOnWallNextRef.current;
                }
            }

            const closestX = clamp(ball.x, base.x, base.x + base.width);
            const closestY = clamp(ball.y, base.y, base.y + base.height);
            const dx = ball.x - closestX;
            const dy = ball.y - closestY;
            const distance = Math.hypot(dx, dy);

            if (stateRef.current === "playing" && distance < ball.radius && ball.vy > 0) {
                const hitOffset = clamp((ball.x - (base.x + base.width / 2)) / (base.width / 2), -1, 1);
                const maxAngle = PHYSICS.maxBounceAngleDeg * (Math.PI / 180);
                const nextScore = scoreRef.current + 1;
                const stage = getStage(nextScore);
                const angleMagnitude = clamp(Math.abs(hitOffset) * maxAngle, 0, maxAngle);
                const hitDirection = Math.sign(hitOffset);
                const angle = hitDirection * angleMagnitude;
                const stageMultiplier = STAGE_SPEED_MULTIPLIERS[stage];
                baseSpeedRef.current *= PHYSICS.perHitSpeedMultiplier;
                baseSpeedRef.current = Math.min(baseSpeedRef.current, PHYSICS.maxSpeed / stageMultiplier);
                const speed = Math.min(baseSpeedRef.current * stageMultiplier, PHYSICS.maxSpeed);

                ball.vx = speed * Math.sin(angle);
                ball.vy = -Math.abs(speed * Math.cos(angle));
                const maxHorizontal = speed * PHYSICS.maxHorizontalRatio;
                if (Math.abs(ball.vx) > maxHorizontal) {
                    ball.vx = Math.sign(ball.vx) * maxHorizontal;
                }
                const minVertical = speed * PHYSICS.minVerticalRatio;
                if (Math.abs(ball.vy) < minVertical) {
                    ball.vy = -minVertical;
                }
                ball.y = base.y - ball.radius - 1;
                setScoreValue(nextScore);

                const emojiText = getEmojiText(ball.emoji);
                if (emojiText === "🐛" && nextScore >= 10) {
                    ball.emoji = { type: "text", value: "🦋" };
                }
                if (emojiText === "👽" && Math.random() < 0.15) {
                    ball.x = randBetween(ball.radius, WIDTH - ball.radius);
                    ball.y = randBetween(ball.radius, HEIGHT * 0.6);
                }
            }

            if (stateRef.current === "playing" && ball.y > HEIGHT + ball.radius) {
                setGameState("dying");
                if (scoreRef.current > highScoreRef.current) {
                    setHighScoreValue(scoreRef.current);
                    DataStore.set("emojiPongHighScore", scoreRef.current);
                }
                deathRef.current = {
                    active: true,
                    startedAt: performance.now(),
                    angle: Math.PI / 6,
                    alpha: 1,
                    shake: 6,
                    gameOverAlpha: 1
                };
                ball.vx = 0;
                ball.vy = 0;
            }

            if (stateRef.current === "dying" && deathRef.current.active) {
                const elapsed = performance.now() - deathRef.current.startedAt;
                const t = clamp(elapsed / PHYSICS.deathDurationMs, 0, 1);
                const floorY = Math.min(ball.y + PHYSICS.deathFallSpeed * dt, HEIGHT - ball.radius);
                ball.y = floorY;
                if (t > PHYSICS.deathFadeStart) {
                    const fadeT = (t - PHYSICS.deathFadeStart) / (1 - PHYSICS.deathFadeStart);
                    deathRef.current.alpha = 1 - fadeT;
                    deathRef.current.gameOverAlpha = 1 - fadeT;
                }
                if (deathRef.current.shake > 0) {
                    deathRef.current.shake -= 0.5;
                }
                if (t >= 1) {
                    deathRef.current.active = false;
                    setGameState("gameover");
                    const drops: EmojiDrop[] = [];
                    const dropCount = clamp(Math.floor(randBetween(40, 120)), 40, 120);
                    const floor = HEIGHT * 0.86;
                    for (let i = 0; i < dropCount; i++) {
                        drops.push({
                            x: randBetween(20, WIDTH - 20),
                            y: randBetween(-HEIGHT * 0.5, HEIGHT * 0.2),
                            vx: randBetween(-0.6, 0.6),
                            vy: randBetween(1, 2.5),
                            size: randBetween(18, 36),
                            angle: randBetween(0, Math.PI * 2),
                            angularVelocity: randBetween(-0.08, 0.08),
                            settled: false,
                            targetY: randBetween(HEIGHT * 0.62, floor)
                        });
                    }
                    rainRef.current = drops;
                }
            }

            if (stateRef.current === "gameover") {
                for (const drop of rainRef.current) {
                    if (drop.settled) continue;
                    drop.vy += 0.15 * dt;
                    drop.x += drop.vx * dt;
                    drop.y += drop.vy * dt;
                    drop.angle += drop.angularVelocity * dt;
                    if (drop.x < 10 || drop.x > WIDTH - 10) {
                        drop.vx = -drop.vx;
                    }
                    if (drop.y >= drop.targetY) {
                        drop.y = drop.targetY;
                        drop.vy = 0;
                        drop.vx = 0;
                        drop.angularVelocity = 0;
                        drop.settled = true;
                    }
                }
                for (let i = 0; i < rainRef.current.length; i++) {
                    for (let j = i + 1; j < rainRef.current.length; j++) {
                        const a = rainRef.current[i];
                        const b = rainRef.current[j];
                        const dx = b.x - a.x;
                        const dy = b.y - a.y;
                        const dist = Math.hypot(dx, dy);
                        const minDist = (a.size + b.size) * 0.32;
                        if (dist > 0 && dist < minDist) {
                            const nx = dx / dist;
                            const ny = dy / dist;
                            const overlap = minDist - dist;
                            a.x -= nx * overlap * 0.5;
                            a.y -= ny * overlap * 0.5;
                            b.x += nx * overlap * 0.5;
                            b.y += ny * overlap * 0.5;
                            const swapVx = a.vx;
                            const swapVy = a.vy;
                            a.vx = b.vx * 0.9;
                            a.vy = b.vy * 0.9;
                            b.vx = swapVx * 0.9;
                            b.vy = swapVy * 0.9;
                        }
                    }
                }
            }
        }

        function render() {
            const ctx = ctxRef.current;
            if (!ctx) return;

            const stage = getStage(scoreRef.current);
            ctx.fillStyle = STAGE_COLORS[stage];
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            if (stateRef.current === "playing") {
                ctx.font = "78px -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = "#4a4a4a";
                ctx.fillText(String(scoreRef.current), WIDTH / 2, HEIGHT / 2 - 30);
                ctx.globalAlpha = 1;
            }

            if (stateRef.current === "playing" || stateRef.current === "dying") {
                const ball = ballRef.current;
                const image = getEmojiImage(ball.emoji, emojiImageCacheRef.current);
                if (stateRef.current === "dying" && deathRef.current.active) {
                    const shake = deathRef.current.shake > 0 ? randBetween(-deathRef.current.shake, deathRef.current.shake) : 0;
                    ctx.save();
                    ctx.translate(ball.x + shake, ball.y);
                    ctx.rotate(deathRef.current.angle);
                    ctx.globalAlpha = deathRef.current.alpha;
                    if (image && image.complete) {
                        const size = ball.radius * 2.0;
                        ctx.drawImage(image, -size / 2, -size / 2, size, size);
                    } else {
                        const size = Math.round(ball.radius * 1.6);
                        ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(getEmojiText(ball.emoji), 0, 0);
                    }
                    ctx.restore();
                    ctx.globalAlpha = 1;
                } else if (stateRef.current === "playing") {
                    ctx.save();
                    ctx.translate(ball.x, ball.y);
                    ctx.rotate(ball.rotation);
                    if (image && image.complete) {
                        const size = ball.radius * 2.0;
                        ctx.drawImage(image, -size / 2, -size / 2, size, size);
                    } else {
                        const size = Math.round(ball.radius * 1.6);
                        ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(getEmojiText(ball.emoji), 0, 0);
                    }
                    ctx.restore();
                }
            }

            if (stateRef.current === "playing") {
                const base = baseRef.current;
                ctx.fillStyle = "#000000";
                drawRoundedRect(ctx, base.x, base.y, base.width, base.height, base.height / 2);
                ctx.fill();
            }

            if (stateRef.current === "dying" && deathRef.current.active) {
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#3a3a3a";
                ctx.globalAlpha = deathRef.current.gameOverAlpha;
                ctx.font = "54px -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                ctx.fillText("Game Over!", WIDTH / 2, HEIGHT / 2 - 90);
                ctx.globalAlpha = 1;
            }

            if (stateRef.current === "gameover") {
                const isPurpleStage = stage === STAGE_COLORS.length - 1;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = isPurpleStage ? "#262626" : "#3a3a3a";
                ctx.globalAlpha = 0.9;
                ctx.font = "56px -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                ctx.fillText(`${scoreRef.current} Hits`, WIDTH / 2, HEIGHT / 2 - 40);
                if (scoreRef.current >= highScoreRef.current && scoreRef.current > 0) {
                    ctx.globalAlpha = 0.7;
                    ctx.fillStyle = "#B0B0B0";
                    ctx.font = "20px -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                    ctx.fillText("New high score!", WIDTH / 2, HEIGHT / 2 + 5);
                }
                ctx.globalAlpha = 1;
            }

            if (stateRef.current === "gameover") {
                const emoji = selectedEmojiRef.current ?? { type: "text", value: "🏀" };
                const image = getEmojiImage(emoji, emojiImageCacheRef.current);
                for (const drop of rainRef.current) {
                    ctx.save();
                    ctx.translate(drop.x, drop.y);
                    ctx.rotate(drop.angle);
                    if (image && image.complete) {
                        ctx.drawImage(image, -drop.size / 2, -drop.size / 2, drop.size, drop.size);
                    } else {
                        ctx.font = `${drop.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(getEmojiText(emoji), 0, 0);
                    }
                    ctx.restore();
                }
            }
        }

        function loop(timestamp: number) {
            if (!ctxRef.current) return;
            if (lastFrameRef.current == null) lastFrameRef.current = timestamp;
            const dtMs = timestamp - lastFrameRef.current;
            lastFrameRef.current = timestamp;
            const dt = clamp(dtMs / 16.67, 0.5, 2);
            update(dt);
            render();
            requestAnimationFrame(loop);
        }

        requestAnimationFrame(loop);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const swallowKeyEvent = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        };
        window.addEventListener("keydown", swallowKeyEvent, true);
        window.addEventListener("keypress", swallowKeyEvent, true);
        window.addEventListener("keyup", swallowKeyEvent, true);
        return () => {
            window.removeEventListener("keydown", swallowKeyEvent, true);
            window.removeEventListener("keypress", swallowKeyEvent, true);
            window.removeEventListener("keyup", swallowKeyEvent, true);
        };
    }, []);

    const handleCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const width = event.currentTarget.clientWidth;
        if (width <= 0) return;
        mouseXRef.current = (event.nativeEvent.offsetX / width) * WIDTH;
    };

    const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const width = event.currentTarget.clientWidth;
        if (width <= 0) return;
        mouseXRef.current = (event.nativeEvent.offsetX / width) * WIDTH;
    };

    const handlePlayAgain = () => {
        resetGame(selectedEmojiRef.current ?? { type: "text", value: "🏀" });
        setGameState("playing");
    };

    const handleShareScore = async () => {
        const context = contextRef.current;
        const channelId = context?.channelId ?? SelectedChannelStore.getChannelId();
        const channel = channelId ? ChannelStore.getChannel(channelId) : null;
        const contextId = context?.contextId ?? channel?.guild_id ?? channel?.id ?? null;
        if (!channelId || !channel || !contextId) {
            showToast("Unable to determine the channel for sharing.", Toasts.Type.FAILURE);
            return;
        }
        if (!isValidSnowflake(channelId) || !isValidSnowflake(contextId)) {
            showToast("Could not validate channel id.", Toasts.Type.FAILURE);
            return;
        }
        if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) {
            showToast("You do not have permission to send messages here.", Toasts.Type.FAILURE);
            return;
        }
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;
        if (!isValidSnowflake(currentUser.id)) return;
        const scoreToShare = normalizeScore(scoreRef.current);
        if (scoreToShare == null) {
            showToast("Could not validate score value.", Toasts.Type.FAILURE);
            return;
        }
        const baseEmoji: EmojiPayload = selectedEmojiRef.current
            ? stripContext(selectedEmojiRef.current)
            : { type: "text", value: "🏀" };
        const encrypted = await encryptPayload({
            userId: currentUser.id,
            channelId,
            contextId,
            score: scoreToShare,
            highScore: normalizeScore(highScoreRef.current) ?? scoreToShare,
            timestamp: Date.now(),
            emoji: baseEmoji,
            duel: duelRef.current && isValidSnowflake(duelRef.current.opponentId)
                ? {
                    opponentId: duelRef.current.opponentId,
                    opponentScore: normalizeScore(duelRef.current.opponentScore) ?? 0
                }
                : undefined
        });
        if (!encrypted) {
            showToast("Failed to encrypt score.", Toasts.Type.FAILURE);
            return;
        }
        await sendMessage(channelId, { content: buildShareMessage(encrypted) });
        showToast("Equipong score shared.", Toasts.Type.SUCCESS);
    };

    const renderDuelTop = () => {
        const duel = duelRef.current;
        const currentUser = UserStore.getCurrentUser();
        if (!duel || !currentUser) return null;
        const opponent = UserStore.getUser(duel.opponentId);
        const isSelfDuel = duel.opponentId === currentUser.id;
        const viewerScore = duel.viewerScore;
        const opponentScore = duel.opponentScore;
        const viewerAvatar = IconUtils.getUserAvatarURL(currentUser, true) ?? IconUtils.getDefaultAvatarURL(currentUser.id);
        const opponentAvatar = opponent
            ? (IconUtils.getUserAvatarURL(opponent, true) ?? IconUtils.getDefaultAvatarURL(opponent.id))
            : IconUtils.getDefaultAvatarURL(duel.opponentId);
        if (isSelfDuel) {
            const selfScore = Math.max(viewerScore, opponentScore);
            return (
                <div className={cl("duel-top", "duel-top-single")}>
                    <div className={cl("duel-top-side")}>
                        <div className={cl("duel-top-score")}>{String(selfScore).padStart(3, "0")}</div>
                        <div className={cl("duel-top-avatar")}>
                            <span className={cl("duel-top-crown")}>👑</span>
                            <img className={cl("duel-avatar")} src={viewerAvatar} alt="" />
                        </div>
                    </div>
                </div>
            );
        }
        const viewerOnLeft = viewerScore >= opponentScore;
        const leftScore = viewerOnLeft ? viewerScore : opponentScore;
        const rightScore = viewerOnLeft ? opponentScore : viewerScore;
        const leftAvatar = viewerOnLeft ? viewerAvatar : opponentAvatar;
        const rightAvatar = viewerOnLeft ? opponentAvatar : viewerAvatar;
        const showLeftCrown = leftScore > rightScore;
        const showRightCrown = rightScore > leftScore;
        return (
            <div className={cl("duel-top")}>
                <div className={cl("duel-top-side")}>
                    <div className={cl("duel-top-score")}>{String(leftScore).padStart(3, "0")}</div>
                    <div className={cl("duel-top-avatar")}>
                        {showLeftCrown ? <span className={cl("duel-top-crown")}>👑</span> : null}
                        <img className={cl("duel-avatar")} src={leftAvatar} alt="" />
                    </div>
                </div>
                <div className={cl("duel-top-side")}>
                    <div className={cl("duel-top-avatar")}>
                        {showRightCrown ? <span className={cl("duel-top-crown")}>👑</span> : null}
                        <img className={cl("duel-avatar")} src={rightAvatar} alt="" />
                    </div>
                    <div className={cl("duel-top-score")}>{String(rightScore).padStart(3, "0")}</div>
                </div>
            </div>
        );
    };

    const handleGoBack = () => {
        onClose();
    };

    const renderGameOver = () => (
        <div className={cl("gameover")}
            role="status"
            aria-live="polite"
        >
            <div className={cl("gameover-panel")}>
                <button type="button" className={cl("gameover-share")} onClick={handleShareScore}>
                    Share Score
                </button>
                <button type="button" className={cl("gameover-play")} onClick={handlePlayAgain}>
                    <span className={cl("gameover-icon")} aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                            <path
                                d="M12 5a7 7 0 1 1-6.32 4H3.5a.5.5 0 0 1-.38-.82L6 5.5a.5.5 0 0 1 .76 0l2.88 3.18a.5.5 0 0 1-.38.82H7.07A5 5 0 1 0 12 7a.9.9 0 1 1 0-2z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                    Play Again
                </button>
                <button type="button" className={cl("gameover-back")} onClick={handleGoBack}>
                    Go back
                </button>
            </div>
        </div>
    );

    return (
        <div
            className={cl("phone", { "phone-purple": getStage(score) === STAGE_COLORS.length - 1 })}
            role="application"
            aria-label="Equipong"
        >
            <button className={cl("close")} onClick={onClose} aria-label="Close game" />
            <div className={cl("high-score")} aria-label={`High score ${highScoreLabel}`}>
                {highScoreLabel}
            </div>
            {renderDuelTop()}
            <canvas
                className={cl("canvas")}
                ref={canvasRef}
                onPointerMove={handleCanvasPointerMove}
                onMouseMove={handleCanvasMouseMove}
            />
            {state === "gameover" ? renderGameOver() : null}
        </div>
    );
}
