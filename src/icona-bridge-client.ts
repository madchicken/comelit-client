import net from 'net';
import { PromiseSocket } from 'promise-socket';
import { ConsoleLike } from './types';

const ICONA_BRIDGE_PORT = 64100;

let jsonId = 2;
let id = 1;

export interface JSONMessage {
  message: 'access' | 'get-configuration' | 'server-info';
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

const resp = {
  message: 'get-configuration',
  'message-type': 'response',
  'message-id': 3,
  'response-code': 200,
  'response-string': 'OK',
  'viper-server': {
    'local-address': '192.168.0.66',
    'local-tcp-port': 64100,
    'local-udp-port': 64100,
    'remote-address': '',
    'remote-tcp-port': 64100,
    'remote-udp-port': 64100,
  },
  'viper-client': { description: 'SU0EG' },
  'viper-p2p': {
    mqtt: {
      role: 'a',
      base: 'HSrv/0025291701EC/vip/COMHUB01/sdp',
      server: 'tls://hub-vip3.cloud.comelitgroup.com:443',
      auth: { method: ['CCS_TOKEN', 'CCS_DEVICE'] },
    },
    http: { role: 'a', duuid: '88b8cbf3-cb88-4af3-a907-18bf6655d12f-00001' },
    stun: {
      server: ['turn-1-de.cloud.comelitgroup.com:3478', 'turn-1-de.cloud.comelitgroup.com:3478'],
    },
  },
  vip: {
    enabled: true,
    'apt-address': 'COMHUB01',
    'apt-subaddress': 2,
    'logical-subaddress': 2,
    'apt-config': {
      description: '',
      'call-divert-busy-en': false,
      'call-divert-address': '',
      'virtual-key-enabled': false,
    },
    'user-parameters': {
      forced: true,
      'apt-address-book': [],
      'switchboard-address-book': [],
      'camera-address-book': [],
      'rtsp-camera-address-book': [],
      'entrance-address-book': [],
      'actuator-address-book': [],
      'opendoor-address-book': [
        { name: 'CANCELLO', 'apt-address': '00000100', 'output-index': 2, 'secure-mode': false },
      ],
      'opendoor-actions': [{ action: 'peer', 'apt-address': '', 'output-index': 1 }],
    },
  },
  'building-config': { description: 'your building' },
};

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

function getInfoMessage(): PacketMessage {
  const json: JSONMessage = {
    message: 'server-info',
    'message-type': 'request',
    'message-id': 0,
  };

  return PacketMessage.fromJSON(json);
}

function openDoorMessage(door: number) {
  // prettier-ignore
  const bytes = [
      0x00, 0x06, 0x20, 0x00, 0x14, 0x24, 0x00, 0x00,
      0x00, 0x18, 0x6c, 0x35, 0xac, 0x93, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x30, 0x30,
      0x30, 0x30, 0x30, 0x31, 0x30, 0x30, 0x00, 0x00,
  ]
  return Buffer.from(bytes);
  // const message = Buffer.alloc(56);
  // const iconaAddr = '00000100';
  // const hubName = 'COMHUB01';
  // message.writeUIntLE(0x00063000, 0, 4);
  // message.writeUIntLE(0xe4060000, 4, 4);
  // message.writeUIntLE(0xc0181efc, 8, 4);
  // message.writeUIntLE(0x1182000d, 12, 4);
  // message.writeUIntLE(0x002d, 16, 2);
  // message.write(iconaAddr, 18, iconaAddr.length);
  // message.writeUIntLE(0x0000, 26, 2); // string terminator?
  // message.writeUIntLE(0x02000000, 28, 4); // ??
  // message.writeUIntLE(0xffffffff, 32, 4); // ??
  // message.write(hubName, 36, hubName.length);
  // message.writeIntLE(door, 44, 1);
  // message.writeIntLE(0x00, 45, 1); // string terminator?
  // message.write(iconaAddr, 46, iconaAddr.length);
  // message.writeUIntLE(0x0000, 54, 2); // string terminator?
  // return message;
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
    let packetMessage = getConfigMessage('none');
    this.logger.info(packetMessage.message);
    await this.socket.writeAll(packetMessage.bytes);
    packet = await this.readResponse();
    let jsonMessage = this.decodeJSONMessage(packet);
    this.logger.info(JSON.stringify(jsonMessage, null, 2));

    await this.socket.writeAll(PacketMessage.create('UCFG').bytes);
    packet = await this.readResponse();
    this.logger.info(`-- Get configuration step 2`, packet);

    packetMessage = getConfigMessage('all');
    this.logger.info(packetMessage.message);
    await this.socket.writeAll(packetMessage.bytes);
    packet = await this.readResponse();
    jsonMessage = this.decodeJSONMessage(packet);
    this.logger.info(JSON.stringify(jsonMessage, null, 2));

    requestId++;

    await this.socket.writeAll(PacketMessage.create('INFO').bytes);
    packet = await this.readResponse();
    this.logger.info(`-- Get configuration step 3`, packet);

    packetMessage = getInfoMessage();
    this.logger.info(packetMessage.message);
    await this.socket.writeAll(packetMessage.bytes);
    packet = await this.readResponse();
    jsonMessage = this.decodeJSONMessage(packet);
    this.logger.info(JSON.stringify(jsonMessage, null, 2));
  }

  async openDoor(door: number): Promise<void> {
    requestId++;
    // prettier-ignore
    const bytes = [ /* Packet 1336 */
      0x00, 0x06, 0x30, 0x00, 0x14, 0x24, 0x00, 0x00,
      0xc0, 0x18, 0x3a, 0xa1, 0xc0, 0x56, 0x00, 0x0d,
      0x00, 0x2d, 0x30, 0x30, 0x30, 0x30, 0x30, 0x31,
      0x30, 0x30, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x30, 0x30,
      0x30, 0x30, 0x30, 0x31, 0x30, 0x30, 0x00, 0x00 ];

    // prettier-ignore
    const bytes2 = [
        0x00, 0x06, 0x20, 0x00, 0x14, 0x24, 0x00, 0x00,
        0x00, 0x18, 0x3a, 0xa1, 0xc1, 0x57, 0x00, 0x00,
        0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
        0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x30, 0x30,
        0x30, 0x30, 0x30, 0x31, 0x30, 0x30, 0x00, 0x00 ];

    // prettier-ignore
    const bytes3 = [
      0x00, 0x06, 0x20, 0x00, 0x14, 0x24, 0x00, 0x00,
      0x20, 0x18, 0x3a, 0xa1, 0xc1, 0x57, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x30, 0x30,
      0x30, 0x30, 0x30, 0x31, 0x30, 0x30, 0x00, 0x00
    ]

    this.logger.info(`-- Open door start`);
    const packet = Buffer.from(bytes);
    await this.socket.writeAll(packet);
    const resp1 = await this.readResponse();
    this.logger.info(`-- Open door step 1`, resp1);
    const resp2 = await this.readResponse();
    this.logger.info(`-- Open door step 2`, resp2);
    const packet2 = Buffer.from(bytes2);
    await this.socket.writeAll(packet2);
    const packet3 = Buffer.from(bytes3);
    await this.socket.writeAll(packet3);
    this.logger.info(`-- Open door done`, resp);
  }
}
