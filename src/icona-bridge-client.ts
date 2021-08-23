import net from 'net';
import { PromiseSocket } from 'promise-socket';
import { ConsoleLike } from './types';

const ICONA_BRIDGE_PORT = 64100;

let jsonId = 1;
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

export class PacketMessage {
  readonly size: number;
  readonly message?: JSONMessage;
  readonly stringMessage?: string;
  readonly bytes: Buffer;

  private constructor(bytes?: Buffer, message?: JSONMessage | string) {
    this.size = bytes.length;
    this.message =
      message !== null && typeof message === 'object' ? (message as JSONMessage) : null;
    this.stringMessage =
      message !== null && typeof message === 'string' ? (message as string) : null;
    this.bytes = bytes;
  }

  public static fromBuffer(buffer: Buffer): PacketMessage {
    const size = buffer.readUIntLE(2, 2);
    const bytes = (() => {
      const chars = [];
      for (let i = 8; i < size + 8; i++) {
        chars.push(buffer.readUIntLE(i, 1));
      }
      return chars;
    })();
    const text = String.fromCharCode(...bytes);
    try {
      const message = JSON.parse(text);
      return new PacketMessage(buffer, message);
    } catch (e) {
      return new PacketMessage(buffer, text);
    }
  }

  public static fromJSON(message: JSONMessage): PacketMessage {
    const json = { ...message, 'message-id': jsonId++ };
    const text = [...JSON.stringify(json)].map((c) => c.charCodeAt(0));
    const buffer = Buffer.from(HEADER.concat(text));
    buffer.writeUIntLE(text.length, 2, 2); // length
    buffer.writeUIntLE(id++, 4, 2); // id
    return new PacketMessage(buffer, json);
  }

  public static fromString(message: string): PacketMessage {
    const text = [...message].map((c) => c.charCodeAt(0));
    const buffer = Buffer.from(HEADER.concat(text));
    buffer.writeUIntLE(text.length, 2, 2); // length
    buffer.writeUIntLE(id++, 4, 2); // id
    return new PacketMessage(buffer, message);
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
  const json = {
    message: 'get-configuration',
    addressbooks,
    'message-type': 'request',
  } as JSONMessage;

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
    this.socket.setTimeout(1000);
    this.logger.info(`Connecting to ${this.host}:${this.port}`);
    await this.socket.connect(this.port, this.host);
    this.logger.info('connected');
    await this.auth();
    this.logger.info('auth message sent');
    let buffer: Buffer = (await this.socket.readAll()) as Buffer;
    let packet = PacketMessage.fromBuffer(buffer);
    this.logger.log(packet);
    await this.auth(this.token);
    this.logger.info('json auth message sent');
    buffer = (await this.socket.readAll()) as Buffer;
    packet = PacketMessage.fromBuffer(buffer);
    const jsonMessage = this.decodeJSONMessage(packet);
    this.logger.info(jsonMessage);
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
      // prettier-ignore
      const bytes = [ /* Packet 248 */
        0x00, 0x06, 0x0f, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0xcd, 0xab, 0x01, 0x00,
        0x07, 0x00, 0x00, 0x00,
        0x55, 0x41, 0x55, 0x54,
        0xe8, 0x06, 0x00];
      const number = await this.socket.writeAll(Buffer.from(bytes));
      this.logger.info(`Written ${number} bytes`);
    } else {
      const message = accessMessage(token);
      const number = await this.socket.writeAll(message.bytes);
      this.logger.info(`Written ${number} bytes`);
      this.logger.log(`Authorization message sent`, message);
    }
  }

  async getConfig() {
    const packetMessage = getConfigMessage('none');
    await this.socket.writeAll(packetMessage.bytes);
  }

  async openDoor(door: number): Promise<void> {
    const packet = openDoorMessage(door);
    await this.socket.writeAll(packet);
  }
}
