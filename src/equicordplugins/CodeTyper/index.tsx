/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { HeadingSecondary } from "@components/Heading";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { IconComponent, OptionType } from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, SearchableSelect, openModal, useMemo } from "@webpack/common";

type LanguageConfig = {
    name: string;
    codeblock: string;
};

const LANGUAGES = {
    cpp: { name: "C++", codeblock: "cpp" },
    c: { name: "C", codeblock: "c" },
    go: { name: "Go", codeblock: "go" },
    rust: { name: "Rust", codeblock: "rust" },
    php: { name: "PHP", codeblock: "php" },
    python: { name: "Python", codeblock: "py" },
    javascript: { name: "JavaScript", codeblock: "js" },
    typescript: { name: "TypeScript", codeblock: "ts" },
    csharp: { name: "C#", codeblock: "cs" },
    java: { name: "Java", codeblock: "java" },
    ruby: { name: "Ruby", codeblock: "rb" },
    lua: { name: "Lua", codeblock: "lua" },
    powershell: { name: "PowerShell", codeblock: "powershell" },
    bash: { name: "Bash", codeblock: "bash" },
    kotlin: { name: "Kotlin", codeblock: "kotlin" }
} satisfies Record<string, LanguageConfig>;

type LanguageKey = keyof typeof LANGUAGES;
const LANGUAGE_KEYS = Object.keys(LANGUAGES) as LanguageKey[];

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "turn the plugin on or off",
        default: true
    },
    selectedLanguage: {
        type: OptionType.SELECT,
        description: "default language to use",
        options: LANGUAGE_KEYS.map(key => ({
            label: LANGUAGES[key].name,
            value: key
        })),
        default: "typescript"
    },
    wrapInCodeblock: {
        type: OptionType.BOOLEAN,
        description: "wrap the message in a code block before sending",
        default: true
    },
    onlyConvertPlainText: {
        type: OptionType.BOOLEAN,
        description: "skip messages that already look like code",
        default: true
    }
});

function shouldSkipContent(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return true;
    if (!settings.store.onlyConvertPlainText) return false;
    return trimmed.startsWith("```") || trimmed.startsWith("`");
}

function formatMessage(text: string, language: LanguageKey) {
    const trimmed = text.trim();
    if (!settings.store.wrapInCodeblock) return trimmed;
    return `\`\`\`${LANGUAGES[language].codeblock}\n${trimmed}\n\`\`\``;
}

const CodeTyperIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg
        viewBox="0 0 24 24"
        width={width}
        height={height}
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M8 8L4 12L8 16M16 8L20 12L16 16M14 5L10 19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

function LanguageSelect() {
    const currentValue = settings.use(["selectedLanguage"]).selectedLanguage as LanguageKey;

    const options = useMemo(
        () => LANGUAGE_KEYS.map(value => ({
            value,
            label: LANGUAGES[value].name
        })),
        []
    );

    return (
        <div style={{ marginBottom: "16px" }}>
            <HeadingSecondary style={{ marginBottom: "8px" }}>
                language
            </HeadingSecondary>
            <SearchableSelect
                options={options}
                value={currentValue}
                placeholder="pick a language..."
                maxVisibleItems={10}
                closeOnSelect={true}
                onChange={v => settings.store.selectedLanguage = v as LanguageKey}
            />
        </div>
    );
}

function EnabledToggle() {
    const value = settings.use(["enabled"]).enabled;

    return (
        <FormSwitch
            value={value}
            onChange={v => settings.store.enabled = v}
            hideBorder
        >
            enabled
        </FormSwitch>
    );
}

function CodeblockToggle() {
    const value = settings.use(["wrapInCodeblock"]).wrapInCodeblock;

    return (
        <FormSwitch
            value={value}
            onChange={v => settings.store.wrapInCodeblock = v}
            hideBorder
        >
            wrap in code block
        </FormSwitch>
    );
}

function PlainTextToggle() {
    const value = settings.use(["onlyConvertPlainText"]).onlyConvertPlainText;

    return (
        <FormSwitch
            value={value}
            onChange={v => settings.store.onlyConvertPlainText = v}
            hideBorder
        >
            skip messages that already have code
        </FormSwitch>
    );
}

const {
    ModalRoot,
    ModalHeader,
    ModalContent,
    ModalCloseButton,
    ModalSize
} = Modal;

function CodeTyperModal({ rootProps }: { rootProps: RenderModalProps; }) {
    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader className="vcd-codetyper-modal-header">
                <HeadingSecondary>codetyper</HeadingSecondary>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>

            <ModalContent className="vcd-codetyper-modal-content">
                <LanguageSelect />
                <Divider style={{ marginBottom: "16px" }} />
                <EnabledToggle />
                <CodeblockToggle />
                <PlainTextToggle />
            </ModalContent>
        </ModalRoot>
    );
}

export const CodeTyperChatBarIcon: ChatBarButtonFactory = ({ isMainChat }) => {
    const s = settings.use(["enabled", "selectedLanguage"]);
    const lang = LANGUAGES[s.selectedLanguage as LanguageKey];

    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={`codetyper: ${lang.name}`}
            onClick={() => openModal(props => <CodeTyperModal rootProps={props} />)}
            onContextMenu={e => {
                e.preventDefault();
                openModal(props => <CodeTyperModal rootProps={props} />);
            }}
            buttonProps={{
                "aria-haspopup": "dialog"
            }}
        >
            <CodeTyperIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "CodeTyper",
    description: "sends your messages wrapped in a code block. pick the language from the chat bar.",
    authors: [EquicordDevs.rzxu],
    tags: ["Chat", "Utility", "Developer"],
    dependencies: ["ChatInputButtonAPI"],
    settings,

    chatBarButton: {
        icon: CodeTyperIcon,
        render: CodeTyperChatBarIcon
    },

    onBeforeMessageSend(_, message) {
        if (!settings.store.enabled) return;
        if (!message.content) return;
        if (shouldSkipContent(message.content)) return;

        const language = settings.store.selectedLanguage as LanguageKey;
        message.content = formatMessage(message.content, language);
    }
});
