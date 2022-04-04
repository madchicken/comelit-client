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
    PushInfoMessage,
    ServerInfoMessage,
    VIPConfig
} from "./icona/types";
import chalk from "chalk";
import {bytesToHex, stringToBuffer} from "./utils";

const ICONA_BRIDGE_PORT = 64100;
let seq = 0;

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

function getOpenDoorMessage(requestId: number, vip: VIPConfig) {
    const unkData = Buffer.from([0x70, 0xab, 0x29, 0x9f, 0x00, 0x0d, 0x00, 0x2d]);
    const hubData = stringToBuffer(vip["apt-address"]);
    return PacketMessage.createBinaryPacketFromBuffers(requestId, MessageType.OPEN_DOOR, unkData, hubData);
}

export class IconaBridgeClient {
    private readonly host: string;
    private readonly port: number;
    private hubName: string;
    private vipAddress: string;

    readonly logger: ConsoleLike;
    private socket: PromiseSocket<net.Socket>;
    private id: number;

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
        this.socket = new PromiseSocket(new net.Socket());
        this.socket.setTimeout(5000);
        this.logger.info(`Connecting to ${this.host}:${this.port}`);
        await this.socket.connect(this.port, this.host);
        this.socket.socket.setMaxListeners(20);
        this.logger.info('connected');
    }

    private async writeBytePacket(packet: PacketMessage) {
        this.logger.debug(`Writing bytes to socket: ${bytesToHex(packet.bytes)} (ASCII: ${bufferToASCIIString(packet.bytes)})`);
        await this.socket.writeAll(packet.bytes);
    }

    private async readResponse<T extends BaseMessage>(): Promise<DecodedResponse<T>> {
        try {
            const header: Buffer = (await this.socket.read(8)) as Buffer;

            const size = header.readUIntLE(2, 2);
            let requestId = header.readUIntLE(4, 4);
            const body = (await this.socket.read(size)) as Buffer;
            return this.decodeResponse<T>(requestId, header, body);
        } catch (e) {
            this.logger.warn('No bytes to read, skipping');
            return null;
        }
    }

    private decodeResponse<T extends BaseMessage>(requestId: number, header: Buffer, body: Buffer): DecodedResponse<T> {
        if (requestId === 0) {
            // Request ID is at the end of the message for binary protocol
            const number = body.readUIntLE(0, 2);
            seq = body.readUIntLE(2, 2);
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
        } else {
            const first = body.readUIntLE(0, 1);
            if (first === 0x7b) { // check if the first char is an open curly bracket
                // JSON MESSAGE
                return {requestId, sequence: seq, type: BinaryResponseType.JSON, json: readJSON<T>(body)};
            }
            // binary data (still not fully reversed)
            return {requestId, sequence: seq, type: BinaryResponseType.BINARY};
        }
    }

    async shutdown() {
        await this.socket.end();
    }

    async openChanel(channel: Channel, additionalData?: string): Promise<OpenChannelData> {
        this.id++;
        const p = PacketMessage.createBinaryPacketFromStrings(this.id, 1, MessageType.COMMAND, channel, additionalData);
        await this.writeBytePacket(p);
        const response = await this.readResponse();
        this.logger.info(`Opened channel ${channel}, sequence is ${response.sequence} and requestId is ${this.id}`);
        if (response.type === BinaryResponseType.BINARY && response.sequence === 2) {
            return {channel, sequence: response.sequence, id: this.id}
        }
        this.logger.error(chalk.red(`Error trying opening channel ${channel}, received wrong response from server`));
        await this.shutdown();
    }

    async closeChanel(channelData: OpenChannelData): Promise<OpenChannelData> {
        const p = PacketMessage.createBinaryPacketFromStrings(channelData.id, ++channelData.sequence, MessageType.END);
        await this.writeBytePacket(p);
        const response = await this.readResponse();
        this.logger.info(`Closed channel ${channelData.channel}, sequence id is ${response.sequence} and requestId is ${this.id}`);
        if (response.type === BinaryResponseType.BINARY && response.sequence === channelData.sequence + 1) {
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

    async getConfig(addressbooks: string): Promise<ConfigurationResponse> {
        const channelData = await this.openChanel(Channel.UCFG);

        const packetMessage = getConfigMessage(channelData.id, addressbooks);
        await this.writeBytePacket(packetMessage);
        const resp = await this.readResponse<ConfigurationResponse>();
        if (resp && resp.type === BinaryResponseType.JSON) {
            await this.closeChanel(channelData);
            return resp.json;
        }
        this.logger.error(chalk.red(`Error trying to get configuration, received wrong response from server: ${JSON.stringify(resp)}`));
        return null;
    }

    async getServerInfo(): Promise<ConfigurationResponse> {
        const channelData = await this.openChanel(Channel.INFO);

        const packetMessage = getInfoMessage(channelData.id);
        await this.writeBytePacket(packetMessage);
        const resp = await this.readResponse<ConfigurationResponse>();
        if (resp && resp.type === BinaryResponseType.JSON) {
            await this.closeChanel(channelData);
            return resp.json;
        }
        this.logger.error(chalk.red(`Error trying to get server info, received wrong response from server: ${JSON.stringify(resp)}`));
        return null;
    }

    async getPushInfo(vip: VIPConfig, deviceToken: string): Promise<ConfigurationResponse> {
        const channelData = await this.openChanel(Channel.PUSH);

        const packetMessage = getPushInfoMessage(channelData.id, vip, deviceToken);
        await this.writeBytePacket(packetMessage);
        const resp = await this.readResponse<ConfigurationResponse>();
        if (resp && resp.type === BinaryResponseType.JSON) {
            await this.closeChanel(channelData);
            return resp.json;
        }
        this.logger.error(chalk.red(`Error trying to get push info, received wrong response from server: ${JSON.stringify(resp)}`));
        return null;
    }

    async openDoor(vip: VIPConfig) {
        const channelData = await this.openChanel(Channel.CTPP, `${vip["apt-address"]}${vip["apt-subaddress"]}`);
        const packetMessage = getOpenDoorMessage(channelData.id, vip);
        await this.writeBytePacket(packetMessage);
        const resp = await this.readResponse<ConfigurationResponse>();
        this.logger.info(`${JSON.stringify(resp)}`);
    }
}
