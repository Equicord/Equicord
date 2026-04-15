import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import { proxyLazy } from "@utils/lazy";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { RestAPI, showToast, Toasts, Menu, zustandCreate, React, ChannelStore, UserStore, MessageActions, SelectedChannelStore } from "@webpack/common";

interface State {
    isDeleting: boolean;
    setDeleting: (deleting: boolean) => void;
}

const useStore = proxyLazy(() => (zustandCreate as any)((set: any) => ({
    isDeleting: false,
    setDeleting: (isDeleting: boolean) => set({ isDeleting })
}))) as { (fn: (state: State) => any): any; getState: () => State; };

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

async function requestWithRetry(url: string, query?: any): Promise<any> {
    while (useStore.getState().isDeleting) {
        const res = await RestAPI.get({ url, query } as any);
        if (res.ok) return res;
        if (res.status === 429) {
            const wait = (res.body?.retry_after || 5) * 1000;
            console.log(`[ClearMyMessages] Rate limited on fetch! Waiting ${wait}ms...`);
            showToast(`Rate limited on fetch! Waiting (${Math.ceil(wait / 1000)}s)...`, Toasts.Type.MESSAGE);
            await sleep(wait + 1000);
            continue;
        }
        return res;
    }
    return { ok: false };
}

async function clearMyMessages(channelId: string) {
    const { isDeleting, setDeleting } = useStore.getState();
    if (isDeleting) return;

    setDeleting(true);
    const user = UserStore.getCurrentUser();
    if (!user) {
        setDeleting(false);
        return;
    }
    const myId = user.id;
    const channel = (ChannelStore as any).getChannel(channelId);
    const guildId = channel?.guild_id;

    console.log(`[ClearMyMessages] Starting total wipe for channel ${channelId}`);
    showToast("Starting...", Toasts.Type.MESSAGE);

    let totalDeleted = 0;

    try {

        for (let pass = 1; pass <= 3; pass++) {
            if (!useStore.getState().isDeleting) break;
            let deletedInPass = 0;
            console.log(`[ClearMyMessages] PASS ${pass} starting...`);


            try {
                const searchUrl = guildId
                    ? `/guilds/${guildId}/messages/search`
                    : `/channels/${channelId}/messages/search`;

                const query = guildId
                    ? { channel_id: channelId, author_id: myId, include_threads: true }
                    : { author_id: myId };

                console.log(`[ClearMyMessages] Pass ${pass}, Stage 1 (Search): Requesting...`);
                const sres = await requestWithRetry(searchUrl, query);

                if (sres.ok && sres.body?.messages) {
                    const hits = sres.body.messages.flat().filter((m: any) => m && m.hit);
                    console.log(`[ClearMyMessages] Pass ${pass}, Stage 1: Found ${hits.length} hits via search.`);
                    for (const msg of hits) {
                        if (!useStore.getState().isDeleting) break;
                        try {
                            await MessageActions.deleteMessage(channelId, msg.id);
                            deletedInPass++;
                            await sleep(400);  // ajust the speed here!
                        } catch (err: any) {
                            if (err.status === 429) {
                                const retry = (err.body?.retry_after || 5) * 1000;
                                showToast(`Deletion Rate Limit! Waiting ${Math.ceil(retry / 1000)}s...`, Toasts.Type.MESSAGE);
                                await sleep(retry + 1000);
                            }
                        }
                    }
                } else if (!sres.ok) {
                    console.log(`[ClearMyMessages] Pass ${pass}, Stage 1: Search failed. Status: ${sres.status}`);
                }
            } catch (e) {
                console.error(`[ClearMyMessages] Pass ${pass}, Stage 1 error:`, e);
            }


            let before: string | undefined;
            console.log(`[ClearMyMessages] Pass ${pass}, Stage 2 (Linear): Starting scan...`);

            while (useStore.getState().isDeleting) {
                const url = `/channels/${channelId}/messages`;
                const query = { limit: 100, before };
                const res = await requestWithRetry(url, query);

                if (!res.ok || !res.body || res.body.length === 0) break;
                const messages = res.body;

                for (const msg of messages) {
                    if (!useStore.getState().isDeleting) break;
                    if (msg.author?.id === myId) {
                        try {
                            await MessageActions.deleteMessage(channelId, msg.id);
                            deletedInPass++;
                            await sleep(400);
                        } catch (err: any) {
                            if (err.status === 429) {
                                const retry = (err.body?.retry_after || 5) * 1000;
                                showToast(`Deletion Rate Limit! Waiting ${Math.ceil(retry / 1000)}s...`, Toasts.Type.MESSAGE);
                                await sleep(retry + 1000);
                            }
                        }
                    }
                }

                before = messages[messages.length - 1].id;
            }

            totalDeleted += deletedInPass;
            console.log(`[ClearMyMessages] PASS ${pass} finished. Deleted ${deletedInPass} messages total.`);

            if (deletedInPass === 0) {
                console.log(`[ClearMyMessages] Nothing more found in pass ${pass}, finishing.`);
                break;
            }
            if (pass < 3) {
                showToast(`Wait for index... Pass ${pass} done (${deletedInPass} deleted).`, Toasts.Type.MESSAGE);
                await sleep(2000);
            }
        }

        showToast(`Done! Deleted ${totalDeleted} messages total.`, Toasts.Type.SUCCESS);
    } catch (error) {
        console.error("[ClearMyMessages] Fatal error:", error);
        showToast("Error while deletion.", Toasts.Type.FAILURE);
    } finally {
        setDeleting(false);
    }
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children) => {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return;

    const isDeleting = useStore((state: State) => state.isDeleting);

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="vc-clear-my-messages"
            label={isDeleting ? "وقف المسح" : "مسح كل الرسايل"}
            color="danger"
            action={() => {
                console.log("[ClearMyMessages] MenuItem clicked. Currently deleting:", isDeleting);
                if (isDeleting) {
                    useStore.getState().setDeleting(false);
                } else {
                    clearMyMessages(channelId);
                }
            }}
        />
    );
};

export default definePlugin({
    name: "مسح كل الرسايل من زر",
    description:"مسح الرسايل  تضغط كلك يمين على الي تبي تحذف راسيلك عنده ويطلع لك مسح كل الرسايل",
    authors: [Devs.rz30],
    start() {
        useStore.getState();
    },
    contextMenus: {
        "user-context": UserContextMenuPatch
    }
});
