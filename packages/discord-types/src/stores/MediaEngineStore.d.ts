import { FluxStore } from "..";

export interface AudioDevice {
    id: string;
    index: number;
    name: string;
    disabled: boolean;
    guid: string;
    hardwareId: string;
    containerId: string;
}

export interface VideoDevice {
    id: string;
    index: number;
    name: string;
    disabled: boolean;
    facing: string;
    guid: string;
}

export interface GoLiveSource {
    desktopSource: {
        id: string;
        sourcePid: number | null;
        soundshareId: string | null;
        soundshareSession: string | null;
    };
    quality: {
        resolution: number;
        frameRate: number;
    };
}

export interface VideoStreamParameter {
    rid: string;
    type: string;
    quality: number;
}

export interface LocalPan {
    left: number;
    right: number;
}

export interface ModeOptions {
    threshold: number;
    autoThreshold: boolean;
    vadUseKrisp: boolean;
    vadKrispActivationThreshold: number;
    vadLeading: number;
    vadTrailing: number;
    delay: number;
    shortcut: string[];
    vadDuringPreProcess?: boolean;
}

export interface MediaEngine {
    applyMediaFilterSettings(): void;
    connect(): void;
    connectionsEmpty(): boolean;
    createReplayConnection(): void;
    destroy(): void;
    eachConnection(callback: (connection: unknown) => void): void;
    enable(): void;
    exportClip(): void;
    fetchAsyncResources(options?: { fetchDave?: boolean; }): void;
    getAudioInputDevices(callback: (devices: AudioDevice[]) => void): void;
    getAudioLayer(): string;
    getAudioOutputDevices(callback: (devices: AudioDevice[]) => void): void;
    getAudioSubsystem(): string;
    getCodecCapabilities(callback: (capabilities: string) => void): void;
    getCodecSurvey(): Promise<unknown>;
    getDebugLogging(): boolean;
    getDesktopSource(): Promise<unknown>;
    getLoopback(): boolean;
    getMLSSigningKey(): Promise<unknown>;
    getNoiseCancellationStats(): unknown;
    getScreenPreviews(): Promise<unknown>;
    getSupportedBandwidthEstimationExperiments(): unknown;
    getSupportedSecureFramesProtocolVersion(): number;
    getSupportedVideoCodecs(callback: (codecs: string[]) => void): void;
    getSystemMicrophoneMode(): boolean;
    getVideoInputDeviceId(): string;
    getVideoInputDevices(callback: (devices: VideoDevice[]) => void): void;
    getWindowPreviews(): Promise<unknown>;
    interact(): void;
    presentNativeScreenSharePicker(): void;
    queueAudioSubsystem(): void;
    rankRtcRegions(regions: unknown[]): Promise<unknown>;
    releaseNativeDesktopVideoSourcePickerStream(): void;
    saveClip(): void;
    saveClipForUser(): void;
    saveScreenshot(): void;
    setAecDump(value: boolean): void;
    setAsyncClipsSourceDeinit(callback: () => void): void;
    setAsyncVideoInputDeviceInit(callback: () => void): void;
    setAudioInputBypassSystemProcessing(value: boolean): void;
    setAudioInputDevice(deviceId: string): void;
    setAudioOutputDevice(deviceId: string): void;
    setAudioSubsystem(subsystem: string): void;
    setAv1Enabled(value: boolean): void;
    setClipBufferLength(length: number): void;
    setClipsMLPipelineEnabled(value: boolean): void;
    setClipsMLPipelineTypeEnabled(type: string, value: boolean): void;
    setClipsQualitySettings(settings: unknown): void;
    setClipsSource(source: unknown): void;
    setDebugLogging(value: boolean): void;
    setGoLiveSource(source: unknown): void;
    setH264Enabled(value: boolean): void;
    setH265Enabled(value: boolean): void;
    setHasFullbandPerformance(value: boolean): void;
    setInputVolume(volume: number): void;
    setLoopback(reason: string, enabled: boolean): void;
    setMaxSyncDelayOverride(delay: number): void;
    setMaybePreprocessMute(value: boolean): void;
    setNativeDesktopVideoSourcePickerActive(value: boolean): void;
    setNoiseCancellationEnableStats(value: boolean): void;
    setOffloadAdmControls(value: boolean): void;
    setOnVideoContainerResized(callback: () => void): void;
    setOutputVolume(volume: number): void;
    setSidechainCompression(value: boolean): void;
    setSidechainCompressionStrength(strength: number): void;
    setSoundshareSource(source: unknown): void;
    setVideoInputDevice(deviceId: string): void;
    shouldConnectionBroadcastVideo(): boolean;
    showSystemCaptureConfigurationUI(): void;
    startAecDump(): void;
    startLocalAudioRecording(): void;
    startRecordingRawSamples(): void;
    stopAecDump(): void;
    stopLocalAudioRecording(): void;
    stopRecordingRawSamples(): void;
    supported(): boolean;
    supports(feature: string): boolean;
    updateClipMetadata(metadata: unknown): void;
    watchdogTick(): void;
    writeAudioDebugState(): Promise<void>;
}

