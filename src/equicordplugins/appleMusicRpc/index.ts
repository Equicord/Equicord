import { definePluginSettings } from "@api/Settings";
import { EquicordDevs, IS_WINDOWS } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

const Native = VencordNative.pluginHelpers.AppleMusicRpc as PluginNative<typeof import("./native")>;

interface Activity {
    application_id: string;
    name: string;
    details?: string;
    state?: string;
    timestamps?: {
        start?: number;
        end?: number;
    };
    assets?: {
        large_image?: string;
        large_text?: string;
    };
    type: number;
    flags: number;
}

interface TrackData {
    name: string;
    artist?: string;
    album?: string;
    albumArtwork?: string;
    playerPosition?: number;
    duration?: number;
}

const enum ActivityType {
    Playing = 0,
    Listening = 2
}

const enum ActivityFlag {
    Instance = 1 << 0
}

const applicationId = "1239490006054207550";

const settings = definePluginSettings({
    refreshInterval: {
        type: OptionType.SLIDER,
        description: "Intervalo de refresco (segundos)",
        markers: [1, 2, 3, 5, 10, 15],
        default: 3,
        restartNeeded: true
    },
    activityType: {
        type: OptionType.SELECT,
        description: "Tipo de actividad",
        options: [
            { label: "Playing", value: ActivityType.Playing },
            { label: "Listening", value: ActivityType.Listening, default: true }
        ]
    },
    enableTimestamps: {
        type: OptionType.BOOLEAN,
        description: "Mostrar timestamps",
        default: true
    },
    detailsString: {
        type: OptionType.STRING,
        description: "Formato de linea principal",
        default: "{name}"
    },
    stateString: {
        type: OptionType.STRING,
        description: "Formato de linea secundaria",
        default: "{artist} - {album}"
    }
});

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "AppleMusicRpc"
    });
}

function format(template: string, track: TrackData): string {
    return template
        .replaceAll("{name}", track.name ?? "")
        .replaceAll("{artist}", track.artist ?? "")
        .replaceAll("{album}", track.album ?? "")
        .replace(/\s+-\s+$/, "")
        .trim();
}

async function makeActivity(track: TrackData): Promise<Activity> {
    const details = format(settings.store.detailsString, track) || track.name;
    const state = format(settings.store.stateString, track) || undefined;

    const hasTiming =
        settings.store.enableTimestamps &&
        typeof track.playerPosition === "number" &&
        typeof track.duration === "number" &&
        Number.isFinite(track.playerPosition) &&
        Number.isFinite(track.duration) &&
        track.duration > 0;

    const largeImage = track.albumArtwork
        ? (await ApplicationAssetUtils.fetchAssetIds(applicationId, [track.albumArtwork]))[0]
        : undefined;

    return {
        application_id: applicationId,
        name: "Apple Music",
        details,
        state,
        timestamps: hasTiming
            ? {
                start: Date.now() - track.playerPosition * 1000,
                end: Date.now() - track.playerPosition * 1000 + track.duration * 1000
            }
            : undefined,
        assets: largeImage
            ? {
                large_image: largeImage,
                large_text: track.album ?? track.name
            }
            : undefined,
        type: settings.store.activityType,
        flags: ActivityFlag.Instance
    };
}

export default definePlugin({
    name: "AppleMusicRpc",
    description: "Apple Music rich presence for Windows.",
    authors: [EquicordDevs.rolololodev007],
    hidden: !IS_WINDOWS,
    settings,

    start() {
        this.updatePresence();
        this.interval = setInterval(() => this.updatePresence(), settings.store.refreshInterval * 1000);
    },

    stop() {
        clearInterval(this.interval);
        setActivity(null);
    },

    async updatePresence() {
        try {
            const track = await Native.fetchTrackData();
            setActivity(track ? await makeActivity(track) : null);
        } catch {
            setActivity(null);
        }
    }
});


