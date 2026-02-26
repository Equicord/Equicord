/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph, UserStore, UserSummaryItem, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const USER_SUMMARY_PROPS: PropDef[] = [
    { name: "users", type: "(User | null)[]", required: true, description: "Array of User objects to display as avatars. Null entries render as empty slots." },
    { name: "max", type: "number", default: "10", description: "Maximum number of avatars to show before the overflow indicator." },
    { name: "count", type: "number", description: 'Override the count used in the "+N" overflow display.' },
    { name: "size", type: "16 | 24 | 32 | 56", default: "24", description: "Avatar size in pixels." },
    { name: "guildId", type: "string", description: "Guild context for server-specific avatars." },
    { name: "showUserPopout", type: "boolean", default: "false", description: "Show user popout when an avatar is clicked." },
    { name: "showDefaultAvatarsForNullUsers", type: "boolean", description: "Render default avatars for null entries in the users array." },
    { name: "renderUser", type: "(user, isLast, index) => ReactNode", description: "Custom render function for each user avatar." },
    { name: "renderMoreUsers", type: "(text, count) => ReactNode", description: 'Custom render function for the "+N" overflow indicator.' },
    { name: "renderIcon", type: "boolean", description: "Whether to render an icon." },
    { name: "renderLeadingIcon", type: "(className) => ReactNode", description: "Render a leading icon before the user avatars." },
    { name: "dimEmptyUsers", type: "boolean", description: "Dim null user slots." },
    { name: "hideMoreUsers", type: "boolean", default: "false", description: 'Hide the "+N" overflow count.' },
    { name: "useFallbackUserForPopout", type: "boolean", description: "Use fallback user data for popout when user data is unavailable." },
    { name: "extraDetail", type: "ReactNode", description: "Additional content rendered after the avatars." },
    { name: "className", type: "string", description: "CSS class for the container." },
];

function MaxUsersDemo() {
    const currentUser = UserStore.getCurrentUser();
    const users = currentUser ? Array(5).fill(currentUser) : [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[2, 3, 5].map(max => (
                <div key={max} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Paragraph color="text-muted" style={{ width: 80 }}>max={max}:</Paragraph>
                    <UserSummaryItem users={users} max={max} />
                </div>
            ))}
        </div>
    );
}

function SizesDemo() {
    const currentUser = UserStore.getCurrentUser();
    const users = currentUser ? Array(5).fill(currentUser) : [];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {([16, 24, 32, 56] as const).map(size => (
                <div key={size} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Paragraph color="text-muted" style={{ width: 50 }}>{size}:</Paragraph>
                    <UserSummaryItem users={users} max={4} size={size} />
                </div>
            ))}
        </div>
    );
}

function OverrideCountDemo() {
    const currentUser = UserStore.getCurrentUser();
    const users = currentUser ? Array(3).fill(currentUser) : [];
    const [count, setCount] = useState(42);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Paragraph color="text-muted" style={{ width: 120 }}>Default count:</Paragraph>
                <UserSummaryItem users={users} max={2} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Paragraph color="text-muted" style={{ width: 120 }}>count={count}:</Paragraph>
                <UserSummaryItem users={users} max={2} count={count} />
            </div>
        </div>
    );
}

export default function UserSummaryItemTab() {
    const currentUser = UserStore.getCurrentUser();
    const users = currentUser ? Array(5).fill(currentUser) : [];

    return (
        <DocPage
            componentName="UserSummaryItem"
            overview="UserSummaryItem displays a row of user avatars with an overflow indicator. Supports four sizes, configurable max visible count, user popout on click, and custom render functions for both avatars and the overflow indicator."
            importPath={'import { UserSummaryItem, UserStore } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "A simple row of user avatars with overflow.",
                    children: (
                        <UserSummaryItem users={users} max={3} />
                    ),
                    code: `const users = [user1, user2, user3, user4, user5];
<UserSummaryItem users={users} max={3} />`,
                    relevantProps: ["users", "max"],
                },
                {
                    title: "Sizes",
                    description: "Four avatar sizes: 16, 24, 32, and 56 pixels.",
                    children: <SizesDemo />,
                    code: "<UserSummaryItem users={users} max={4} size={32} />",
                    relevantProps: ["size"],
                },
                {
                    title: "Max Users",
                    description: "Control how many avatars are visible before the overflow count.",
                    children: <MaxUsersDemo />,
                    relevantProps: ["max"],
                },
                {
                    title: "Override Count",
                    description: 'The count prop overrides the number shown in the "+N" indicator, useful when the total is different from users.length.',
                    children: <OverrideCountDemo />,
                    relevantProps: ["count"],
                },
                {
                    title: "User Popout",
                    description: "Enable user popout on avatar click with showUserPopout.",
                    children: (
                        <UserSummaryItem users={users} max={3} showUserPopout />
                    ),
                    code: "<UserSummaryItem users={users} max={3} showUserPopout />",
                    relevantProps: ["showUserPopout"],
                },
                {
                    title: "Hide Overflow",
                    description: 'Hide the "+N" overflow indicator entirely.',
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <Paragraph color="text-muted" style={{ width: 150 }}>hideMoreUsers=false:</Paragraph>
                                <UserSummaryItem users={users} max={3} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <Paragraph color="text-muted" style={{ width: 150 }}>hideMoreUsers=true:</Paragraph>
                                <UserSummaryItem users={users} max={3} hideMoreUsers />
                            </div>
                        </div>
                    ),
                    relevantProps: ["hideMoreUsers"],
                },
            ]}
            props={USER_SUMMARY_PROPS}
        />
    );
}
