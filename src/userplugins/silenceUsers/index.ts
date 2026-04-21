import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const FluxDispatcher = findByPropsLazy("dispatch", "subscribe", "addInterceptor");

const settings = definePluginSettings({
    mutedUserIds: {
        type: OptionType.STRING,
        description: "Comma-separated Discord user IDs to silence pings and server badges.",
        default: "",
        restartNeeded: false,
    },
});

function getMutedIds(): Set<string> {
    return new Set(
        settings.store.mutedUserIds
            .split(",")
            .map((id: string) => id.trim())
            .filter((id: string) => id.length > 0)
    );
}

function interceptor(event: any) {
    try {
        const mutedIds = getMutedIds();
        if (mutedIds.size === 0) return;

        if (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE") {
            const msg = event.message;
            if (!msg) return;

            const authorId = String(msg.author?.id ?? "");
            if (!authorId || !mutedIds.has(authorId)) return;

            msg.mention_everyone = false;
            msg.mention_roles = [];
            msg.mentions = [];
        }

        if (event.type === "NOTIFICATION_CREATE") {
            const msg = event.message ?? event.notification?.message;
            if (!msg) return;

            const authorId = String(msg.author?.id ?? "");
            if (!authorId || !mutedIds.has(authorId)) return;

            return false;
        }

    } catch {
    }
}

export default definePlugin({
    name: "SilenceUsers",
    description: "Silences @mention pings and server badge counts from specific users. Regular messages and DMs are untouched.",
    authors: [
        {
            id: 119386840624005121n,
            name: "DKA",
        },
    ],

    settings,
    patches: [],

    start() {
        FluxDispatcher.addInterceptor(interceptor);
        console.info("[SilenceUsers] Started. Muted IDs:", settings.store.mutedUserIds || "(none)");
    },

    stop() {
        const list: Function[] =
            FluxDispatcher._interceptors ??
            FluxDispatcher.interceptors ??
            [];
        const idx = list.indexOf(interceptor);
        if (idx !== -1) list.splice(idx, 1);
        console.info("[SilenceUsers] Stopped.");
    },
});
