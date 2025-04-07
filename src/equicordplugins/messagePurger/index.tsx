/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Button, Forms, React, Switch, TextInput, Slider, TextArea, PermissionStore, PermissionsBits, ChannelStore, Flex, RestAPI, UserStore } from "@webpack/common";
import { addChatBarButton, ChatBarButton, removeChatBarButton } from "@api/ChatButtons";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, openModal, ModalSize } from "@utils/modal";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Devs, EquicordDevs } from "@utils/constants";
import { getCurrentChannel } from "@utils/discord";
import { sleep } from "@utils/misc";
import { findComponentByCodeLazy } from "@webpack";
import { Margins } from "@utils/margins";
import type { MessageAttachment, User } from "discord-types/general";

interface Message {
    guild_id: string,
    attachments: MessageAttachment[],
    author: User,
    channel_id: string,
    components: any[],
    content: string,
    edited_timestamp: string,
    embeds: any[],
    sticker_items?: any[],
    flags: number,
    call?: any;
    id: string,
    interaction: any,
    member: any,
    mention_everyone: boolean,
    mention_roles: string[],
    mentions: any[],
    nonce: string,
    pinned: false,
    referenced_message: any,
    timestamp: string,
    tts: boolean,
    type: number;
}

interface Options {
    UserID: string;
    channelID: string;
    enableKeywords: boolean;
    beforeMessageID: string;
    afterMessageID: string;
    ascending: boolean;
    link: boolean;
    file: boolean;
    messageAmount: number;
}

const Checkbox = findComponentByCodeLazy(".checkboxWrapperDisabled:");

let deleting = false;
let aborted = false;

const messageStore: {
    update: (value: any) => void;
    value: any[];
} = {
    update: (value) => { },
    value: []
};

const MessageAmountStore = { update: (value) => { }, value: "" };
const deleteAmountStore = { update: (value) => { }, value: 0 };
const indexAmountStore = { update: (value) => { }, value: 0 };
const CompleteStore = { update: (value) => { }, value: false };

