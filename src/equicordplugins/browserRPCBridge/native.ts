/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "crypto";
import { createServer, IncomingMessage, Server } from "http";
import { Socket } from "net";

let server: Server | null = null;

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const OPCODE_TEXT = 0x1;
const OPCODE_CLOSE = 0x8;

function generateAcceptValue(acceptKey: string) {
    return createHash("sha1")
        .update(acceptKey + WS_GUID)
        .digest("base64");
}

function parseFrame(buffer: Buffer) {
    let offset = 0;
    const firstByte = buffer.readUInt8(offset++);
    const opcode = firstByte & 0x0f;

    const secondByte = buffer.readUInt8(offset++);
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;

    if (payloadLength === 126) {
        payloadLength = buffer.readUInt16BE(offset);
        offset += 2;
    } else if (payloadLength === 127) {
        offset += 4;
        payloadLength = buffer.readUInt32BE(offset);
        offset += 4;
    }

    let maskingKey: Buffer | null = null;
    if (isMasked) {
        maskingKey = buffer.slice(offset, offset + 4);
        offset += 4;
    }

    const payload = buffer.slice(offset, offset + payloadLength);

    if (isMasked && maskingKey) {
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskingKey[i % 4];
        }
    }

    return { opcode, payload };
}

function createFrame(data: string) {
    const payload = Buffer.from(data);
    const { length } = payload;
    let frame: Buffer;

    if (length <= 125) {
        frame = Buffer.alloc(2 + length);
        frame[1] = length;
    } else if (length <= 65535) {
        frame = Buffer.alloc(4 + length);
        frame[1] = 126;
        frame.writeUInt16BE(length, 2);
    } else {
        frame = Buffer.alloc(10 + length);
        frame[1] = 127;
        frame.writeBigUInt64BE(BigInt(length), 2);
    }

    frame[0] = 0x81;
    payload.copy(frame, frame.length - length);
    return frame;
}

export function startServer(event: Electron.IpcMainInvokeEvent, port: number = 6969) {
    if (server) {
        console.log("[BrowserRPCBridge] Server already running");
        return;
    }

    server = createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Discord RPC Bridge Running");
    });

    server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
        const acceptKey = req.headers["sec-websocket-key"];
        if (!acceptKey) {
            socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
            socket.destroy();
            return;
        }

        const acceptValue = generateAcceptValue(acceptKey as string);
        socket.write([
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Accept: ${acceptValue}`
        ].join("\r\n") + "\r\n\r\n");

        // Notify renderer of connection
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.executeJavaScript("Vencord.Plugins.plugins.BrowserRPCBridge?.handleConnection()").catch(() => { });
        }

        // Send version handshake
        socket.write(createFrame(JSON.stringify({ version: "0.3.0-equicord" })));

        socket.on("data", buffer => {
            try {
                const { opcode, payload } = parseFrame(buffer);

                if (opcode === OPCODE_CLOSE) {
                    socket.end();
                    return;
                }

                if (opcode === OPCODE_TEXT) {
                    let data;
                    try {
                        data = JSON.parse(payload.toString());
                    } catch {
                        return;
                    }

                    if (event.sender && !event.sender.isDestroyed()) {
                        event.sender.executeJavaScript(
                            `Vencord.Plugins.plugins.BrowserRPCBridge?.handleUpdate(${JSON.stringify(data)})`
                        ).catch(() => { });
                    }
                }
            } catch (e) {
                console.error("[BrowserRPCBridge] Frame error:", e);
            }
        });

        socket.on("error", () => { });
    });

    server.listen(port);
    server.on("error", err => {
        console.error(`[BrowserRPCBridge] Server error on port ${port}:`, err);
    });
}

export function stopServer() {
    if (server) {
        server.close();
        server = null;
    }
}
