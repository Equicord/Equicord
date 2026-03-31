// src/userplugins/VoiceActivityNotes/index.tsx
import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { sendBotMessage } from "@api/Commands";
import { ChannelStore, UserStore } from "@webpack/common";
import { Devs } from "@utils/constants";

const settings = definePluginSettings({
    logChannelId: {
        type: OptionType.STRING,
        description: "ID القناة اللي تبي ترسل فيها لوق الحركات (اختياري)",
        default: "",
        placeholder: "1234567890",
    },
    guildFilterIds: {
        type: OptionType.STRING,
        description: "Guild IDs اللي تبي تتبعها فقط (فاضي = كل السيرفرات)",
        default: "",
        placeholder: "111,222,333",
    },
    ignoreSelf: {
        type: OptionType.BOOLEAN,
        description: "تجاهل تحركاتك أنت من اللوق",
        default: true,
    },
    maxLogEntries: {
        type: OptionType.NUMBER,
        description: "عدد الأحداث المحفوظة في الذاكرة",
        default: 50,
    },
    batchIntervalMs: {
        type: OptionType.NUMBER,
        description: "تجميع الأحداث وإرسالها كل X ms لقناة اللوق",
        default: 5000,
    },
});

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
}

const logs: string[] = [];
const pendingBatch: string[] = [];
let batchTimer: number | null = null;

function pushLog(line: string) {
    const ts = new Date().toLocaleTimeString();
    const full = `[${ts}] ${line}`;
    logs.unshift(full);
    if (logs.length > settings.store.maxLogEntries) logs.pop();

    // نحطها في الباتش أيضاً
    pendingBatch.push(full);
}

function getChannelName(id: string | undefined): string {
    if (!id) return "None";
    const ch = ChannelStore.getChannel(id);
    return ch?.name ?? id;
}

function getGuildIdFromChannel(id: string | undefined): string | null {
    if (!id) return null;
    const ch = ChannelStore.getChannel(id);
    return ch?.guild_id ?? null;
}

function passGuildFilter(channelId: string | undefined): boolean {
    const filterStr = settings.store.guildFilterIds.trim();
    if (!filterStr) return true; // ما فيه فلتر → كل شيء مسموح
    const guildId = getGuildIdFromChannel(channelId);
    if (!guildId) return false;

    const ids = filterStr
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    return ids.includes(guildId);
}

function displayName(user: any): string {
    // لو عندك globalName في بيئة Vencord تقدر تستخدمها
    return user.globalName ?? user.username ?? String(user.id);
}

function scheduleBatchSend() {
    const logChannelId = settings.store.logChannelId;
    if (!logChannelId) return;
    if (pendingBatch.length === 0) return;

    if (batchTimer != null) return; // مؤقت شغال بالفعل

    const delay = settings.store.batchIntervalMs || 5000;

    batchTimer = window.setTimeout(() => {
        batchTimer = null;
        if (!pendingBatch.length) return;

        const content =
            "📜 **حركات VC الأخيرة:**\n" +
            pendingBatch.map(l => `• ${l}`).join("\n");

        pendingBatch.length = 0;

        sendBotMessage(logChannelId, { content });
    }, delay);
}

export default definePlugin({
    name: "VoiceActivityNotes",
    description: "يسجل متى الناس تدخل/تطلع من الـ VC ويعرضها بأمر + لوق في قناة معينة",
    authors:[Devs.rz30,],
    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[] }) {
            const currentUserId = UserStore.getCurrentUser().id;

            for (const vs of voiceStates) {
                const user = UserStore.getUser(vs.userId);
                if (!user) continue;

                if (settings.store.ignoreSelf && vs.userId === currentUserId) continue;

                const from = vs.oldChannelId;
                const to = vs.channelId;

                // فلتر السيرفرات
                if (!passGuildFilter(from ?? to)) continue;

                if (from === to) continue;

                if (!from && to) {
                    pushLog(`🔊 ${displayName(user)} انضم إلى ${getChannelName(to)}`);
                } else if (from && !to) {
                    pushLog(`📭 ${displayName(user)} خرج من ${getChannelName(from)}`);
                } else if (from && to) {
                    pushLog(
                        `🔁 ${displayName(user)} انتقل من ${getChannelName(from)} إلى ${getChannelName(to)}`
                    );
                }
            }

            // بعد ما نضيف الأحداث، نحاول نرسل باتش إن لزم
            scheduleBatchSend();
        },
    },

    commands: [
        {
            name: "vc-log",
            description: "📜 عرض آخر 20 حركة في الـ VC",
            inputType: 1,
            execute: (_, ctx) => {
                const channelId = ctx.channel.id;
                const lines = logs.slice(0, 20);
                if (!lines.length) {
                    sendBotMessage(channelId, {
                        content: "ما فيه حركات مسجلة إلى الآن.",
                    });
                    return;
                }

                sendBotMessage(channelId, {
                    content:
                        "📜 **آخر حركات VC:**\n" +
                        lines.map(l => `• ${l}`).join("\n"),
                });
            },
        },
    ],

    stop() {
        // تنظيف مؤقت الباتش إذا كان شغال
        if (batchTimer != null) {
            clearTimeout(batchTimer);
            batchTimer = null;
        }
        logs.length = 0;
        pendingBatch.length = 0;
    },
});
