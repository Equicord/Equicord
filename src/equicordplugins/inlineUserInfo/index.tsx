/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { EquicordDevs } from "@utils/constants";
import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { HeadingSecondary } from "@components/Heading";
import { classes } from "@utils/misc";
import definePlugin, { IconComponent, OptionType } from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, SearchableSelect, openModal, useMemo } from "@webpack/common";

const LANGUAGES = {
    python: { name: "Python", codeblock: "py", wrap: (text: string) => `print(${JSON.stringify(text)})` },
    javascript: { name: "JavaScript", codeblock: "js", wrap: (text: string) => `console.log(${JSON.stringify(text)});` },
    typescript: { name: "TypeScript", codeblock: "ts", wrap: (text: string) => `console.log(${JSON.stringify(text)});` },
    csharp: { name: "C#", codeblock: "cs", wrap: (text: string) => `Console.WriteLine(${JSON.stringify(text)});` },
    java: { name: "Java", codeblock: "java", wrap: (text: string) => `System.out.println(${JSON.stringify(text)});` },
    cpp: { name: "C++", codeblock: "cpp", wrap: (text: string) => `std::cout << ${JSON.stringify(text)} << std::endl;` },
    c: { name: "C", codeblock: "c", wrap: (text: string) => `printf(${JSON.stringify(text + "\\n")});` },
    go: { name: "Go", codeblock: "go", wrap: (text: string) => `fmt.Println(${JSON.stringify(text)})` },
    rust: { name: "Rust", codeblock: "rs", wrap: (text: string) => `println!(${JSON.stringify(text)});` },
    php: { name: "PHP", codeblock: "php", wrap: (text: string) => `echo ${JSON.stringify(text)};` },
    ruby: { name: "Ruby", codeblock: "rb", wrap: (text: string) => `puts ${JSON.stringify(text)}` },
    lua: { name: "Lua", codeblock: "lua", wrap: (text: string) => `print(${JSON.stringify(text)})` },
    powershell: { name: "PowerShell", codeblock: "powershell", wrap: (text: string) => `Write-Host ${JSON.stringify(text)}` },
    bash: { name: "Bash", codeblock: "bash", wrap: (text: string) => `echo ${JSON.stringify(text)}` },
    kotlin: { name: "Kotlin", codeblock: "kt", wrap: (text: string) => `println(${JSON.stringify(text)})` }
} as const;

type LanguageKey = keyof typeof LANGUAGES;
const LANGUAGE_KEYS = Object.keys(LANGUAGES) as LanguageKey[];

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable CodeTyper",
        default: true
    },
    selectedLanguage: {
        type: OptionType.SELECT,
        description: "Default language",
        options: LANGUAGE_KEYS.map(key => ({
            label: LANGUAGES[key].name,
            value: key
        })),
        default: "typescript"
    },
    wrapInCodeblock: {
        type: OptionType.BOOLEAN,
        description: "Wrap sent output in a code block",
        default: true
    },
    onlyConvertPlainText: {
        type: OptionType.BOOLEAN,
        description: "Do not convert messages that already look like code blocks",
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
    const output = LANGUAGES[language].wrap(trimmed);

    if (!settings.store.wrapInCodeblock) return output;
    return `\`\`\`${LANGUAGES[language].codeblock}\n${output}\n\`\`\``;
}

const CodeTyperIcon: IconComponent = ({ height = 20, width = 20, className }) => {
    return (
        <svg
            viewBox="0 0 24 24"
            height={height}
            width={width}
            className={classes("vc-codetyper-icon", className)}
            fill="none"
        >
            <path d="M8 7 3.5 12 8 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 7 20.5 12 16 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.5 5.5 10.5 18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
};

function LanguageSelect() {
    const currentValue = settings.use(["selectedLanguage"]).selectedLanguage as LanguageKey;

    const options = useMemo(
        () => LANGUAGE_KEYS.map(value => ({ value, label: LANGUAGES[value].name })),
        []
    );

    return (
        <section style={{ marginBottom: "16px" }}>
            <HeadingSecondary>Language</HeadingSecondary>
            <SearchableSelect
                options={options}
                value={currentValue}
                placeholder="Select a language"
                maxVisibleItems={8}
                closeOnSelect={true}
                onChange={v => settings.store.selectedLanguage = v as LanguageKey}
            />
        </section>
    );
}

function EnabledToggle() {
    const value = settings.use(["enabled"]).enabled;

    return (
        <FormSwitch
            title="Enable CodeTyper"
            description="Convert outgoing messages into code before sending."
            value={value}
            onChange={v => settings.store.enabled = v}
            hideBorder
        />
    );
}

function CodeblockToggle() {
    const value = settings.use(["wrapInCodeblock"]).wrapInCodeblock;

    return (
        <FormSwitch
            title="Wrap in code block"
            description="Send the generated code inside a fenced code block."
            value={value}
            onChange={v => settings.store.wrapInCodeblock = v}
            hideBorder
        />
    );
}

function PlainTextToggle() {
    const value = settings.use(["onlyConvertPlainText"]).onlyConvertPlainText;

    return (
        <FormSwitch
            title="Only convert plain text"
            description="Skip messages that already start with backticks or code blocks."
            value={value}
            onChange={v => settings.store.onlyConvertPlainText = v}
            hideBorder
        />
    );
}

function CodeTyperModal({ rootProps }: { rootProps: RenderModalProps; }) {
    return (
        <Modal {...rootProps} title="CodeTyper">
            <LanguageSelect />
            <Divider style={{ marginBottom: "16px" }} />
            <EnabledToggle />
            <CodeblockToggle />
            <PlainTextToggle />
        </Modal>
    );
}

function openCodeTyperModal() {
    openModal(props => <CodeTyperModal rootProps={props} />);
}

export const CodeTyperChatBarIcon: ChatBarButtonFactory = ({ isMainChat }) => {
    const s = settings.use(["enabled", "selectedLanguage"]);

    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={`CodeTyper: ${LANGUAGES[s.selectedLanguage as LanguageKey].name}`}
            onClick={() => openCodeTyperModal()}
            onContextMenu={e => {
                e.preventDefault();
                openCodeTyperModal();
            }}
            buttonProps={{
                "aria-haspopup": "dialog"
            }}
        >
            <CodeTyperIcon className={classes(s.enabled && "vc-codetyper-enabled")} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "CodeTyper",
    description: "Convert outgoing messages into code in a selectable programming language.",
    authors: [{ name: "rzxu", id: 1377753727334617168n }],
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