/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        }
        table[n] = c >>> 0
    }
    return table
})()

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff
    for (let i = 0; i < data.length; i++) {
        crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
    const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f)
    const dosDate = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f)
    return { time, dosDate }
}

interface ZipEntry {
    name: string
    data: Uint8Array
    crc: number
    time: number
    dosDate: number
    offset: number
}

export class ZipWriter {
    private entries: ZipEntry[] = []
    private chunks: Uint8Array[] = []
    private offset = 0

    private push(chunk: Uint8Array) {
        this.chunks.push(chunk)
        this.offset += chunk.length
    }

    addFile(path: string, data: Uint8Array) {
        const name = path.replace(/^\/+/, "")
        const nameBytes = new TextEncoder().encode(name)
        const crc = crc32(data)
        const { time, dosDate } = dosDateTime()

        const header = new DataView(new ArrayBuffer(30))
        header.setUint32(0, 0x04034b50, true)
        header.setUint16(4, 20, true)
        header.setUint16(6, 0, true)
        header.setUint16(8, 0, true)
        header.setUint16(10, time, true)
        header.setUint16(12, dosDate, true)
        header.setUint32(14, crc, true)
        header.setUint32(18, data.length, true)
        header.setUint32(22, data.length, true)
        header.setUint16(26, nameBytes.length, true)
        header.setUint16(28, 0, true)

        const entryOffset = this.offset
        this.push(new Uint8Array(header.buffer))
        this.push(nameBytes)
        this.push(data)

        this.entries.push({ name, data, crc, time, dosDate, offset: entryOffset })
    }

    addTextFile(path: string, content: string) {
        this.addFile(path, new TextEncoder().encode(content))
    }

    addJsonFile(path: string, obj: unknown) {
        this.addTextFile(path, JSON.stringify(obj, null, 2))
    }

    generate(): Blob {
        const centralDirStart = this.offset

        for (const entry of this.entries) {
            const nameBytes = new TextEncoder().encode(entry.name)
            const header = new DataView(new ArrayBuffer(46))
            header.setUint32(0, 0x02014b50, true)
            header.setUint16(4, 20, true)
            header.setUint16(6, 20, true)
            header.setUint16(8, 0, true)
            header.setUint16(10, 0, true)
            header.setUint16(12, entry.time, true)
            header.setUint16(14, entry.dosDate, true)
            header.setUint32(16, entry.crc, true)
            header.setUint32(20, entry.data.length, true)
            header.setUint32(24, entry.data.length, true)
            header.setUint16(28, nameBytes.length, true)
            header.setUint16(30, 0, true)
            header.setUint16(32, 0, true)
            header.setUint16(34, 0, true)
            header.setUint16(36, 0, true)
            header.setUint32(38, 0, true)
            header.setUint32(42, entry.offset, true)

            this.push(new Uint8Array(header.buffer))
            this.push(nameBytes)
        }

        const centralDirSize = this.offset - centralDirStart

        const end = new DataView(new ArrayBuffer(22))
        end.setUint32(0, 0x06054b50, true)
        end.setUint16(4, 0, true)
        end.setUint16(6, 0, true)
        end.setUint16(8, this.entries.length, true)
        end.setUint16(10, this.entries.length, true)
        end.setUint32(12, centralDirSize, true)
        end.setUint32(16, centralDirStart, true)
        end.setUint16(20, 0, true)
        this.push(new Uint8Array(end.buffer))

        return new Blob(this.chunks, { type: "application/zip" })
    }
}

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
