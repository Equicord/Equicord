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

import { Heading } from "@components/Heading";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, React, TextInput } from "@webpack/common";

import { buildEmbed, decrypt } from "../index";

export function DecModal(props: RenderModalProps & { message: any; }) {
    const encryptedMessage: string = props?.message?.content;
    const [password, setPassword] = React.useState("password");

    const onDecrypt = () => {
        const toSend = decrypt(encryptedMessage, password, true);
        if (!toSend || !props?.message) return;
        buildEmbed(props?.message, toSend);
        props.onClose();
    };

    return (
        <Modal
            {...props}
            size="sm"
            title="Decrypt Message"
            actions={[
                {
                    text: "Decrypt",
                    variant: "primary",
                    onClick: onDecrypt
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: props.onClose
                }
            ]}
        >
            <Heading style={{ marginTop: "10px" }}>Message with Encryption</Heading>
            <TextInput defaultValue={encryptedMessage} disabled={true}></TextInput>
            <Heading style={{ marginTop: "10px" }}>Password</Heading>
            <TextInput
                style={{ marginBottom: "20px" }}
                onChange={setPassword}
            />
        </Modal>
    );
}

export function buildDecModal(msg: any): any {
    openModal((props: any) => <DecModal {...props} {...msg} />);
}
