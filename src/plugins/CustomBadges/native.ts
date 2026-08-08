const DEFAULT_API_BASE = "https://custom-badges.shadow-164.workers.dev";

export async function fetchBadge(_event: any, userId: string) {
    const res = await fetch(`${DEFAULT_API_BASE}?userId=${encodeURIComponent(userId)}`);
    if (!res.ok)
        return null;
    return res.json();
}

export async function setBadge(_event: any, userId: string, badgeId: string, imageUrl: string, description: string, style: Record<string, unknown> | undefined, sessionToken: string) {
    if (!sessionToken)
        throw new Error("Not verified - use \"Verify Discord Account\" in settings first");
    const res = await fetch(DEFAULT_API_BASE, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ action: "setBadge", userId, badgeId, imageUrl, description, style })
    });
    const data = await res.json();
    if (!res.ok)
        throw new Error(data.error || res.statusText);
    return data;
}

export async function setActiveBadge(_event: any, userId: string, badgeId: string, sessionToken: string) {
    if (!sessionToken)
        throw new Error("Not verified - use \"Verify Discord Account\" in settings first");
    const res = await fetch(DEFAULT_API_BASE, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ action: "setActiveBadge", userId, badgeId })
    });
    const data = await res.json();
    if (!res.ok)
        throw new Error(data.error || res.statusText);
    return data;
}

export async function deleteBadge(_event: any, userId: string, badgeId: string, sessionToken: string) {
    if (!sessionToken)
        throw new Error("Not verified - use \"Verify Discord Account\" in settings first");
    const res = await fetch(DEFAULT_API_BASE, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ action: "deleteBadge", userId, badgeId })
    });
    const data = await res.json();
    if (!res.ok)
        throw new Error(data.error || res.statusText);
    return data;
}

export async function revokeOwnToken(_event: any, sessionToken: string) {
    if (!sessionToken)
        throw new Error("Not verified - nothing to revoke");
    const res = await fetch(`${DEFAULT_API_BASE}/self/revoke`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok)
        throw new Error(data.error || res.statusText);
    return data;
}