export class MediaEngineStore extends FluxStore {
    fetchAsyncResources(): void;
    getActiveInputProfile(): string;
    getActiveVoiceFilter(): string | null;
    getActiveVoiceFilterAppliedAt(): Date | null;
    getAecDump(): boolean;
    getAttenuateWhileSpeakingOthers(): boolean;
    getAttenuateWhileSpeakingSelf(): boolean;
    getAttenuation(): number;
    getAudioSubsystem(): string;
    getAutomaticGainControl(): boolean;
    getBypassSystemInputProcessing(): boolean;
    getCameraComponent(): React.ComponentType;
    getDebugLogging(): boolean;
    getEchoCancellation(): boolean;
    getEnableSilenceWarning(): boolean;
    getEverSpeakingWhileMuted(): boolean;
    getExperimentalSoundshare(): boolean;
    getGoLiveContext(): string;
    getGoLiveSource(): GoLiveSource | null;
    getGpuBrand(): string;
    getH265Enabled(): boolean;
    getHardwareEncoding(): boolean;
    getInputDetected(): boolean | null;
    getInputDeviceId(): string;
    getInputDevices(): Record<string, AudioDevice>;
    getInputVolume(): number;
    getKrispEnableStats(): boolean;
    getKrispModelOverride(): string;
    getKrispModels(): string[];
    getKrispSuppressionLevel(): number;
    getKrispVadActivationThreshold(): number;
    getLastAudioInputDeviceChangeTimestamp(): number;
    getLocalPan(userId: string, context?: string): LocalPan;
    getLocalVolume(userId: string, context?: string): number;
    getLoopback(): boolean;
    getLoopbackReasons(): Set<string>;
    getMediaEngine(): MediaEngine;
    getMLSSigningKey(): Promise<unknown>;
    getMode(): string;
    getModeOptions(): ModeOptions;
    getMostRecentlyRequestedVoiceFilter(): string | null;
    getNoInputDetectedNotice(): boolean;
    getNoiseCancellation(): boolean;
    getNoiseSuppression(): boolean;
    getOutputDeviceId(): string;
    getOutputDevices(): Record<string, AudioDevice>;
    getOutputVolume(): number;
    getPacketDelay(): number;
    getPreviousVoiceFilter(): string | null;
    getPreviousVoiceFilterAppliedAt(): Date | null;
    getQoS(): boolean;
    getSettings(): Record<string, unknown>;
    getShortcuts(): Record<string, unknown>;
    getSidechainCompression(): boolean;
    getSidechainCompressionStrength(): number;
    getSpeakingWhileMuted(): boolean;
    getState(): {
        settingsByContext: Record<string, unknown>;
        inputDevices: Record<string, AudioDevice>;
        outputDevices: Record<string, AudioDevice>;
        appSupported: boolean;
        krispModuleLoaded: boolean;
        krispVersion: string;
        krispSuppressionLevel: number;
        goLiveSource: GoLiveSource | null;
        goLiveContext: string;
    };
    getSupportedSecureFramesProtocolVersion(): number;
    getSystemMicrophoneMode(): boolean;
    getUseGamescopeCapture(): boolean;
    getUseSystemScreensharePicker(): boolean;
    getUseVaapiEncoder(): boolean;
    getVideoComponent(): React.ComponentType;
    getVideoDeviceId(): string;
    getVideoDevices(): Record<string, VideoDevice>;
    getVideoHook(): boolean;
    getVideoStreamParameters(): VideoStreamParameter[];
    getVideoToggleState(userId: string, context?: string): string;
    getVoiceFilterPlaybackEnabled(): boolean;

    goLiveSimulcastEnabled(): boolean;

    hasActiveCallKitCall(): boolean;
    hasClipsSource(): boolean;
    hasContext(context: string): boolean;
    hasH265HardwareDecode(): boolean;

    isAdvancedVoiceActivitySupported(): boolean;
    isAecDumpSupported(): boolean;
    isAnyLocalVideoAutoDisabled(): boolean;
    isAutomaticGainControlSupported(): boolean;
    isDeaf(): boolean;
    isEnableHardwareMuteNotice(): boolean;
    isEnabled(): boolean;
    isHardwareMute(): boolean;
    isInputProfileCustom(): boolean;
    isInteractionRequired(): boolean;
    isLocalMute(userId?: string): boolean;
    isLocalVideoAutoDisabled(userId: string): boolean;
    isLocalVideoDisabled(userId?: string): boolean;
    isMediaFilterSettingLoading(): boolean;
    isMute(): boolean;
    isNativeAudioPermissionReady(): boolean;
    isNoiseCancellationError(): boolean;
    isNoiseCancellationSupported(): boolean;
    isNoiseSuppressionSupported(): boolean;
    isScreenSharing(): boolean;
    isSelfDeaf(): boolean;
    isSelfMute(): boolean;
    isSelfMutedTemporarily(): boolean;
    isSimulcastSupported(): boolean;
    isSoundSharing(): boolean;
    isSupported(): boolean;
    isVideoAvailable(): boolean;
    isVideoEnabled(): boolean;

    notifyMuteUnmuteSoundWasSkipped(): boolean;
    setCanHavePriority(userId: string, value: boolean): void;
    setHasActiveCallKitCall(active: boolean): void;
    shouldOfferManualSubsystemSelection(): boolean;
    shouldSkipMuteUnmuteSound(): boolean;
    showBypassSystemInputProcessing(): boolean;

    startDavePreload(): void;

    supports(feature: string): boolean;
    supportsDisableLocalVideo(): boolean;
    supportsExperimentalSoundshare(): boolean;
    supportsHookSoundshare(): boolean;
    supportsInApp(appName: string): boolean;
    supportsScreenSoundshare(): boolean;
    supportsSystemScreensharePicker(): boolean;
    supportsVideoHook(): boolean;
}
