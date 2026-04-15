/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger.js";
import type { Except, Merge, SetOptional } from "type-fest";

import { EventEmitter } from "./eventEmitter";
import type { IncomingMessage, IncomingMessageTypes, OBSEventTypes, OBSRequestTypes, OBSResponseTypes, OutgoingMessage, OutgoingMessageTypes, RequestBatchOptions, RequestBatchRequest, RequestMessage, ResponseBatchMessage, ResponseMessage } from "./types.js";
import { WebSocketOpCode } from "./types.js";
import authenticationHashing from "./utils/authenticationHashing.js";

const logger = new Logger("OBS Remote Control");

export class OBSWebSocketError extends Error {
	constructor(public code: number, message: string) {
		super(message);
	}
}

export type EventTypes = Merge<{
	ConnectionOpened: void;
	ConnectionClosed: OBSWebSocketError;
	ConnectionError: OBSWebSocketError;
	Hello: IncomingMessageTypes[WebSocketOpCode.Hello];
	Identified: IncomingMessageTypes[WebSocketOpCode.Identified];
}, OBSEventTypes>;

// EventEmitter expects {type: [value]} syntax while for us {type: value} is neater
type MapValueToArgsArray<T extends Record<string, unknown>> = {
	// eslint-disable-next-line @typescript-eslint/ban-types
	[K in keyof T]: T[K] extends void ? [] : [T[K]];
};

type IdentificationInput = SetOptional<Except<OutgoingMessageTypes[WebSocketOpCode.Identify], "authentication">, "rpcVersion">;
type HelloIdentifiedMerged = Merge<
	Exclude<IncomingMessageTypes[WebSocketOpCode.Hello], "authenticate">,
	IncomingMessageTypes[WebSocketOpCode.Identified]
>;

export abstract class BaseOBSWebSocket extends EventEmitter<MapValueToArgsArray<EventTypes>> {
	protected static requestCounter = 1;

	protected static generateMessageId(): string {
		return String(BaseOBSWebSocket.requestCounter++);
	}

	protected _identified = false;
	protected internalListeners = new EventEmitter();
	protected socket?: WebSocket;
	protected abstract protocol: string;

	public get identified() {
		return this._identified;
	}

	/**
	 * Connect to an obs-websocket server
	 * @param url Websocket server to connect to (including ws:// or wss:// protocol)
	 * @param password Password
	 * @param identificationParams Data for Identify event
	 * @returns Hello & Identified messages data (combined)
	 */
	async connect(
		url = "ws://127.0.0.1:4455",
		password?: string,
		identificationParams: IdentificationInput = {},
	): Promise<HelloIdentifiedMerged> {
		if (this.socket) {
			await this.disconnect();
		}

		try {
			const connectionClosedPromise = this.internalEventPromise<EventTypes["ConnectionClosed"]>("ConnectionClosed");
			const connectionErrorPromise = this.internalEventPromise<EventTypes["ConnectionError"]>("ConnectionError");

			return await Promise.race([
				(async () => {
					const hello = await this.createConnection(url);
					this.emit("Hello", hello);
					return this.identify(hello, password, identificationParams);
				})(),
				// Choose the best promise for connection error/close
				// In browser connection close has close code + reason,
				// while in node error event has these
				new Promise<never>((resolve, reject) => {
					void connectionErrorPromise.then(e => {
						if (e.message) {
							reject(e);
						}
					});
					void connectionClosedPromise.then(e => {
						reject(e);
					});
				}),
			]);
		} catch (error: unknown) {
			await this.disconnect();
			throw error;
		}
	}

	/**
	 * Disconnect from obs-websocket server
	 */
	async disconnect() {
		if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
			return;
		}

