/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Animations, ManaButton, Paragraph, SpringConfigs, useSpring, useState, useTrail, useTransition } from "..";
import { DocPage, type PropDef } from "../DocPage";

const { animated } = Animations;

const TRAIL_ITEMS = ["Discord", "uses", "react-spring", "for", "animations"];

const SPRING_CONFIG_PROPS: PropDef[] = [
    { name: "default", type: "{ tension: 170, friction: 26 }", description: "Standard spring. Balanced speed and bounce." },
    { name: "gentle", type: "{ tension: 120, friction: 14 }", description: "Soft, slow spring with more bounce." },
    { name: "wobbly", type: "{ tension: 180, friction: 12 }", description: "Bouncy, playful spring with high overshoot." },
    { name: "stiff", type: "{ tension: 210, friction: 20 }", description: "Quick, snappy spring with minimal bounce." },
    { name: "slow", type: "{ tension: 280, friction: 60 }", description: "High tension with heavy damping. Slow and deliberate." },
    { name: "molasses", type: "{ tension: 280, friction: 120 }", description: "Extremely slow and heavily damped. No bounce." },
];

function SpringDemo() {
    const [toggled, setToggled] = useState(false);
    const [config, setConfig] = useState<keyof typeof SpringConfigs>("default");

    const spring = useSpring({
        opacity: toggled ? 1 : 0.3,
        transform: toggled ? "scale(1) rotate(0deg)" : "scale(0.8) rotate(-10deg)",
        backgroundColor: toggled ? "var(--brand-500)" : "var(--background-tertiary)",
        config: SpringConfigs[config]
    });

    return (
        <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {(Object.keys(SpringConfigs) as (keyof typeof SpringConfigs)[]).map(c => (
                    <ManaButton
                        key={c}
                        variant={config === c ? "primary" : "secondary"}
                        size="sm"
                        text={c}
                        onClick={() => setConfig(c)}
                    />
                ))}
            </div>
            <animated.div
                onClick={() => setToggled(!toggled)}
                style={{
                    ...spring,
                    width: 120,
                    height: 120,
                    borderRadius: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <Paragraph color="text-strong">Click me</Paragraph>
            </animated.div>
        </>
    );
}

function TransitionDemo() {
    const [items, setItems] = useState([1, 2, 3]);
    const [nextId, setNextId] = useState(4);

    const transitions = useTransition(items, {
        from: { opacity: 0, transform: "translateX(-20px) scale(0.9)" },
        enter: { opacity: 1, transform: "translateX(0px) scale(1)" },
        leave: { opacity: 0, transform: "translateX(20px) scale(0.9)" },
        keys: item => item,
        config: SpringConfigs.gentle
    });

    return (
        <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <ManaButton variant="primary" size="sm" text="Add Item" onClick={() => {
                    setItems([...items, nextId]);
                    setNextId(nextId + 1);
                }} />
                <ManaButton
                    variant="secondary"
                    size="sm"
                    text="Clear All"
                    onClick={() => setItems([])}
                    disabled={items.length === 0}
                />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 50 }}>
                {transitions((style, item) => (
                    <animated.div
                        style={{
                            ...style,
                            padding: "8px 16px",
                            background: "var(--background-secondary)",
                            borderRadius: 8,
                            cursor: "pointer"
                        }}
                        onClick={() => setItems(items.filter(i => i !== item))}
                    >
                        <Paragraph>Item {item}</Paragraph>
                    </animated.div>
                ))}
            </div>
        </>
    );
}

function TrailDemo() {
    const [show, setShow] = useState(true);

    const trail = useTrail(TRAIL_ITEMS.length, {
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0px)" : "translateY(20px)",
        config: SpringConfigs.gentle
    }) as object[];

    return (
        <>
            <div style={{ marginBottom: 16 }}>
                <ManaButton
                    variant="secondary"
                    size="sm"
                    text={show ? "Hide" : "Show"}
                    onClick={() => setShow(!show)}
                />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 40 }}>
                {trail.map((style, i) => (
                    <animated.div
                        key={i}
                        style={{
                            ...style,
                            padding: "8px 12px",
                            background: "var(--brand-500)",
                            borderRadius: 6
                        }}
                    >
                        <Paragraph color="text-strong">{TRAIL_ITEMS[i]}</Paragraph>
                    </animated.div>
                ))}
            </div>
        </>
    );
}

function AnimatedElementsDemo() {
    const [hover, setHover] = useState(false);

    const hoverSpring = useSpring({
        scale: hover ? 1.05 : 1,
        boxShadow: hover
            ? "0 8px 24px rgba(0,0,0,0.3)"
            : "0 2px 8px rgba(0,0,0,0.1)",
        config: SpringConfigs.wobbly
    });

    return (
        <animated.div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                ...hoverSpring,
                width: 100,
                height: 100,
                background: "var(--background-secondary)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
            }}
        >
            <Paragraph color="text-muted" style={{ fontSize: 12 }}>Hover me</Paragraph>
        </animated.div>
    );
}

export default function AnimationsTab() {
    return (
        <DocPage
            componentName="Animations"
            overview="Discord uses react-spring for physics-based animations. The Animations module exposes useSpring, useTransition, useTrail, useChain, useSprings hooks plus animated.* element wrappers and preset spring configs. All animations are interruptible and use spring physics rather than duration-based easing."
            notices={[
                { type: "info", children: "These are re-exports of react-spring. All animations are interruptible and respect the user's reduced motion preference when used with Discord's built-in motion settings." },
            ]}
            importPath={'import { Animations, useSpring, useTransition, useTrail, SpringConfigs } from "../components";'}
            sections={[
                {
                    title: "useSpring",
                    description: "Animate values with spring physics. Click the box to toggle, and switch between config presets to see different animation feels.",
                    children: <SpringDemo />,
                    code: "const spring = useSpring({ opacity: visible ? 1 : 0, config: SpringConfigs.gentle });\nreturn <animated.div style={spring}>Content</animated.div>;"
                },
                {
                    title: "useTransition",
                    description: "Animate items entering and leaving a list. Click items to remove them, or use the buttons to add/clear.",
                    children: <TransitionDemo />,
                    code: "const transitions = useTransition(items, {\n  from: { opacity: 0 },\n  enter: { opacity: 1 },\n  leave: { opacity: 0 },\n  keys: item => item.id,\n});\nreturn transitions((style, item) => <animated.div style={style}>{item.name}</animated.div>);"
                },
                {
                    title: "useTrail",
                    description: "Staggered animations for multiple items. Each item animates slightly after the previous one.",
                    children: <TrailDemo />,
                    code: 'const trail = useTrail(items.length, {\n  opacity: show ? 1 : 0,\n  transform: show ? "translateY(0)" : "translateY(20px)",\n  config: SpringConfigs.gentle,\n});'
                },
                {
                    title: "animated Elements",
                    description: "Use animated.div, animated.span, animated.svg etc. to create spring-animated HTML elements. Hover the box below.",
                    children: <AnimatedElementsDemo />
                },
            ]}
            props={SPRING_CONFIG_PROPS}
        />
    );
}
