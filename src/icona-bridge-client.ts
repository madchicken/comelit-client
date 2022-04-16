import net from 'net';
import {ConsoleLike, ViperChannelType} from './types';
import PromiseSocket from 'promise-socket';
import {
    BinaryResponseType,
    bufferToASCIIString,
    Channel,
    DecodedResponse,
    getInt64Bytes,
    MessageType,
    NO_SEQ,
    OpenChannelData,
    PacketMessage,
    readJSON
} from "./icona/packet";
import {
    AddressbooksConfigMessage,
    AuthMessage,
    BaseMessage,
    BaseResponse,
    ConfigurationResponse,
    DoorItem,
    PushInfoMessage,
    ServerInfoMessage,
    VIPConfig
} from "./icona/types";
import chalk from "chalk";
import {bytesToHex, NULL, numberToHex, stringToBuffer} from "./utils";

const ICONA_BRIDGE_PORT = 64100;

function accessMessage(requestId: number, token: string) {
    const json = {
        message: 'access',
        'user-token': token,
        'message-type': 'request',
        'message-id': ViperChannelType.UAUT,
    } as AuthMessage;

    return PacketMessage.createJSONPacket<AuthMessage>(requestId, json);
}

function getConfigMessage(requestId: number, addressbooks: string): PacketMessage {
    const json: AddressbooksConfigMessage = {
        message: 'get-configuration',
        addressbooks: addressbooks,
        'message-type': 'request',
        'message-id': ViperChannelType.UCFG,
    };

    return PacketMessage.createJSONPacket<AddressbooksConfigMessage>(requestId, json);
}

