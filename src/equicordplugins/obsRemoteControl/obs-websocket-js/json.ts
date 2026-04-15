/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseOBSWebSocket } from "./base.js";
export type { EventTypes } from "./base.js";
export { OBSWebSocketError } from "./base.js";
import { type IncomingMessage, type OutgoingMessage } from "./types.js";
export * from "./types.js";

export class OBSWebSocket extends BaseOBSWebSocket {
	protocol = "obswebsocket.json";

	protected async encodeMessage(data: OutgoingMessage): Promise<string> {
		return JSON.stringify(data);
	}

	protected async decodeMessage(data: string): Promise<IncomingMessage> {
		return JSON.parse(data) as IncomingMessage;
	}
}

export default OBSWebSocket;
