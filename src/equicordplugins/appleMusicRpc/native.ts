import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface TrackData {
    name: string;
    artist?: string;
    album?: string;
    albumArtwork?: string;
    playerPosition?: number;
    duration?: number;
}

const exec = promisify(execFile);

const APP_ID_PATTERNS = [
    /AppleInc\.AppleMusic/i,
    /AppleMusic/i,
    /iTunes/i
];

interface RawSession {
    appId?: string;
    title?: string;
    artist?: string;
    album?: string;
    positionSeconds?: number;
    durationSeconds?: number;
    playbackStatus?: string;
}

async function readSessions(): Promise<RawSession[]> {
    const script = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq "AsTask" -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1
} | Select-Object -First 1

if (-not $asTaskGeneric) {
  [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("[]")) | Write-Output
  exit
}

$mgrOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
$mgrTask = $asTaskGeneric.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($mgrOp))
$mgr = $mgrTask.Result

if (-not $mgr) {
  [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("[]")) | Write-Output
  exit
}

$sessions = foreach ($s in $mgr.GetSessions()) {
  try {
    $mediaOp = $s.TryGetMediaPropertiesAsync()
    $propsTask = $asTaskGeneric.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]).Invoke($null, @($mediaOp))
    $props = $propsTask.Result
    $timeline = $s.GetTimelineProperties()
    $playback = $s.GetPlaybackInfo()

    [PSCustomObject]@{
      appId = $s.SourceAppUserModelId
      title = $props.Title
      artist = $props.Artist
      album = $props.AlbumTitle
      positionSeconds = ($timeline.Position.TotalSeconds)
      durationSeconds = ($timeline.EndTime.TotalSeconds)
      playbackStatus = $playback.PlaybackStatus.ToString()
    }
  } catch {}
}

$json = $sessions | ConvertTo-Json -Compress
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
`;

    const { stdout } = await exec("powershell.exe", ["-NoProfile", "-Command", script], {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        encoding: "utf8"
    });

    const base64 = stdout.trim();
    if (!base64) return [];

    const text = Buffer.from(base64, "base64").toString("utf8");
    if (!text) return [];

    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
}

async function fetchAlbumArtwork(track: { name: string; artist?: string; album?: string; }): Promise<string | undefined> {
    try {
        const params = new URLSearchParams({
            term: `${track.name} ${track.artist ?? ""} ${track.album ?? ""}`.trim(),
            media: "music",
            entity: "song",
            limit: "1"
        });

        const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
        if (!res.ok) return;

        const data = await res.json() as { results?: Array<{ artworkUrl100?: string; }> };
        const art = data.results?.[0]?.artworkUrl100;
        return art ? art.replace("100x100", "512x512") : undefined;
    } catch {
        return;
    }
}

async function normalizeTrack(session: RawSession): Promise<TrackData | null> {
    if (!session.title || session.playbackStatus?.toLowerCase() !== "playing") return null;

    const base: TrackData = {
        name: session.title,
        artist: session.artist,
        album: session.album,
        playerPosition: typeof session.positionSeconds === "number" ? session.positionSeconds : undefined,
        duration: typeof session.durationSeconds === "number" ? session.durationSeconds : undefined
    };

    base.albumArtwork = await fetchAlbumArtwork(base);
    return base;
}

export async function fetchTrackData(): Promise<TrackData | null> {
    try {
        const sessions = await readSessions();
        const target = sessions.find(s => APP_ID_PATTERNS.some(pattern => pattern.test(s.appId ?? "")));
        if (!target) return null;

        return await normalizeTrack(target);
    } catch {
        return null;
    }
}