let params: Options = {
    UserID: "",
    channelID: "",
    enableKeywords: true,
    beforeMessageID: "",
    afterMessageID: "",
    ascending: true,
    link: false,
    file: false,
    messageAmount: 0
};
const settings = definePluginSettings({
    deleteInterval: {
        type: OptionType.NUMBER,
        description: "Set Delete Interval",
        default: 100
    },
    searchInterval: {
        type: OptionType.NUMBER,
        description: "Set Search Interval",
        default: 100
    },
    ascending: {
        type: OptionType.BOOLEAN,
        description: "Set Ascending Boolean",
        default: true

    },
    autoScroll: {
        type: OptionType.BOOLEAN,
        description: "Automatically scrolls through the text area",
        default: true

    },
    keyWords: {
        type: OptionType.STRING,
        description: "Key words to target",
    },
});
async function IndexMessages(total: number, keywords = "") {
    for (let j = 0; j < total; j += 25) {

        if (aborted) {
            cleanUp();
            return null;
        }
        let searchIndex;

        if (settings.store.ascending) searchIndex = ((Math.ceil(total / 25) * 25) - j - 25);
        else searchIndex = j;

        const url = constructUrl(keywords, params.channelID, params.UserID, params.link, params.file, searchIndex, params.beforeMessageID, params.afterMessageID);
        const body = await searchAPI(url);

        if (j > 0) await sleep(settings.store.searchInterval);

        const messages = body.messages.flat() as Message[];

        messageStore.value = [...messageStore.value, `${new Date().toLocaleTimeString('en-US', localeOptions)} - Indexed ${messages.length} New Messages`];

        indexAmountStore.value += 25;
        indexAmountStore.update(indexAmountStore.value);
        messageStore.update(messageStore.value);

        for (let i = 0; i < messages.length; i++) {
            let deleteIndex;
            if (settings.store.ascending) deleteIndex = ((messages.length - 1) - i);
            else deleteIndex = i;


            if (aborted) {
                cleanUp();
                return null;
            }
            deleteAmountStore.value++;
            deleteAmountStore.update(deleteAmountStore.value);
            let deleteStatus: string;
            if (messages[deleteIndex]?.call) deleteStatus = `Skipped [ Voice Call ]`;
            else if (messages[deleteIndex]?.interaction) deleteStatus = `Skipped [ Interaction ]`;
            else if (messages[deleteIndex]?.content !== "") deleteStatus = `Deleted [ ${messages[deleteIndex].content} ]`;
            else if (messages[deleteIndex]?.type === 6) deleteStatus = `Deleted [ Pinned Message ]`;
            else if (messages[deleteIndex]?.attachments.length > 0) deleteStatus = `Deleted [ Attachments ]`;
            else if (messages[deleteIndex]?.sticker_items) deleteStatus = `Deleted [ Sticker ]`;
            else if (messages[deleteIndex]?.embeds.length > 0) deleteStatus = `Deleted [ Embed ]`;
            else deleteStatus = `Deleted [ message : ${messages[deleteIndex].id} ]`;

            if (aborted) {
                cleanUp();
                return null;
            }

            if (deleteStatus.includes("Deleted")) {
                await sleep(settings.store.deleteInterval);
                await deleteAPI(params.channelID, messages[deleteIndex].id);
            }
            messageStore.value = [...messageStore.value, `${new Date().toLocaleTimeString('en-US', localeOptions)} - ${deleteStatus}`];
            messageStore.update(messageStore.value);

        }


    }
    return true;
}
async function startDeleting() {
    MessageAmountStore.update(params.messageAmount);
    if (!deleting) {
        deleting = true;
        if (params.enableKeywords) {
            const keywords = settings.store.keyWords?.split('\n').filter(item => item !== '') ?? [];
            for (let i = 0; i < keywords.length; i++) {
                const url = constructUrl(keywords[i], params.channelID, params.UserID, params.link, params.file, undefined, params.beforeMessageID, params.afterMessageID);
                const body = await searchAPI(url);
                if (aborted) return;
                if (!await IndexMessages(body.total_results, keywords[i])) return;
            }
        }
        else {
            const url = constructUrl("", params.channelID, params.UserID, params.link, params.file, undefined, params.beforeMessageID, params.afterMessageID);
            const body = await searchAPI(url);
            if (!await IndexMessages(body.total_results)) return;

        }
        CompleteStore.update(true);
        CompleteStore.value = true;
    }
}
function DeleteMessageModal({
    props,
    options,
}: {
    props: ModalProps;
    options: any;
}) {

    const [messages, setMessages] = React.useState(params.messageAmount);
    const [deleted, setDeleted] = React.useState(deleteAmountStore.value);
    const [data, setData] = React.useState(messageStore.value);
    const [abort, setAbort] = React.useState(false);
    const [complete, setComplete] = React.useState(CompleteStore.value);
    const [searchMessage, setSearchMessage] = React.useState(settings.store.searchInterval);
    const [deleteMessage, setDeleteMessage] = React.useState(settings.store.deleteInterval);
    const [autoScroll, setAutoScroll] = React.useState(settings.store.autoScroll);

    messageStore.update = setData;
    MessageAmountStore.update = setMessages;
    CompleteStore.update = setComplete;
    deleteAmountStore.update = setDeleted;

    React.useEffect(() => {
        if (!deleting && !aborted) void startDeleting();
        return () => {
            if (abort) {
                messageStore.update = () => { };
                MessageAmountStore.update = () => { };
                CompleteStore.update = () => { };
                deleteAmountStore.update = () => { };

                messageStore.value = [];
                MessageAmountStore.value = "";
                deleteAmountStore.value = 0;
                indexAmountStore.value = 0;

                aborted = true;
                deleting = false;
            }
        };
    }, [abort]);

    React.useEffect(() => {
        if (settings.store.autoScroll) AutoScroll();
    }, [deleted]);

    return (<ModalRoot {...props} size={ModalSize.LARGE}>
        <ModalHeader>

            <DeleteSvgIcon />
            <Forms.FormTitle tag="h4"> Deleted {deleted} / {messages} messages</Forms.FormTitle>
        </ModalHeader>
        <ModalContent>
            <Forms.FormTitle tag="h5" style={{ marginTop: "10px" }}>Delete Interval</Forms.FormTitle>
            <Slider
                disabled={false}
                markers={[3000, 5000, 10000, 20000, 30000]}
                minValue={3000}
                maxValue={30000}
                initialValue={deleteMessage}
                onValueChange={v => {
                    settings.store.deleteInterval = Number(v.toFixed(0));
                    setDeleteMessage(Number(v.toFixed(0)));
                }}
                onValueRender={v => (v / 1000).toFixed(2) + "s"}
                onMarkerRender={v => (v / 1000) + "s"}
                stickToMarkers={false}
            />
            <Forms.FormTitle tag="h5" style={{ marginTop: "10px" }}>Search Interval</Forms.FormTitle>
            <Slider
                disabled={false}
                markers={[3000, 5000, 10000, 20000, 30000]}
                minValue={3000}
                maxValue={30000}
                initialValue={searchMessage}
                onValueChange={v => {
                    settings.store.searchInterval = Number(v.toFixed(0));
                    setSearchMessage(Number(v.toFixed(0)));

                }}
                onValueRender={v => (v / 1000).toFixed(2) + "s"}
                onMarkerRender={v => (v / 1000) + "s"}
                stickToMarkers={false}
            />

            <Forms.FormText style={{ marginTop: "10px" }} className={Margins.bottom8}>Estimated Time : {msToTime((Math.ceil((messages - indexAmountStore.value) / 25) * searchMessage) + ((messages - deleteAmountStore.value) * deleteMessage))}</Forms.FormText>
            <Forms.FormTitle tag="h5" style={{ marginTop: "10px" }}>Console</Forms.FormTitle>
            <TextArea
                value={data.join('\n\n')}
                onChange={(e: string) => { }}
                spellCheck={false}
                rows={15}
                id="delete-text-area"
            />
            <Flex style={{ marginTop: "8px", marginBottom: "10px" }}>
                <Checkbox
                    value={autoScroll}
                    onChange={() => {
                        setAutoScroll(!autoScroll);
                        settings.store.autoScroll = !autoScroll;
                    }}
                    type="inverted"
                    color="var(--brand-500)"
                >
                    {<Forms.FormText>Automatically Scroll</Forms.FormText>}
                </Checkbox>
            </Flex>
        </ModalContent>
        <ModalFooter>
            <Button
                color={complete ? Button.Colors.GREEN : Button.Colors.RED}
                onClick={() => {
                    if (!complete) setAbort(true);
                    else cleanUp();
                    props.onClose();
                }}
            >
                {!complete ? "Abort" : "Exit"}
            </Button>
            {!complete ? <Button
                color={Button.Colors.TRANSPARENT}
                look={Button.Looks.LINK}
                style={{ left: 15, position: "absolute" }}
                onClick={() => {
                    props.onClose();
                }}
            >
                Close
            </Button>
                : (null)}
        </ModalFooter>
    </ModalRoot>);
}
function IndexMessageModal({ props, options, }: { props: ModalProps; options: any; }) {
    let [messageAmount, setMessageAmount] = React.useState(0);
    const [cancelled, setCancelled] = React.useState(false);
    const [complete, setComplete] = React.useState(false);
    const [messages, setMessages] = React.useState<Message[]>([]);
    let [formattedMessages, setFormattedMessages] = React.useState("");

    async function getMessages(url) {

        if (options.beforeMessageID) url += `&max_id=${options.beforeMessageID}`;
        if (options.afterMessageID) url += `&min_id=${options.afterMessageID}`;

        const body = await searchAPI(url);
        messages.push(...body.messages.flat());
        setMessages(messages);

        setFormattedMessages(
            messages.map(obj => {
                let output: string = `${UserStore.getUser(options.UserID)} - ` + `[ ${new Date(obj.timestamp).toLocaleString()} ]` + '\n';
                if (obj.hasOwnProperty("call")) return output += "[ Voice Call ]";
                if (obj.hasOwnProperty("interaction")) return output += "[ Interaction Response ]";
                if (obj?.content) output += obj.content;
                if (obj.attachments?.length > 0) void obj.attachments.map((attachment) => output += attachment.proxy_url + '\n');
                return output;
            }).join('\n\n'));
        return body.total_results as number;
    }
    const generateQuery = async () => {
        if (options.enableKeywords) {
            const keywords = settings.store.keyWords?.split('\n').filter(item => item !== '') ?? [];
            for (let i = 0; i < keywords.length; i++) {
                const total_results = await getMessages(constructUrl(keywords[i], options.channelID, options.UserID, options.link, options.file, undefined, options.beforeMessageID, options.afterMessageID));
                setMessageAmount(messageAmount += total_results);
            }
        }
        else {
            const total_results = await getMessages(constructUrl("", options.channelID, options.UserID, options.link, options.file, undefined, options.beforeMessageID, options.afterMessageID));
            setMessageAmount(messageAmount += total_results);
        }
        if (messageAmount > messages.length) {
            setFormattedMessages(message => message += `\n\n${messageAmount - messages.length} messages left to index...`);
        }
        options.messageAmount = messageAmount;
        params = options;
        setComplete(true);
    };
    React.useEffect(() => {
        let isCancelled = false;
        if (!isCancelled) void generateQuery();
        return () => { isCancelled = true; };
    }, [cancelled]);


    return (<ModalRoot {...props} size={ModalSize.MEDIUM}
    >
        <ModalHeader>
            <DeleteSvgIcon />
            <Forms.FormTitle tag="h4">Found {messageAmount} Messages</Forms.FormTitle>
        </ModalHeader>

        <ModalContent
            style={{ marginTop: "10px", marginBottom: "10px" }}
        >

            <Forms.FormText className={Margins.bottom8}>Estimated Time : {msToTime(((messageAmount / 25) * settings.store.searchInterval) + (messageAmount * settings.store.deleteInterval))}</Forms.FormText>
            <TextArea
                style={{ marginTop: "10px", marginBottom: "10px" }}
                value={formattedMessages}
                onChange={(e: string) => { }}
                spellCheck={false}
                rows={18}
            />
        </ModalContent>

        <ModalFooter>
            <Button
                color={Button.Colors.RED}
                disabled={!complete}
                onClick={() => {
                    if (messageAmount > 0) openModal(props => <DeleteMessageModal props={props} options={options} />);
                    props.onClose();
                }}
            >
                {messageAmount > 0 ? "Delete" : "Close"}
            </Button>
            {messageAmount > 0 ? (<Button
                color={Button.Colors.TRANSPARENT}
                look={Button.Looks.LINK}
                style={{ left: 15, position: "absolute" }}
                onClick={() => { setCancelled(true); props.onClose(); }}
            >
                Close
            </Button>) : (null)}
        </ModalFooter>
    </ModalRoot >);
}
export default definePlugin({
    name: "MessagePurger",
    authors: [EquicordDevs.xijexo, EquicordDevs.omaw],
    description: "Adds a button to chat-bar to easily delete your messages.",
    settings,
    settingsAboutComponent: () => <>
        <Forms.FormText
                className="button-danger-background"
                style={{
                    fontSize: '16px',
                    backgroundColor: 'darkred',
                    color: 'white',
                    border: '1px solid black',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    padding: '6px 10px',
                    textAlign: 'center',
                    marginTop: '10px',
                    whiteSpace: 'pre-wrap',
                }}
            >
               We can't guarantee this plugin won't get you warned or banned.
        </Forms.FormText>
    </>,
    start: () => {
        addChatBarButton("DeleteIcon", DeleteIcon);
    },
    stop: () => removeChatBarButton("DeleteIcon"),
});
const DeleteIcon: ChatBarButton = ({ isMainChat }) => {
    if (!isMainChat) return null;
    return (
        <ChatBarButton
            tooltip="Message Purger"
            onClick={() => {
                if (deleting) openModal(props => <DeleteMessageModal props={props} options={null} />);
                else openModal(props => <EncModals {...props} />);
            }}
        >
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                // style={{ scale: "1.0", transform: "translate(5px, 1px)" }}
            >
                <path
                    fill="var(--red-430)"
                    d="M14.25 1c.41 0 .75.34.75.75V3h5.25c.41 0 .75.34.75.75v.5c0 .41-.34.75-.75.75H3.75A.75.75 0 0 1 3 4.25v-.5c0-.41.34-.75.75-.75H9V1.75c0-.41.34-.75.75-.75h4.5Z"
                />
                <path
                    fill="var(--red-430)"
                    d="M5.06 7a1 1 0 0 0-1 1.06l.76 12.13a3 3 0 0 0 3 2.81h8.36a3 3 0 0 0 3-2.81l.75-12.13a1 1 0 0 0-1-1.06H5.07ZM11 12a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Zm3-1a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"
                />
            </svg>
        </ChatBarButton>
    );
};
function EncModals(props: ModalProps) {
    const [channelID, setChannelID] = React.useState(getCurrentChannel().id);
    const [UserID, setUserID] = React.useState(UserStore.getCurrentUser().id);
    const [enableKeywords, setEnableKeywords] = React.useState(false);
    const [Keywords, setKeywords] = React.useState(settings.store.keyWords);
    const [interval, setInterval] = React.useState(settings.store.deleteInterval);
    const [search, setSearch] = React.useState(settings.store.searchInterval);
    const [ascending, setAscending] = React.useState(settings.store.ascending);
    const [link, setLink] = React.useState(false);
    const [file, setFile] = React.useState(false);
    const [beforeMessageID, setBeforeMessageID] = React.useState("");
    const [afterMessageID, setAfterMessageID] = React.useState("");
    const [permissions, setPermissions] = React.useState(PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, getCurrentChannel()));
    const [channel, setChannel] = React.useState(getCurrentChannel());
    const [user, setUser] = React.useState(UserStore.getCurrentUser());

    return (
        <ModalRoot {...props} size={ModalSize.LARGE}>
            <ModalHeader>
                <DeleteSvgIcon />
                <Forms.FormTitle tag="h4">Message Purger</Forms.FormTitle>
            </ModalHeader>

            <Forms.FormText
                className="button-danger-background"
                style={{
                    fontSize: '16px',
                    border: '1px solid black',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    padding: '6px 10px',
                    textAlign: 'center',
                    marginTop: '10px',
                    margin: '10px auto',
                    whiteSpace: 'pre-wrap',
                    maxWidth: '90%',
                }}
            >
                Use this with extreme precaution as this can put your account at risk by spamming Discord's API.
                <br />
                (Equicord is not responsible for you being warned or banned.)
            </Forms.FormText>


            <ModalContent>

                <Forms.FormTitle tag="h5" style={{ marginTop: "10px" }}>Delete Interval</Forms.FormTitle>
                <Slider
                    disabled={false}
                    markers={[3000, 5000, 10000, 20000, 30000]}
                    minValue={3000}
                    maxValue={30000}
                    initialValue={interval ?? 1000}
                    onValueChange={v => {
                        settings.store.deleteInterval = Number(v.toFixed(0));
                        setInterval(Number(v.toFixed(0)));
                    }}
                    onValueRender={v => (v / 1000).toFixed(2) + "s"}
                    onMarkerRender={v => (v / 1000) + "s"}
                    stickToMarkers={false}
                />

                <Forms.FormTitle tag="h5" style={{ marginTop: "10px" }}>Search Interval</Forms.FormTitle>
                <Slider
                    disabled={false}
                    markers={[3000, 5000, 10000, 20000, 30000]}
                    minValue={3000}
                    maxValue={30000}
                    initialValue={search ?? 1000}
                    onValueChange={v => {
                        settings.store.searchInterval = Number(v.toFixed(0));
                        setSearch(Number(v.toFixed(0)));
                    }}
                    onValueRender={v => (v / 1000).toFixed(2) + "s"}
                    onMarkerRender={v => (v / 1000) + "s"}
                    stickToMarkers={false}
                />

                <Flex flexDirection="row" style={{ marginTop: "10px", marginBottom: "10px", justifyContent: "space-around", }}>
                    <Flex style={{ justifyContent: "space-around", "flex-direction": "column" }}>
                        <Flex style={{ justifyContent: "flex-start", "flex-direction": "column", gap: "5px", marginLeft: "0px" }}>
                            <Forms.FormTitle tag="h5">Channel ID</Forms.FormTitle>
                            <TextInput
                                value={channelID}
                                placeholder="Channel ID"
                                onChange={(e: string) => {
                                    /^\d*$/.test(e) ? setChannelID(e) : null;
                                    setPermissions(PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, ChannelStore.getChannel(e)));
                                    setChannel(ChannelStore.getChannel(e));
                                }
                                }
                            />
                            {!channel ? (<Forms.FormText style={{ color: "var(--red-430)", marginTop: "5px" }} className={Margins.bottom8}>Invalid Channel Id</Forms.FormText>) : (null)}

                        </Flex>
                        <Flex style={{ justifyContent: "flex-start", "flex-direction": "column", gap: "5px", marginLeft: "0px" }}>
                            <Forms.FormTitle tag="h5">User ID</Forms.FormTitle>
                            <TextInput
                                value={UserID}
                                disabled={!permissions}
                                placeholder="User ID"
                                onChange={(e: string) => {
                                    /^\d*$/.test(e) ? setUserID(e) : null;
                                    setUser(UserStore.getUser(e));
                                }}
                            />
                            {!user ? (<Forms.FormText style={{ color: "var(--red-430)", marginTop: "5px" }} className={Margins.bottom8}>Invalid User Id</Forms.FormText>) : (null)}
                        </Flex>
                        <Flex style={{ justifyContent: "flex-start", "flex-direction": "column", gap: "5px", marginLeft: "0px" }}>
                            <Forms.FormTitle tag="h5" style={{ marginTop: "10px" }}>Before Message</Forms.FormTitle>
                            <TextInput
                                value={beforeMessageID}
                                placeholder="Message ID"
                                onChange={(e: string) => /^\d*$/.test(e) ? setBeforeMessageID(e) : null}
                            />
                        </Flex>
                        <Flex style={{ justifyContent: "flex-start", "flex-direction": "column", gap: "5px", marginLeft: "0px" }}>
                            <Forms.FormTitle tag="h5" style={{ marginTop: "10px" }} >After Message</Forms.FormTitle>
                            <TextInput
                                value={afterMessageID}
                                placeholder="Message ID"
                                onChange={(e: string) => /^\d*$/.test(e) ? setAfterMessageID(e) : null}
                            />
                        </Flex>
                    </Flex>
                    <Flex style={{ justifyContent: "space-around", "flex-direction": "column" }}>
                        <Forms.FormTitle tag="h5" >key words</Forms.FormTitle>
                        <Forms.FormText className={Margins.bottom8}>Seperate key words with a new line</Forms.FormText>
                        <TextArea
                            value={Keywords}
                            onChange={(e: string) => {
                                setKeywords(e);
                                settings.store.keyWords = e;
                            }}
                            disabled={!enableKeywords}
                            rows={5}
                        />
                        <Switch
                            style={{ marginTop: "5px" }}
                            value={enableKeywords}
                            onChange={(e: boolean) => {
                                setEnableKeywords(e);
                            }}
                        >
                            Enable Key Words
                        </Switch>
                        <Forms.FormTitle tag="h5">settings</Forms.FormTitle>
                        <Switch
                            value={link}
                            onChange={(e: boolean) => {
                                setLink(e);
                            }}
                        >
                            Has : Link
                        </Switch>
                        <Switch
                            value={file}
                            onChange={(e: boolean) => {
                                setFile(e);
                            }}
                        >
                            Has : File
                        </Switch>
                        <Switch
                            value={ascending}
                            onChange={(e: boolean) => {
                                setAscending(e);
                                settings.store.ascending = e;
                            }}
                        >
                            Ascending
                        </Switch>
                    </Flex>
                </Flex>
            </ModalContent>
            <ModalFooter>
                <Button
                    color={Button.Colors.PRIMARY}
                    disabled={channel && user ? false : true}
                    onClick={() => {
                        const options = { UserID, channelID, enableKeywords, beforeMessageID, afterMessageID, ascending, link, file };
                        props.onClose();
                        openModal(props => <IndexMessageModal props={props} options={options} />);
                    }}
                >
                    Index
                </Button>
                <Button
                    color={Button.Colors.TRANSPARENT}
                    look={Button.Looks.LINK}
                    style={{ left: 15, position: "absolute" }}
                    onClick={() => { props.onClose(); }}
                >
                    Close
                </Button>
            </ModalFooter>
        </ModalRoot >
    );
};
function msToTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
};
const searchAPI = async (url) => {
    let messages;
    const { body } = await RestAPI.get({ url }).catch(async (e) => {
        if (e?.status === 429) {
            const sleepTimer = e?.body?.retry_after * 1000 ?? 3000;
            await sleep(sleepTimer);
            messageStore.value = [...messageStore.value, `${new Date().toLocaleTimeString('en-US', localeOptions)} - Searching Rate limited for ${sleepTimer / 3000} s `];
            messages = await searchAPI(url);
        }
    }) ?? {};

    return messages ?? body;
};
const constructUrl = (search = "", channelID, UserID, link, file, offset = 0, before, after) => {
    let baseUrl: string;
    if (ChannelStore.getChannel(channelID).guild_id) {
        baseUrl = `/guilds/${ChannelStore.getChannel(channelID).guild_id}/messages/search?author_id=${UserID}&channel_id=${channelID}`;
    }
    else baseUrl = `/channels/${channelID}/messages/search?author_id=${UserID}`;

    if (before) baseUrl += `&max_id=${before}`;
    if (after) baseUrl += `&min_id=${after}`;
    if (file) baseUrl += `&has=file`;
    if (link) baseUrl += `&has=link`;
    if (search != "") baseUrl += `&content=${search}`;
    if (offset != 0) baseUrl += `&offset=${offset}`;

    return baseUrl;
};

