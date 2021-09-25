import net from 'net';
import { PromiseSocket } from 'promise-socket';
import { ConsoleLike } from './types';

const ICONA_BRIDGE_PORT = 64100;

let jsonId = 2;
let id = 1;

export interface JSONMessage {
  message: 'access' | 'get-configuration';
  'user-token'?: string;
  addressbooks?: string;
  'message-id': number;
  'message-type': 'request' | 'response';
  'response-code'?: number;
  'response-string'?: string;
}

const HEADER = [0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
let requestId = 0x2412;

export function bufferToString(bytes: Buffer) {
  return [...new Uint8Array(bytes)].map((x: number) => x.toString(16).padStart(2, '0')).join(' ');
}

export class PacketMessage {
  readonly size: number;
  readonly message?: JSONMessage;
  readonly bytes: Buffer;
  readonly requestId: number;

  private constructor(requestId: number, bytes: Buffer, message?: JSONMessage) {
    this.bytes = bytes;
    this.size = bytes?.length || 0;
    this.message = message;
    this.requestId = id;
  }

  public static fromBuffer(requestId: number, buffer: Buffer): PacketMessage {
    const bytes = (() => {
      const chars = [];
      for (let i = 0; i < buffer.length; i++) {
        chars.push(buffer.readUIntLE(i, 1));
      }
      return chars;
    })();
    const text = String.fromCharCode(...bytes);
    try {
      const message = JSON.parse(text);
      return new PacketMessage(requestId, buffer, message);
    } catch (e) {
      return new PacketMessage(requestId, buffer);
    }
  }

  public static fromJSON(message: JSONMessage): PacketMessage {
    const json = { ...message, 'message-id': jsonId++ };
    const text = [...JSON.stringify(json, null, 0)].map(c => c.charCodeAt(0));
    const buffer = Buffer.from(HEADER.concat(text));
    buffer.writeUIntLE(text.length, 2, 2); // length
    buffer.writeUIntLE(requestId, 4, 2); // requestId
    return new PacketMessage(requestId, buffer, json);
  }

  public static create(message: string): PacketMessage {
    const text = [...message].map(c => c.charCodeAt(0)).concat(0, 0, 0);
    const textBuffer = Buffer.from(text);
    textBuffer.writeUIntLE(requestId, textBuffer.length - 3, 2);
    const header = Buffer.from(HEADER);
    const magicNumber = Buffer.from([0xcd, 0xab]);
    const info = Buffer.alloc(6);
    info.writeUIntLE(id, 0, 2);
    info.writeUIntLE(textBuffer.length, 2, 4);
    const totalLength = [header, magicNumber, info, textBuffer]
      .map(b => b.length)
      .reduce((s, l) => (s += l), 0);
    const buffer = Buffer.concat([header, magicNumber, info, textBuffer], totalLength);
    buffer.writeUIntLE(buffer.length - HEADER.length, 2, 2);
    return new PacketMessage(requestId, buffer);
  }

  dump() {
    return bufferToString(this.bytes);
  }
}

function accessMessage(token: string) {
  const json = {
    message: 'access',
    'user-token': token,
    'message-type': 'request',
  } as JSONMessage;

  return PacketMessage.fromJSON(json);
}

function getConfigMessage(addressbooks: string): PacketMessage {
  const json: JSONMessage = {
    message: 'get-configuration',
    addressbooks: addressbooks,
    'message-type': 'request',
    'message-id': 0,
  };

  return PacketMessage.fromJSON(json);
}

function openDoorMessage(door: number) {
  const message = Buffer.alloc(56);
  const iconaAddr = '00000100';
  const hubName = 'COMHUB01';
  message.writeUIntLE(0x00063000, 0, 4);
  message.writeUIntLE(0xe4060000, 4, 4);
  message.writeUIntLE(0xc0181efc, 8, 4);
  message.writeUIntLE(0x1182000d, 12, 4);
  message.writeUIntLE(0x002d, 16, 2);
  message.write(iconaAddr, 18, iconaAddr.length);
  message.writeUIntLE(0x0000, 26, 2); // string terminator?
  message.writeUIntLE(0x02000000, 28, 4); // ??
  message.writeUIntLE(0xffffffff, 32, 4); // ??
  message.write(hubName, 36, hubName.length);
  message.writeIntLE(door, 44, 1);
  message.writeIntLE(0x00, 45, 1); // string terminator?
  message.write(iconaAddr, 46, iconaAddr.length);
  message.writeUIntLE(0x0000, 54, 2); // string terminator?
  return message;
}

enum STATE {
  none,
  unauthorized,
  authenticating,
  authenticated,
}

export class IconaBridgeClient {
  private readonly host: string;
  private readonly port: number;
  private readonly token: string;
  private hubName: string;
  private vipAddress: string;

  readonly logger: ConsoleLike;
  private socket: PromiseSocket<net.Socket>;
  private state: STATE = STATE.none;
  private queue: Map<number, (p?: any) => any> = new Map();

  constructor(
    token: string,
    host: string,
    port: number = ICONA_BRIDGE_PORT,
    logger: ConsoleLike = console
  ) {
    this.token = token;
    this.host = host;
    this.port = port;
    this.logger = logger;
  }

  async connect() {
    this.socket = new PromiseSocket(new net.Socket());
    this.socket.setTimeout(5000);
    this.logger.info(`Connecting to ${this.host}:${this.port}`);
    await this.socket.connect(this.port, this.host);
    this.logger.info('connected');
    await this.auth();
    this.logger.info('auth message sent');
    let packet = await this.readResponse();
    this.logger.log(packet);
    await this.auth(this.token);
    this.logger.info('json auth message sent');
    packet = await this.readResponse();
    const jsonMessage = this.decodeJSONMessage(packet);
    this.logger.info(jsonMessage);
    requestId++;
  }

  private async readResponse() {
    let buffer: Buffer = (await this.socket.read(8)) as Buffer;
    let size = buffer.readUIntLE(2, 2);
    const requestId = buffer.readUIntLE(4, 2);
    this.logger.info(`Reading next ${size} bytes`, buffer);
    buffer = (await this.socket.read(size)) as Buffer;
    const number = buffer.readUIntLE(4, 2);
    if (number === 0xabcd) {
      const respId = buffer.readUIntLE(6, 2);
      this.logger.info(`Read response with ID ${respId}`);
      size = buffer.readUIntLE(8, 4);
      buffer = (await this.socket.read(size)) as Buffer; // read more
    }
    return PacketMessage.fromBuffer(requestId, buffer);
  }

  async shutdown() {
    await this.socket.end();
  }

  decodeJSONMessage(message: PacketMessage) {
    const jsonMessage = message.message as JSONMessage;
    if (jsonMessage) {
      if (jsonMessage['message-type'] === 'response') {
        return jsonMessage;
      }
    } else {
      this.logger.warn(`No json message in packet ${message}`);
    }
    return null;
  }

  async auth(token?: string) {
    if (!token) {
      const content = PacketMessage.create('UAUT').bytes;
      const number = await this.socket.writeAll(content);
      this.logger.info(`Written ${number} bytes`, content);
    } else {
      const message = accessMessage(token);
      const number = await this.socket.writeAll(message.bytes);
      this.logger.info(`Written ${number} bytes`);
      this.logger.log(`Authorization message sent`, message);
    }
  }

  async getConfig() {
    this.logger.info(`-- Get configuration`);
    const content = PacketMessage.create('UCFG').bytes;
    const number = await this.socket.writeAll(content);
    this.logger.info(`Written ${number} bytes`, content);
    let packet = await this.readResponse();
    this.logger.info(`-- Get configuration step 1`, packet);
    const packetMessage = getConfigMessage('none');
    this.logger.info(packetMessage.message);
    await this.socket.writeAll(packetMessage.bytes);
    packet = await this.readResponse();
    const jsonMessage = this.decodeJSONMessage(packet);
    this.logger.info(jsonMessage);
    requestId++;
  }

  async openDoor(door: number): Promise<void> {
    const packet = openDoorMessage(door);
    await this.socket.writeAll(packet);
  }
}
