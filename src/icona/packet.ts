import {BaseMessage} from "./types";
import {NULL, stringToBuffer} from "../utils";

export function bufferToString(bytes: Buffer) {
    return [...new Uint8Array(bytes)].map((x: number) => x.toString(16).padStart(2, '0')).join(' ');
}

export function bufferToASCIIString(bytes: Buffer) {
    return bytes.toString('utf-8');
}

export function getInt64Bytes( x ): number[] {
    const bytes = [];
    let i = 8;
    do {
        bytes[--i] = x & (255);
        x = x>>8;
    } while ( i )
    return bytes;
}

const HEADER = [0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
export const NO_SEQ = -1;
export enum MessageType {
    COMMAND = 0xabcd,
    END = 0x01ef,
    OPEN_DOOR_INIT = 0x18c0,
    OPEN_DOOR = 0x1800,
    OPEN_DOOR_CONFIRM = 0x1820,
}

export enum Channel {
    UAUT = 'UAUT',
    UCFG = 'UCFG',
    INFO = 'INFO',
    CTPP = 'CTPP',
    CSPB = 'CSPB',
    PUSH = 'PUSH',
}

export interface OpenChannelData {
    channel: Channel;
    id: number;
    sequence: number;
}

export interface ByteMessage {
    type: MessageType,
    seq: number;
    messages: string[],
}

export class PacketMessage {
    readonly size: number;
    readonly bytes: Buffer;
    readonly requestId: number;
    readonly seq: number;
    readonly type: 'binary' | 'json';

    constructor(requestId: number, seq: number, bytes: Buffer) {
        this.bytes = bytes;
        this.size = bytes?.length || 0;
        this.requestId = requestId;
        this.seq = seq;
        if (seq > 0) {
            this.type = 'binary';
        } else {
            this.type = 'json';
        }
    }

    dump(ascii: boolean = false) {
        if (ascii) {
            return bufferToASCIIString(this.bytes);
        }
        return bufferToString(this.bytes);
    }

    public static createBinaryPacketFromBuffers(requestId: number, ...messages: Buffer[]): PacketMessage {
        const header = Buffer.from(HEADER);
        header.writeUIntLE(requestId, 4, 2);
        const totalLength = [header, ...messages]
            .map(b => b.length)
            .reduce((s, l) => (s += l), 0);
        const buffer = Buffer.concat([header, ...messages], totalLength);
        buffer.writeUIntLE(buffer.length - HEADER.length, 2, 2);
        return new PacketMessage(requestId, NO_SEQ, buffer);
    }

    public static createBinaryPacketFromStrings(requestId: number, seq: number, type: MessageType, ...messages: string[]): PacketMessage {
        const header = Buffer.from(HEADER);
        const magicNumber = Buffer.alloc(4);
        magicNumber.writeUIntLE(type, 0,2);
        magicNumber.writeUIntLE(seq, 2,2);
        const additionalMessages: Buffer[] = [];
        additionalMessages.push(
            ...messages.filter(s => s !== null && s !== undefined).map((s, i) => {
                const isFirst = i === 0;
                const info = Buffer.alloc(4);
                let text = stringToBuffer(s);
                if (isFirst) {
                    const id = Buffer.alloc(4);
                    id.writeUIntLE(requestId, 0, 4);
                    text = Buffer.concat([text, id]);
                    info.writeUIntLE(s.length + id.length + 1, 0, 4);
                } else {
                    info.writeUIntLE(s.length + 1, 0, 4);
                }
                return Buffer.concat([info, text, NULL]);
            })
        );

        const totalLength = [header, magicNumber, ...additionalMessages]
            .map(b => b.length)
            .reduce((s, l) => (s += l), 0);

        const buffer = Buffer.concat([header, magicNumber, ...additionalMessages], totalLength);
        buffer.writeUIntLE(buffer.length - HEADER.length, 2, 2);
        return new PacketMessage(requestId, seq, buffer);
    }

    public static createJSONPacket<T extends BaseMessage>(requestId: number, json: T): PacketMessage {
        const text = [...JSON.stringify(json, null, 0)].map(c => c.charCodeAt(0));
        const buffer = Buffer.from(HEADER.concat(text));
        buffer.writeUIntLE(text.length, 2, 2); // length
        buffer.writeUIntLE(requestId, 4, 2); // requestId
        return new PacketMessage(requestId, NO_SEQ, buffer);
    }
}

export class PacketBuilder {
    private bytes: Buffer;
    readonly requestId: number;
    readonly seq: number;

    constructor(requestId: number, type: MessageType, seq?: number) {
        this.requestId = requestId;
        this.seq = seq || NO_SEQ;
        const magicNumber = Buffer.alloc(4);
        magicNumber.writeUIntLE(type, 0,2);
        if (seq) {
            magicNumber.writeUIntLE(seq, 2, 2);
        }
        let header = Buffer.from(HEADER);
        this.bytes = Buffer.concat([header, magicNumber], header.length + magicNumber.length);
    }

    build(): PacketMessage {
        return new PacketMessage(this.requestId, this.seq, this.bytes);
    }
}

function readString(buffer: Buffer) {
    const bytes = (() => {
        const chars = [];
        for (let i = 0; i < buffer.length; i++) {
            chars.push(buffer.readUIntLE(i, 1));
        }
        return chars;
    })();
    const text = String.fromCharCode(...bytes);
    return text;
}

export  function readJSON<T extends BaseMessage>(buffer: Buffer): T {
    const text = readString(buffer);
    return JSON.parse(text) as T;
}

export enum BinaryResponseType {
    BINARY, JSON
}

export interface DecodedResponse<T extends BaseMessage> {
    requestId: number;
    sequence: number;
    type: BinaryResponseType;
    json?: T;
}