const deleteAPI = async (channel, message) => {
    let messages;
    const { body } = await RestAPI.del({ url: `/channels/${channel}/messages/${message}` }).catch(async (e) => {
        if (e?.status === 429) {
            const sleepTimer = e?.body?.retry_after * 1000 ?? 3000;
            await sleep(sleepTimer);
            messageStore.value = [...messageStore.value, `${new Date().toLocaleTimeString('en-US', localeOptions)} - Deleting Rate limited for ${sleepTimer / 3000} s `];
            messages = await deleteAPI(channel, message);
        }
    }) ?? {};
    return messages ?? body;
};

function cleanUp() {
    CompleteStore.value = false;
    deleting = false;
    aborted = false;
    messageStore.value = [];
    MessageAmountStore.value = "";
    deleteAmountStore.value = 0;
    indexAmountStore.value = 0;
}
function AutoScroll() {
    const deleteTextArea = document.getElementById("delete-text-area");
    if (deleteTextArea) deleteTextArea.scrollTop = deleteTextArea.scrollHeight;
}
const localeOptions: Intl.DateTimeFormatOptions = {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
};
const DeleteSvgIcon = () => {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path
                fill="var(--red-430)"
                d="M14.25 1c.41 0 .75.34.75.75V3h5.25c.41 0 .75.34.75.75v.5c0 .41-.34.75-.75.75H3.75A.75.75 0 0 1 3 4.25v-.5c0-.41.34-.75.75-.75H9V1.75c0-.41.34-.75.75-.75h4.5Z"
            />
            <path
                fill="var(--red-430)"
                d="M5.06 7a1 1 0 0 0-1 1.06l.76 12.13a3 3 0 0 0 3 2.81h8.36a3 3 0 0 0 3-2.81l.75-12.13a1 1 0 0 0-1-1.06H5.07ZM11 12a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Zm3-1a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"
            />
        </svg>);
};