		const connectionClosedPromise = this.internalEventPromise("ConnectionClosed");
		this.socket.close();
		await connectionClosedPromise;
	}

	/**
	 * Update session parameters
	 * @param data Reidentify data
	 * @returns Identified message data
	 */
	async reidentify(data: OutgoingMessageTypes[WebSocketOpCode.Reidentify]) {
		const identifiedPromise = this.internalEventPromise<IncomingMessageTypes[WebSocketOpCode.Identified]>(`op:${WebSocketOpCode.Identified}`);
		await this.message(WebSocketOpCode.Reidentify, data);
		return identifiedPromise;
	}

	/**
	 * Send a request to obs-websocket
	 * @param requestType Request name
	 * @param requestData Request data
	 * @returns Request response
	 */
	async call<Type extends keyof OBSRequestTypes>(requestType: Type, requestData?: OBSRequestTypes[Type]): Promise<OBSResponseTypes[Type]> {
		const requestId = BaseOBSWebSocket.generateMessageId();
		const responsePromise = this.internalEventPromise<ResponseMessage<Type>>(`res:${requestId}`);
		await this.message(WebSocketOpCode.Request, {
			requestId,
			requestType,
			requestData,
		} as RequestMessage<Type>);
		const { requestStatus, responseData } = await responsePromise;

		if (!requestStatus.result) {
			throw new OBSWebSocketError(requestStatus.code, requestStatus.comment);
		}

		return responseData as OBSResponseTypes[Type];
	}

	/**
	 * Send a batch request to obs-websocket
	 * @param requests Array of Request objects (type and data)
	 * @param options A set of options for how the batch will be executed
	 * @param options.executionType The mode of execution obs-websocket will run the batch in
	 * @param options.haltOnFailure Whether obs-websocket should stop executing the batch if one request fails
	 * @returns RequestBatch response
	 */
	async callBatch(requests: RequestBatchRequest[], options: RequestBatchOptions = {}): Promise<ResponseMessage[]> {
		const requestId = BaseOBSWebSocket.generateMessageId();
		const responsePromise = this.internalEventPromise<ResponseBatchMessage>(`res:${requestId}`);

		await this.message(WebSocketOpCode.RequestBatch, {
			requestId,
			requests,
			...options,
		});

		const { results } = await responsePromise;
		return results;
	}

	/**
	 * Cleanup from socket disconnection
	 */
	protected cleanup() {
		if (!this.socket) {
			return;
		}

		this.socket.onopen = null;
		this.socket.onmessage = null;
		this.socket.onerror = null;
		this.socket.onclose = null;
		this.socket = undefined;
		this._identified = false;

		// Cleanup leftovers
		this.internalListeners.clear();
	}

	/**
	 * Create connection to specified obs-websocket server
	 *
	 * @private
	 * @param url Websocket address
	 * @returns Promise for hello data
	 */
	protected async createConnection(url: string) {
		const connectionOpenedPromise = this.internalEventPromise("ConnectionOpened");
		const helloPromise = this.internalEventPromise<IncomingMessageTypes[WebSocketOpCode.Hello]>(`op:${WebSocketOpCode.Hello}`);

		this.socket = new WebSocket(url, this.protocol);
		this.socket.onopen = this.onOpen.bind(this);
		this.socket.onmessage = this.onMessage.bind(this);
		this.socket.onerror = this.onError.bind(this) as (e: Event) => void;
		this.socket.onclose = this.onClose.bind(this);

		await connectionOpenedPromise;
		const protocol = this.socket?.protocol;
		// Browsers don't autoclose on missing/wrong protocol
		if (!protocol) {
			throw new OBSWebSocketError(-1, "Server sent no subprotocol");
		}

		if (protocol !== this.protocol) {
			throw new OBSWebSocketError(-1, "Server sent an invalid subprotocol");
		}

		return helloPromise;
	}

	/**
	 * Send identify message
	 *
	 * @private
	 * @param hello Hello message data
	 * @param password Password
	 * @param identificationParams Identification params
	 * @returns Hello & Identified messages data (combined)
	 */
	protected async identify(
		{
			authentication,
			rpcVersion,
			...helloRest
		}: IncomingMessageTypes[WebSocketOpCode.Hello],
		password?: string,
		identificationParams: IdentificationInput = {},
	): Promise<HelloIdentifiedMerged> {
		// Set rpcVersion if unset
		const data: OutgoingMessageTypes[WebSocketOpCode.Identify] = {
			rpcVersion,
			...identificationParams,
		};

		if (authentication && password) {
			data.authentication = await authenticationHashing(authentication.salt, authentication.challenge, password);
		}

		const identifiedPromise = this.internalEventPromise<IncomingMessageTypes[WebSocketOpCode.Identified]>(`op:${WebSocketOpCode.Identified}`);
		await this.message(WebSocketOpCode.Identify, data);
		const identified = await identifiedPromise;
		this._identified = true;
		this.emit("Identified", identified);

		return {
			rpcVersion,
			...helloRest,
			...identified,
		};
	}

	/**
	 * Send message to obs-websocket
	 *
	 * @private
	 * @param op WebSocketOpCode
	 * @param d Message data
	 */
	protected async message<Type extends keyof OutgoingMessageTypes>(op: Type, d: OutgoingMessageTypes[Type]) {
		if (!this.socket) {
			throw new Error("Not connected");
		}

		if (!this.identified && op !== 1) {
			throw new Error("Socket not identified");
		}

		const encoded = await this.encodeMessage({
			op,
			d,
		} as OutgoingMessage);
		this.socket.send(encoded);
	}

	/**
	 * Create a promise to listen for an event on internal listener
	 * (will be cleaned up on disconnect)
	 *
	 * @private
	 * @param event Event to listen to
	 * @returns Event data
	 */
	protected async internalEventPromise<ReturnVal = unknown>(event: string): Promise<ReturnVal> {
		return new Promise(resolve => {
			this.internalListeners.once(event, resolve);
		});
	}

	/**
	 * Websocket open event listener
	 *
	 * @private
	 * @param e Event
	 */
	protected onOpen(e: Event) {
		this.emit("ConnectionOpened");
		this.internalListeners.emit("ConnectionOpened", e);
	}

	/**
	 * Websocket message event listener
	 *
	 * @private
	 * @param e Event
	 */
	protected async onMessage(e: MessageEvent<string | Blob | ArrayBuffer>) {
		try {
			const { op, d } = await this.decodeMessage(e.data);

			if (op === undefined || d === undefined) {
				return;
			}

			switch (op) {
				case WebSocketOpCode.Event: {
					const { eventType, eventData } = d;
					// @ts-expect-error Typescript just doesn't understand it
					this.emit(eventType, eventData);
					return;
				}

				case WebSocketOpCode.RequestResponse:
				case WebSocketOpCode.RequestBatchResponse: {
					const { requestId } = d;
					this.internalListeners.emit(`res:${requestId}`, d);
					return;
				}

				default:
					this.internalListeners.emit(`op:${op}`, d);
			}
		} catch (error: unknown) {
			logger.error("error handling message: %o", error);
		}
	}

	/**
	 * Websocket error event listener
	 *
	 * @private
	 * @param e ErrorEvent
	 */
	protected onError(e: ErrorEvent) {
		logger.error("socket.error: %o", e);
		const error = new OBSWebSocketError(-1, e.message);

		this.emit("ConnectionError", error);
		this.internalListeners.emit("ConnectionError", error);
	}

	/**
	 * Websocket close event listener
	 *
	 * @private
	 * @param e Event
	 */
	protected onClose(e: CloseEvent) {
		const error = new OBSWebSocketError(e.code, e.reason);

		this.emit("ConnectionClosed", error);
		this.internalListeners.emit("ConnectionClosed", error);
		this.cleanup();
	}

	/**
	 * Encode a message for specified protocol
	 * @param data Outgoing message
	 * @returns Outgoing message to send via websocket
	 */
	protected abstract encodeMessage(data: OutgoingMessage): Promise<string | Blob | ArrayBufferView>;

	/**
	 * Decode a message for specified protocol
	 * @param data Incoming message from websocket
	 * @returns Parsed incoming message
	 */
	protected abstract decodeMessage(data: string | ArrayBuffer | Blob): Promise<IncomingMessage>;
}