function getPushInfoMessage(requestId: number, vip: VIPConfig, deviceToken: string): PacketMessage {
    const json: PushInfoMessage = {
        'apt-address': vip['apt-address'],
        'apt-subaddress': vip["apt-subaddress"],
        'bundle-id': 'com.comelitgroup.friendhome',
        message: 'push-info',
        'message-id': ViperChannelType.PUSH,
        'os-type': 'ios',
        'profile-id': '3',
        'device-token': deviceToken,
        'message-type': 'request',
    };

    return PacketMessage.createJSONPacket<PushInfoMessage>(requestId, json);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getInfoMessage(requestId: number): PacketMessage {
    const json: ServerInfoMessage = {
        message: 'server-info',
        'message-type': 'request',
        'message-id': ViperChannelType.SERVER_INFO,
    };

    return PacketMessage.createJSONPacket<ServerInfoMessage>(requestId, json);
}

function getUnknownOpenDoorMessage(requestId: number, vip: VIPConfig) {
    const buffers: Buffer[] = [
        Buffer.from([0xc0, 0x18, 0x5c, 0x8b]), // ??
        Buffer.from([0x2b, 0x73, 0x00, 0x11]), // ??
        Buffer.from([0x00, 0x40, 0xac, 0x23]), // ??
        stringToBuffer(`${vip["apt-address"]}${vip["apt-subaddress"]}`, true),
        Buffer.from([0x10, 0x0e]), // 3600
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // 0
        Buffer.from([0xff, 0xff, 0xff, 0xff]), // -1
        stringToBuffer(`${vip["apt-address"]}${vip["apt-subaddress"]}`, true),
        stringToBuffer(`${vip["apt-address"]}`, true),
        NULL
    ];

    return PacketMessage.createBinaryPacketFromBuffers(requestId, ...buffers);
}

function getOpenDoorMessage(requestId: number, vip: VIPConfig, doorItem: DoorItem, confirm = false) {
    const buffers: Buffer[] = [
        confirm ? Buffer.from([MessageType.OPEN_DOOR_CONFIRM]) : Buffer.from([MessageType.OPEN_DOOR]),
        Buffer.from([0x5c, 0x8b]),
        Buffer.from([0x2c, 0x74, 0x00, 0x00]),
        Buffer.from([0xff, 0xff, 0xff, 0xff]), // -1
        stringToBuffer(`${vip["apt-address"]}${vip["apt-subaddress"]}`, true),
        doorItem ? stringToBuffer(`${doorItem["apt-address"]}`) : stringToBuffer(`${vip["apt-address"]}`, true),
        NULL
    ]

    return PacketMessage.createBinaryPacketFromBuffers(requestId, ...buffers);
}

function getInitOpenDoorMessage(requestId: number, vip: VIPConfig, doorItem: DoorItem) {
    const buffers: Buffer[] = [
        Buffer.from([0xc0, 0x18, 0x70, 0xab]), // ??
        Buffer.from([0x29, 0x9f, 0x00, 0xd]), // ??
        Buffer.from([0x00, 0x2d]), // ??
        stringToBuffer(`${doorItem["apt-address"]}`, true),
        NULL,
        Buffer.from([doorItem["output-index"], 0x0, 0x0, 0x0]), // 3600
        Buffer.from([0xff, 0xff, 0xff, 0xff]), // -1
        stringToBuffer(`${vip["apt-address"]}${vip["apt-subaddress"]}`, true),
        stringToBuffer(`${doorItem["apt-address"]}`, true),
        NULL
    ];

    return PacketMessage.createBinaryPacketFromBuffers(requestId, ...buffers);
}

export class IconaBridgeClient {
    private readonly host: string;
    private readonly port: number;

    readonly logger: ConsoleLike;
    private socket: PromiseSocket<net.Socket>;
    private _socket: net.Socket;
    private id: number;
    private openChannels: Map<Channel, OpenChannelData> = new Map<Channel, OpenChannelData>();

    constructor(
        host: string,
        port: number = ICONA_BRIDGE_PORT,
        logger: ConsoleLike = console
    ) {
        this.host = host;
        this.port = port;
        this.logger = logger;
        this.id = Math.round(Math.random() * 10 + 8000);
    }

    async connect() {
        this._socket = new net.Socket();
        this.socket = new PromiseSocket(this._socket);
        this.socket.setTimeout(5000);
        this.logger.info(`Connecting to ${this.host}:${this.port}`);
        await this.socket.connect(this.port, this.host);
        this.socket.socket.setMaxListeners(20);
        this.logger.info('connected');
    }

    private async writeBytePacket(packet: PacketMessage) {
        this.logger.debug(`Writing bytes to socket: \n${bytesToHex(packet.bytes)}`);
        await this.socket.writeAll(packet.bytes);
    }

    private async readResponse<T extends BaseMessage>(): Promise<DecodedResponse<T>> {
        try {
            const header: Buffer = (await this.socket.read(8)) as Buffer;

            const size = header.readUIntLE(2, 2);
            let requestId = header.readUIntLE(4, 4);
            const body = (await this.socket.read(size)) as Buffer;
            this.logger.debug(`Read bytes from socket (size: ${size}):\n${bytesToHex(body)}`)
            return this.decodeResponse<T>(requestId, body);
        } catch (e) {
            this.logger.warn('No bytes to read, skipping');
            return null;
        }
    }

    private decodeResponse<T extends BaseMessage>(requestId: number, body: Buffer): DecodedResponse<T> {
        if (requestId === 0) {
            // Request ID is at the end of the message for binary protocol
            const number = body.readUIntLE(0, 2);
            const seq = body.readUIntLE(2, 2);
            switch (number) {
                case MessageType.COMMAND: {
                    const subSize = body.readUIntLE(4, 4);
                    requestId = body.readUIntLE(subSize, subSize);
                    return {requestId, sequence: seq, type: BinaryResponseType.BINARY};
                }
                case MessageType.END:
                    this.logger.info("END response received with sequence number " + seq);
                    return {requestId, sequence: seq, type: BinaryResponseType.BINARY};
                default:
                    this.logger.info("No handler implemented for message type " + getInt64Bytes(number).map(n => `0x${n}`).join(' '));
                    return null;
            }
        } else { // data packet
            const first = body.readUIntLE(0, 1);
            const second = body.readUIntLE(1, 1);
            switch (first) {
                case 0x7b:
                    // the first char is an open curly bracket (JSON MESSAGE)
                    return {requestId, sequence: NO_SEQ, type: BinaryResponseType.JSON, json: readJSON<T>(body)};
                default:
                    // binary data (still not fully reversed)
                    return this.decodeBinaryResponse(requestId, first, second, body);
            }
        }
    }

    decodeBinaryResponse<T extends BaseMessage>(requestId: number, subtype: number, type: number, body: Buffer): DecodedResponse<T> {
        switch (type) {
            case 0x18: // open door first response
                this.logger.info('Open door: ' + bufferToASCIIString(body));
        }
        return {requestId, sequence: NO_SEQ, type: BinaryResponseType.BINARY};
    }

    async shutdown() {
        await this.socket.end();
    }

    async openChanel(channel: Channel, additionalData?: string): Promise<OpenChannelData> {
        if(this.openChannels.has(channel)) {
            return Promise.resolve(this.openChannels.get(channel));
        }

        this.id++;
        const openChannelData = {channel, sequence: 1, id: this.id};
        this.openChannels.set(channel, openChannelData);
        const p = PacketMessage.createBinaryPacketFromStrings(this.id, 1, MessageType.COMMAND, channel, additionalData);
        await this.writeBytePacket(p);

        const response = await this.readResponse();
        if(response) {
            this.logger.info(`Opened channel ${channel}, sequence is ${response.sequence} and requestId is ${numberToHex(this.id)}`);
            if (response.type === BinaryResponseType.BINARY && response.sequence === 2) {
                openChannelData.sequence = response.sequence;
                return openChannelData
            }
        }
        this.logger.error(chalk.red(`Error trying opening channel ${channel}, received wrong response from server`));
        await this.shutdown();
    }

    async closeChanel(channelData: OpenChannelData): Promise<OpenChannelData> {
        const p = PacketMessage.createBinaryPacketFromStrings(channelData.id, ++channelData.sequence, MessageType.END);
        await this.writeBytePacket(p);
        const response = await this.readResponse();
        this.logger.info(`Closed channel ${channelData.channel}, sequence id is ${response.sequence} and requestId is ${numberToHex(channelData.id)}`);
        if (response.type === BinaryResponseType.BINARY && response.sequence === channelData.sequence + 1) {
            this.openChannels.delete(channelData.channel);
            return {...channelData, sequence: response.sequence}
        }
        this.logger.error(chalk.red(`Error trying closing channel ${channelData.channel}, received wrong response from server`));
        await this.shutdown();
    }

    async authenticate(token: string): Promise<number> {
        const channelData = await this.openChanel(Channel.UAUT);
        const message = accessMessage(channelData.id, token);
        await this.writeBytePacket(message);
        const resp = await this.readResponse<BaseResponse>();
        if (resp && resp.json) {
            await this.closeChanel(channelData);
            return resp.json["response-code"];
        }
        this.logger.error(chalk.red(`Error trying to authenticate, received wrong response from server: ${JSON.stringify(resp)}`));
        await this.shutdown();
        return 500;
    }

    async getConfig(addressbooks: string, closeChannel = true): Promise<ConfigurationResponse> {
        const channelData = await this.openChanel(Channel.UCFG);
        if(channelData) {
            const packetMessage = getConfigMessage(channelData.id, addressbooks);
            await this.writeBytePacket(packetMessage);
            const resp = await this.readResponse<ConfigurationResponse>();
            if (resp && resp.type === BinaryResponseType.JSON) {
                if (closeChannel) {
                    await this.closeChanel(channelData);
                }
                return resp.json;
            }
            this.logger.error(chalk.red(`Error trying to get configuration, received wrong response from server: ${JSON.stringify(resp)}`));
        }
        return null;
    }

    async getServerInfo(closeChannel = true): Promise<ConfigurationResponse> {
        const channelData = await this.openChanel(Channel.INFO);
        if(channelData) {
            const packetMessage = getInfoMessage(channelData.id);
            await this.writeBytePacket(packetMessage);
            const resp = await this.readResponse<ConfigurationResponse>();
            if (resp && resp.type === BinaryResponseType.JSON) {
                if (closeChannel) {
                    await this.closeChanel(channelData);
                }
                return resp.json;
            }
            this.logger.error(chalk.red(`Error trying to get server info, received wrong response from server: ${JSON.stringify(resp)}`));
        }
        return null;
    }

    async getPushInfo(vip: VIPConfig, deviceToken: string, closeChannel = true): Promise<ConfigurationResponse> {
        const channelData = await this.openChanel(Channel.PUSH);
        if(channelData) {
            const packetMessage = getPushInfoMessage(channelData.id, vip, deviceToken);
            await this.writeBytePacket(packetMessage);
            const resp = await this.readResponse<ConfigurationResponse>();
            if (resp && resp.type === BinaryResponseType.JSON) {
                if (closeChannel) {
                    await this.closeChanel(channelData);
                }
                return resp.json;
            }
            this.logger.error(chalk.red(`Error trying to get push info, received wrong response from server: ${JSON.stringify(resp)}`));
        }
        return null;
    }

    async openDoorInit(vip: VIPConfig) {
        const ctpp = await this.openChanel(Channel.CTPP, `${vip["apt-address"]}${vip["apt-subaddress"]}`);
        // await this.openChanel(Channel.CSPB);
        const initMessage = getUnknownOpenDoorMessage(ctpp.id, vip);
        await this.writeBytePacket(initMessage);
        const resp1 = await this.readResponse<any>();
        this.logger.info(`CTPP 1:\n${JSON.stringify(resp1)}`);
        const resp2 = await this.readResponse<any>();
        this.logger.info(`CTPP 2:\n${JSON.stringify(resp2)}`);
        return ctpp;
    }

    async openDoor(vip: VIPConfig, doorItem: DoorItem, ctpp: OpenChannelData) {
        const packetMessage = getOpenDoorMessage(ctpp.id, vip, null);
        await this.writeBytePacket(packetMessage);
        const confirmMessage = getOpenDoorMessage(ctpp.id, vip, null, true);
        await this.writeBytePacket(confirmMessage);
        const message1 = getInitOpenDoorMessage(ctpp.id, vip, doorItem);
        await this.writeBytePacket(message1);
        const resp = await this.readResponse<ConfigurationResponse>();
        this.logger.info(`${JSON.stringify(resp)}`);
        const resp2 = await this.readResponse<ConfigurationResponse>();
        this.logger.info(`${JSON.stringify(resp2)}`);
        const packetMessage1 = getOpenDoorMessage(ctpp.id, vip, doorItem);
        await this.writeBytePacket(packetMessage1);
        const confirmMessage1 = getOpenDoorMessage(ctpp.id, vip, doorItem, true);
        await this.writeBytePacket(confirmMessage1);
    }
}
