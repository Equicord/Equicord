export type EmbedType =
    | "image"
    | "video"
    | "link"
    | "article"
    | "tweet"
    | "rich"
    | "gifv"
    | "application_news"
    | "auto_moderation_message"
    | "auto_moderation_notification"
    | "text"
    | "post_preview"
    | "gift"
    | "safety_policy_notice"
    | "safety_system_notification"
    | "age_verification_system_notification"
    | "voice_channel"
    | "gaming_profile"
    | "poll_result";

export interface Embed {
    author?: {
        name: string;
        url: string;
        iconURL: string | undefined;
        iconProxyURL: string | undefined;
    };
    color: string;
    fields: [];
    id: string;
    image?: {
        height: number;
        width: number;
        url: string;
        proxyURL: string;
    };
    provider?: {
        name: string;
        url: string | undefined;
    };
    rawDescription: string;
    rawTitle: string;
    referenceId: unknown;
    timestamp: string;
    thumbnail?: {
        height: number;
        proxyURL: string | undefined;
        url: string;
        width: number;
    };
    type: EmbedType;
    url: string | undefined;
    video?: {
        height: number;
        width: number;
        url: string;
        proxyURL: string | undefined;
    };
}

export interface EmbedJSON {
    author?: {
        name: string;
        url: string;
        icon_url: string;
        proxy_icon_url: string;
    };
    title: string;
    color: string;
    description: string;
    type: EmbedType;
    url: string | undefined;
    provider?: {
        name: string;
        url: string;
    };
    timestamp: string;
    thumbnail?: {
        height: number;
        width: number;
        url: string;
        proxy_url: string | undefined;
    };
    video?: {
        height: number;
        width: number;
        url: string;
        proxy_url: string | undefined;
    };
}
