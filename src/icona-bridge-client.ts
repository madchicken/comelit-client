import net from 'net';
import { ConsoleLike } from './types';
import PromiseSocket from 'promise-socket';

const ICONA_BRIDGE_PORT = 64100;

let jsonId = 2;
let id = 1;

export interface JSONMessage {
  message: 'access' | 'get-configuration' | 'server-info' | 'push-info';
  'user-token'?: string;
  addressbooks?: string;
  'message-id': number;
  'message-type': 'request' | 'response';
  'response-code'?: number;
  'response-string'?: string;
  'apt-address'?: string;
  'apt-subaddress'?: number;
  'bundle-id'?: string;
  'os-type'?: string;
  'profile-id'?: string;
  'device-token'?: string; // '87cd599d00bd7f83d01b85c67b28daa50314b142e7e6649accade61424131dd6',
  vip?: VIP;
  'viper-server'?: any;
  'viper-client'?: any;
  'viper-p2p'?: any;
  'building-config'?: any;
}

const HEADER = [0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
let requestId = 0x63e0;

export function bufferToString(bytes: Buffer) {
  return [...new Uint8Array(bytes)].map((x: number) => x.toString(16).padStart(2, '0')).join(' ');
}

export function bufferToASCIIString(bytes: Buffer) {
  return bytes.toString('utf-8');
}

interface AptConfig {
  description: string;
  'call-divert-busy-en': boolean;
  'call-divert-address': string;
  'virtual-key-enabled': boolean;
}

interface UserParameters {
  forced: boolean;
  'apt-address-book': any[];
  'switchboard-address-book': any[];
  'camera-address-book': any[];
  'rtsp-camera-address-book': any[];
  'entrance-address-book': any[];
  'actuator-address-book': any[];
  'opendoor-address-book': {
    'output-index': number;
    'apt-address': string;
    name: string;
    'secure-mode': boolean;
  }[];
  'opendoor-actions': { 'output-index': number; 'apt-address': string; action: string }[];
}

interface VIP {
  enabled: boolean;
  'apt-address': string;
  'apt-subaddress': number;
  'logical-subaddress': number;
  'apt-config': AptConfig;
  'user-parameters': UserParameters;
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

  public static fromJSON(json: JSONMessage): PacketMessage {
    const text = [...JSON.stringify(json, null, 0)].map(c => c.charCodeAt(0));
    const buffer = Buffer.from(HEADER.concat(text));
    buffer.writeUIntLE(text.length, 2, 2); // length
    buffer.writeUIntLE(requestId, 4, 2); // requestId
    return new PacketMessage(requestId, buffer, json);
  }

  public static create(...messages: string[]): PacketMessage {
    const NULL = Buffer.from([0x00]);
    const header = Buffer.from(HEADER);
    const magicNumber = Buffer.from([0xcd, 0xab, 0x01, 0x00]);
    const additionalMessages: Buffer[] = [];
    additionalMessages.push(
      ...messages.map((s, i) => {
        const isFirst = i === 0;
        const info = Buffer.alloc(4);
        let text = Buffer.from([...s].map(c => c.charCodeAt(0)));
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
    return new PacketMessage(requestId, buffer);
  }

  dump(ascii: boolean = false) {
    if (ascii) {
      return bufferToASCIIString(this.bytes);
    }
    return bufferToString(this.bytes);
  }
}

function accessMessage(token: string) {
  const json = {
    message: 'access',
    'user-token': token,
    'message-type': 'request',
    'message-id': 2,
  } as JSONMessage;

  return PacketMessage.fromJSON(json);
}

// none config response example
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const noneResponseExample = {
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
  },
  'building-config': { description: 'your building' },
};

// all config response example
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const allConfigExample = {
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

function getConfigMessage(addressbooks: string): PacketMessage {
  const json: JSONMessage = {
    message: 'get-configuration',
    addressbooks: addressbooks,
    'message-type': 'request',
    'message-id': 3,
  };

  return PacketMessage.fromJSON(json);
}

/*
const example = {
  'apt-address': 'COMHUB01',
  'apt-subaddress': 50,
  'bundle-id': 'com.comelitgroup.friendhome',
  message: 'push-info',
  'message-id': 2,
  'os-type': 'ios',
  'profile-id': '3',
  'device-token': '87cd599d00bd7f83d01b85c67b28daa50314b142e7e6649accade61424131dd6',
  'message-type': 'request',
};
*/

function getPushInfoMessage(noneConfig: JSONMessage): PacketMessage {
  const json: JSONMessage = {
    'apt-address': noneConfig.vip['apt-address'],
    'apt-subaddress': 50,
    'bundle-id': 'com.comelitgroup.friendhome',
    message: 'push-info',
    'message-id': 2,
    'os-type': 'ios',
    'profile-id': '3',
    'device-token': '87cd599d00bd7f83d01b85c67b28daa50314b142e7e6649accade61424131dd6',
    'message-type': 'request',
  };

  return PacketMessage.fromJSON(json);
}

function getInfoMessage(): PacketMessage {
  const json: JSONMessage = {
    message: 'server-info',
    'message-type': 'request',
    'message-id': 20,
  };

  return PacketMessage.fromJSON(json);
}

const ViperChannelType = {
  INFO: 0,
  PUSH: 1,
  ECHO: 2,
  UAUT: 3,
  UADM: 4,
  UCFG: 5,
  FACT: 6,
  CTPP: 7,
  CSPB: 8,
  ECHO_SRV: 9,
  RTPC: 10,
  FRCG: 11,
  TSOK: 12,
};

export class IconaBridgeClient {
  private readonly host: string;
  private readonly port: number;
  private readonly token: string;
  private hubName: string;
  private vipAddress: string;

  readonly logger: ConsoleLike;
  private socket: PromiseSocket<net.Socket>;
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
    const content = PacketMessage.create('UAUT').bytes;
    await this.socket.writeAll(content);
    let packet = await this.readResponse();
    const message = accessMessage(this.token);
    await this.socket.writeAll(message.bytes);
    this.logger.log(`Authorization message sent`);
    packet = await this.readResponse();
    const jsonMessage = this.decodeJSONMessage(packet);
    const fin = PacketMessage.create('').bytes;
    await this.socket.writeAll(fin);
    packet = await this.readResponse();
    this.logger.info('-- Authentication: ' + jsonMessage['response-string']);
  }

  private async readResponse() {
    let buffer: Buffer = (await this.socket.read(8)) as Buffer;
    let size = buffer.readUIntLE(2, 2);
    const requestId = buffer.readUIntLE(4, 2);
    buffer = (await this.socket.read(size)) as Buffer;
    const number = buffer.readUIntLE(0, 2);
    this.logger.info(`Message type ${number.toString(16)}`);
    if (number === 0xabcd) {
      const type = buffer.readUIntLE(2, 2);
      this.logger.info(`Read response type ${type}`);
    }

    const packet = PacketMessage.fromBuffer(requestId, buffer);
    if (number == 0x227b) {
      const jsonMessage = this.decodeJSONMessage(packet);
      return PacketMessage.fromJSON(jsonMessage);
    }
    return packet;
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

  async getConfig(): Promise<JSONMessage> {
    requestId++;
    const content = PacketMessage.create('UCFG').bytes;
    await this.socket.writeAll(content);
    let packet = await this.readResponse();

    let packetMessage = getConfigMessage('none');
    await this.socket.writeAll(packetMessage.bytes);
    packet = await this.readResponse();
    this.logger.info('Get configuration: ' + JSON.stringify(packet.message, null, 2));
    return packet.message;

    /*
    await this.socket.writeAll(PacketMessage.create('UCFG').bytes);
    packet = await this.readResponse();

    await this.socket.writeAll(
      PacketMessage.create(
        'CTPP',
        `${noneConfigResponse.vip['apt-address']}${noneConfigResponse.vip['apt-subaddress']}`
      ).bytes
    );

    requestId++;
    await this.socket.writeAll(PacketMessage.create('CSPB').bytes);

    await this.unknownPacket1();
    packet = await this.readResponse();
    this.logger.info(`-- Get configuration step 3`);
    packet = await this.readResponse();
    this.logger.info(`-- Get configuration step 4`);

    // packet = await this.readResponse();
    // this.logger.info(`-- Get configuration step 5`, packet);
    // packet = await this.readResponse();
    // this.logger.info(`-- Get configuration step 6`, packet);

    await this.unknownPacket2(); // 502
    await this.unknownPacket3(); // 503
    await this.socket.writeAll(PacketMessage.create('PUSH').bytes); // 504

    packet = await this.readResponse();
    this.logger.info(`-- Get configuration step 7`, packet);
    packetMessage = getConfigMessage('all'); // 505
    await this.socket.writeAll(packetMessage.bytes);
    let allConfig = null;
    do {
      packet = await this.readResponse();
      allConfig = this.decodeJSONMessage(packet);
    } while (allConfig === null);
    this.logger.info(JSON.stringify(allConfig, null, 2));

    requestId++;
    packetMessage = getPushInfoMessage(noneConfigResponse);
    await this.socket.writeAll(packetMessage.bytes); // 515
    await this.socket.writeAll(PacketMessage.create('INFO').bytes); // 517

    await this.readResponse();

    packetMessage = getInfoMessage();
    this.logger.info(packetMessage.message);
    await this.socket.writeAll(packetMessage.bytes);
    let info = null;
    do {
      packet = await this.readResponse();
      info = this.decodeJSONMessage(packet);
    } while (info === null);
    this.logger.info(JSON.stringify(info, null, 2));
    
     */
  }

  async unknownPacket1(): Promise<Buffer> {
    // 160
    // prettier-ignore
    const bytes = [0x00, 0x06, 0x34, 0x00, 0xe2, 0x63, 0x00, 0x00,
      0xc0, 0x18, 0x24, 0x27, 0x47, 0xaa, 0x00, 0x11,
      0x00, 0x40, 0xaf, 0xcc, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x10, 0x0e,
      0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff,
      0x43, 0x4f, 0x4d, 0x48, 0x55, 0x42, 0x30, 0x31,
      0x32, 0x00, 0x43, 0x4f, 0x4d, 0x48, 0x55, 0x42,
      0x30, 0x31, 0x00, 0x00];
    const p = Buffer.from(bytes);
    p.writeUIntLE(requestId, 4, 2);
    const content = Buffer.from(bytes);
    await this.socket.writeAll(content);
    return content;
  }

  async openDoor(config: JSONMessage, door: number): Promise<void> {
    requestId = 0x63e2;
    this.logger.info(`Request id is now ${requestId}`);
    // prettier-ignore
    const bytes = [ /* Packet 1336 */
      0x00, 0x06, 0x20, 0x00, 0xe2, 0x63, 0x00, 0x00,
      0x00, 0x18, 0x24, 0x27, 0x48, 0xab, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x43, 0x4f,
      0x4d, 0x48, 0x55, 0x42, 0x30, 0x31, 0x00, 0x00 ];

    // prettier-ignore
    const bytes2 = [
      0x00, 0x06, 0x20, 0x00, 0xe2, 0x63, 0x00, 0x00,
      0x20, 0x18, 0x24, 0x27, 0x48, 0xab, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x43, 0x4f,
      0x4d, 0x48, 0x55, 0x42, 0x30, 0x31, 0x00, 0x00 ];

    // prettier-ignore
    const bytes3 = [
      0x00, 0x06, 0x30, 0x00, 0xe2, 0x63, 0x00, 0x00,
      0xc0, 0x18, 0x2a, 0x7c, 0xeb, 0x5f, 0x00, 0x0d,
      0x00, 0x2d, 0x30, 0x30, 0x30, 0x30, 0x30, 0x31,
      0x30, 0x30, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x30, 0x30,
      0x30, 0x30, 0x30, 0x31, 0x30, 0x30, 0x00, 0x00
    ]

    // prettier-ignore
    const bytes4 = [
      0x00, 0x06, 0x20, 0x00, 0xe2, 0x63, 0x00, 0x00,
      0x00, 0x18, 0x2a, 0x7c, 0xec, 0x60, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x30, 0x30,
      0x30, 0x30, 0x30, 0x31, 0x30, 0x30, 0x00, 0x00
    ];

    // prettier-ignore
    const bytes5 = [
      0x00, 0x06, 0x20, 0x00, 0xe2, 0x63, 0x00, 0x00,
      0x20, 0x18, 0x2a, 0x7c, 0xec, 0x60, 0x00, 0x00,
      0xff, 0xff, 0xff, 0xff, 0x43, 0x4f, 0x4d, 0x48,
      0x55, 0x42, 0x30, 0x31, 0x32, 0x00, 0x30, 0x30,
      0x30, 0x30, 0x30, 0x31, 0x30, 0x30, 0x00, 0x00
    ];

    const ctpp = PacketMessage.create(
      'CTPP',
      `${config.vip['apt-address']}${config.vip['apt-subaddress']}`
    );
    this.logger.info(`-- Open door step 1`, ctpp.dump());
    await this.socket.writeAll(ctpp.bytes);
    const unknPacket = await this.unknownPacket1();
    this.logger.info(`-- Open door step 1`, bufferToString(unknPacket));
    const unknResp = await this.readResponse();
    this.logger.info(`-- Open door step 2`, unknResp.dump());

    const packet = Buffer.from(bytes);
    packet.writeUIntLE(requestId, 4, 2);
    this.logger.info(`-- Open door step 3`, bufferToString(packet));
    await this.socket.writeAll(packet);

    const packet2 = Buffer.from(bytes2);
    packet2.writeUIntLE(requestId, 4, 2);
    this.logger.info(`-- Open door step 6`, bufferToString(packet2));
    await this.socket.writeAll(packet2);

    const packet3 = Buffer.from(bytes3);
    packet3.writeUIntLE(requestId, 4, 2);
    this.logger.info(`-- Open door step 7`, bufferToString(packet3));
    await this.socket.writeAll(packet3);

    const resp1 = await this.readResponse();
    if (resp1.message && resp1.message['response-code'] !== 200) {
      this.logger.info(`-- Open door FAILED: ${resp1.message['response-string']}`);
      return;
    }

    // const resp2 = await this.readResponse();
    // if (resp2.message && resp2.message['response-code'] !== 200) {
    //   this.logger.info(`-- Open door FAILED: ${resp2.message['response-string']}`);
    //   return;
    // }

    const packet4 = Buffer.from(bytes4);
    packet4.writeUIntLE(requestId, 4, 2);
    this.logger.info(`-- Open door step 7`, bufferToString(packet4));
    await this.socket.writeAll(packet4);

    const packet5 = Buffer.from(bytes5);
    packet5.writeUIntLE(requestId, 4, 2);
    this.logger.info(`-- Open door step 8`, bufferToString(packet5));
    await this.socket.writeAll(packet5);

    try {
      const unknResp = await this.readResponse();
      this.logger.info(`-- Open door resp`, unknResp.dump());
    } catch (e) {
      this.logger.error('No resp');
    }

    this.logger.info(`-- Open door done`);
  }
}
