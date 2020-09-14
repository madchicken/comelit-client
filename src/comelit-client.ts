import MQTT, { AsyncMqttClient } from 'async-mqtt';
import { DeferredMessage, PromiseBasedQueue } from './promise-queue';
import { generateUUID, sleep } from './utils';
import dgram, { RemoteInfo } from 'dgram';
import { AddressInfo } from 'net';
import { ConsoleLike, DeviceData, HomeIndex } from './types';
import Timeout = NodeJS.Timeout;

export const ROOT_ID = 'GEN#17#13#1';

const connectAsync = MQTT.connectAsync;
const CLIENT_ID_PREFIX = 'HSrv';
const SCAN_PORT = 24199;

export enum REQUEST_TYPE {
  STATUS = 0,
  ACTION = 1,
  SUBSCRIBE = 3,
  LOGIN = 5,
  PING = 7,
  READ_PARAMS = 8,
  GET_DATETIME = 9,
  ANNOUNCE = 13,
}

export enum REQUEST_SUB_TYPE {
  CREATE_OBJ,
  UPDATE_OBJ,
  DELETE_OBJ,
  SET_ACTION_OBJ,
  GET_TEMPO_OBJ,
  SUBSCRIBE_RT,
  UNSUBSCRIBE_RT,
  GET_CONF_PARAM_GROUP = 23,
  NONE = -1,
}

export enum ACTION_TYPE {
  SET,
  CLIMA_MODE,
  CLIMA_SET_POINT,
  SWITCH_SEASON = 4,
  SWITCH_CLIMA_MODE = 13,
  UMI_SETPOINT = 19,
  SWITCH_UMI_MODE = 23,
}

export interface MqttIncomingMessage {
  req_type: REQUEST_TYPE;
  seq_id: number;
  req_result: number;
  req_sub_type: number;
  agent_id?: number;
  agent_type: number;
  sessiontoken?: string;
  uid?: string;
  param_type?: number;
  obj_id?: string;
  out_data?: any[];
  params_data?: Param[];
  message?: string;
}

export enum ThermoSeason {
  SUMMER = '0',
  WINTER = '1',
}

export enum ClimaMode {
  NONE = '0',
  AUTO = '1',
  MANUAL = '2',
  SEMI_AUTO = '3',
  SEMI_MAN = '4',
  OFF_AUTO = '5',
  OFF_MANUAL = '6',
}

export enum ClimaOnOff {
  OFF_THERMO,
  ON_THERMO,
  OFF_HUMI,
  ON_HUMI,
  OFF,
  ON,
}

export enum ObjectStatus {
  NONE = -1,
  OFF = 0,
  ON = 1,
  IDLE = 2,
  ON_DEHUMIDIFY = 4,
  UP = 7,
  DOWN = 8,
  OPEN = 9,
  CLOSE = 10,
  ON_COOLING = 11,
}

export interface MqttMessage {
  req_type: REQUEST_TYPE;
  seq_id: number;
  req_sub_type: number;
  agent_id?: number;
  agent_type?: number;
  user_name?: string;
  password?: string;
  sessiontoken?: string;
  uid?: string;
  param_type?: number;
  obj_id?: string;
  obj_type?: number;
  detail_level?: number;
  act_params?: number[];
  act_type?: number;
}

interface ComelitProps {
  client: AsyncMqttClient;
  index: number;
  agent_id?: number;
  sessiontoken?: string;
  uid?: string;
  user_name?: string;
  password?: string;
}

interface Param {
  param_name: string;
  param_value: string;
}

function deserializeMessage(message: any): MqttIncomingMessage {
  const parsed: any = JSON.parse(message.toString());
  parsed.status = parseInt(parsed.status);
  return parsed as MqttIncomingMessage;
}

function bytesToHex(byteArray: Buffer): string {
  return byteArray.reduce((output, elem) => output + ('0' + elem.toString(16)).slice(-2), '');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFAULT_TIMEOUT = 5000;

export interface ClientConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface HUBClientConfig extends ClientConfig {
  hub_username?: string;
  hub_password?: string;
  clientId?: string;
}

export interface ComelitDevice {
  modelID: string;
  model?: string;
  description: string;
  ip: string;
  macAddress: string;
  hwID: string;
  appID: string;
  appVersion: string;
  systemID: string;
}

export const DEFAULT_SEND_DELAY = 500;

export class ComelitClient extends PromiseBasedQueue<MqttMessage, MqttIncomingMessage> {
  private readonly props: ComelitProps;
  private homeIndex: HomeIndex;
  private username: string;
  private password: string;
  private txTopic: string;
  private rxTopic: string;
  private clientId: string;
  private readonly onUpdate: (
    objId: string,
    data: Readonly<DeviceData>,
    oldData?: Readonly<DeviceData>
  ) => void;
  private readonly logger: ConsoleLike;

  constructor(onUpdate?: (objId: string, device: DeviceData) => void, log?: ConsoleLike) {
    super();
    this.props = {
      client: null,
      index: 1,
    };
    this.onUpdate = onUpdate;
    this.logger = log || console;
  }

  private static evalResponse(response: MqttIncomingMessage): boolean {
    if (response.req_result === 0) {
      console.debug(`Resolving response ${response.seq_id}`);
      return true;
    }
    console.error(response.message);
    throw new Error(response.message);
  }

  consume(response: MqttIncomingMessage): boolean {
    const deferredMqttMessage = response.seq_id ? this.findInQueue(response) : null;
    if (deferredMqttMessage) {
      this.queuedMessages.splice(this.queuedMessages.indexOf(deferredMqttMessage), 1);
      if (response.req_result === 0) {
        this.logger.debug(`Resolving promise ${response.seq_id}:`, response);
        deferredMqttMessage.promise.resolve(response);
      } else {
        this.logger.error(`Rejecting promise ${response.seq_id}:`, response);
        deferredMqttMessage.promise.reject(response);
      }
      return true;
    } else {
      if (response.obj_id && response.out_data && response.out_data.length && this.homeIndex) {
        const datum: DeviceData = response.out_data[0];
        const oldValue = Object.freeze(this.homeIndex.get(response.obj_id));
        const value = Object.freeze(this.homeIndex.updateObject(response.obj_id, datum));
        if (this.onUpdate && value) {
          this.logger.info(`Updating ${response.obj_id} with data ${JSON.stringify(datum)}`);
          this.onUpdate(response.obj_id, value, oldValue);
        }
      }
    }
    return false;
  }

  findInQueue(message: MqttIncomingMessage): DeferredMessage<MqttMessage, MqttIncomingMessage> {
    return this.queuedMessages.find(
      m => m.message.seq_id == message.seq_id && m.message.req_type == message.req_type
    );
  }

  isLogged(): boolean {
    return !!this.props.sessiontoken;
  }

  scan(): Promise<ComelitDevice[]> {
    return new Promise(resolve => {
      const devices = [];
      const server = dgram.createSocket('udp4');
      let timeout: Timeout;

      function sendScan() {
        const message = Buffer.alloc(12);
        message.write('SCAN');
        message.writeInt32BE(0x00000000, 4);
        message.writeInt32BE(0x00ffffff, 8);
        server.send(message, SCAN_PORT, '255.255.255.255');
      }

      function sendInfo(address: AddressInfo) {
        const message = Buffer.alloc(12);
        message.write('INFO');
        server.send(message, address.port, address.address);
      }

      server.bind(() => {
        server.setBroadcast(true);
        sendScan();
        timeout = setTimeout(() => {
          resolve(devices);
        }, 1000);
      });

      server.on('listening', () => {
        const address: AddressInfo = server.address() as AddressInfo;
        this.logger.debug(`Server listening ${address.address}:${address.port}`);
      });

      server.on('error', err => {
        this.logger.error(`server error:\n${err.stack}`);
        clearInterval(timeout);
        server.close();
        resolve(devices);
      });

      server.on('message', (msg, rinfo: RemoteInfo) => {
        if (msg.toString().startsWith('here')) {
          sendInfo(rinfo);
        } else {
          const device: ComelitDevice = {
            macAddress: bytesToHex(msg.subarray(14, 20)),
            hwID: msg.subarray(20, 24).toString(),
            appID: msg.subarray(24, 28).toString(),
            appVersion: msg.subarray(32, 112).toString(),
            systemID: msg.subarray(112, 116).toString(),
            description: msg.subarray(116, 152).toString(),
            modelID: msg.subarray(156, 160).toString(),
            ip: rinfo.address,
          };
          let model = device.modelID;
          switch (device.modelID) {
            case 'Extd':
              model = '1456 - Gateway';
              break;
            case 'ExtS':
              model = '1456S - Gateway';
              break;
            case 'MSVF':
              model = '6741W - Mini SBC/ViP/Extender handsfree';
              break;
            case 'MSVU':
              model = '6741W - Mini SBC/ViP/Extender handsfree';
              break;
            case 'MnWi':
              model = '6742W - Mini ViP handsfree Wifi';
              break;
            case 'MxWi':
              model = "6842W - Maxi ViP 7'' Wifi";
              break;
            case 'Vist':
              model = 'Visto - Wifi ViP';
              break;
            case 'HSrv':
              model = 'Home server';
              break;
          }
          device.model = model;
          devices.push(device);
        }
      });
    });
  }

  async getMACAddress(config: HUBClientConfig) {
    return new Promise((resolve, reject) => {
      const server = dgram.createSocket('udp4');
      const message = Buffer.alloc(12);
      message.write('INFO');
      server.send(
        message,
        SCAN_PORT,
        config.host.indexOf('://') !== -1
          ? config.host.substr(config.host.indexOf('://') + 3)
          : config.host
      );
      server.on('message', msg => {
        const macAddress = bytesToHex(msg.subarray(14, 20));
        server.close();
        resolve(macAddress.toUpperCase());
      });
      server.on('error', err => {
        this.logger.info(`server error:\n${err.stack}`);
        server.close();
        reject();
      });
    });
  }

  async init(config: HUBClientConfig): Promise<AsyncMqttClient> {
    let broker;
    let macAddress;
    if (config.host) {
      broker = config.host.indexOf('://') !== -1 ? config.host : `mqtt://${config.host}`;
      macAddress = await this.getMACAddress(config);
    } else {
      this.logger.info('Searching for Comelit HUB on LAN...');
      const devices = await this.scan();
      const hub = devices.find(device => device.appID === 'HSrv');
      if (hub) {
        this.logger.info(
          `Found Comelit HUB at ${hub.ip} (MAC ${hub.macAddress}, Name ${hub.description})`
        );
        broker = `mqtt://${hub.ip}`;
        macAddress = hub.macAddress.toUpperCase();
      } else {
        throw new Error(
          'Unable to find Comelit HUB on local network. If you know the IP, please use it in the configuration'
        );
      }
    }
    this.username = config.username;
    this.password = config.password;
    this.clientId = this.getOrCreateClientId(config.clientId);
    this.rxTopic = `${CLIENT_ID_PREFIX}/${macAddress}/rx/${this.clientId}`;
    this.txTopic = `${CLIENT_ID_PREFIX}/${macAddress}/tx/${this.clientId}`;
    this.logger.info(
      `Connecting to Comelit HUB at ${broker} with clientID ${
        this.clientId
      } (user: ${config.hub_username || 'hsrv-user'}, pwd ${config.hub_password || 'sf1nE9bjPc'})`
    );
    this.props.client = await connectAsync(broker, {
      username: config.hub_username || 'hsrv-user',
      password: config.hub_password || 'sf1nE9bjPc',
      clientId: config.clientId || CLIENT_ID_PREFIX,
      keepalive: 120,
      rejectUnauthorized: false,
    });
    // Register to incoming messages
    await this.subscribeTopic(this.txTopic, this.handleIncomingMessage.bind(this));
    this.setTimeout(DEFAULT_TIMEOUT);
    this.props.agent_id = await this.retrieveAgentId();
    this.logger.info(`...done: client agent id is ${this.props.agent_id}`);
    return this.props.client;
  }

  async subscribeTopic(topic: string, handler: (topic: string, message: any) => void) {
    await this.props.client.subscribe(topic);
    this.props.client.on('message', handler);
  }

  async shutdown() {
    if (this.props.client && this.props.client.connected) {
      try {
        this.flush(true);
        this.logger.info('Comelit client unsubscribe from read topic');
        await this.props.client.unsubscribe(this.rxTopic);
        this.logger.info('Comelit client ending session');
        await this.props.client.end(true);
      } catch (e) {
        this.logger.info(e.message);
      }
    }
    this.props.client = null;
    this.props.index = 0;
    this.props.sessiontoken = null;
    this.props.agent_id = null;
    this.logger.info('Comelit client disconnected');
  }

  async login(): Promise<boolean> {
    if (!this.props.agent_id) {
      throw new Error('You must initialize the client before calling login');
    }
    const packet: MqttMessage = {
      req_type: REQUEST_TYPE.LOGIN,
      seq_id: this.props.index++,
      req_sub_type: REQUEST_SUB_TYPE.NONE,
      agent_type: 0,
      agent_id: this.props.agent_id,
      user_name: this.username,
      password: this.password,
    };
    try {
      const response = await this.publish(packet);
      this.props.sessiontoken = response.sessiontoken;
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async readParameters(): Promise<Param[]> {
    const packet: MqttMessage = {
      req_type: REQUEST_TYPE.READ_PARAMS,
      seq_id: this.props.index++,
      req_sub_type: REQUEST_SUB_TYPE.GET_CONF_PARAM_GROUP,
      param_type: 2,
      agent_type: 0,
      agent_id: this.props.agent_id,
      sessiontoken: this.props.sessiontoken,
    };
    const response = await this.publish(packet);
    ComelitClient.evalResponse(response);
    return [...response.params_data];
  }

  async subscribeObject(id: string): Promise<boolean> {
    const packet: MqttMessage = {
      req_type: REQUEST_TYPE.SUBSCRIBE,
      seq_id: this.props.index++,
      req_sub_type: REQUEST_SUB_TYPE.SUBSCRIBE_RT,
      sessiontoken: this.props.sessiontoken,
      obj_id: id,
    };
    const response = await this.publish(packet);
    return ComelitClient.evalResponse(response);
  }

  async ping(): Promise<boolean> {
    const packet: MqttMessage = {
      req_type: REQUEST_TYPE.PING,
      seq_id: this.props.index++,
      req_sub_type: REQUEST_SUB_TYPE.NONE,
      sessiontoken: this.props.sessiontoken,
    };
    const response = await this.publish(packet);
    return ComelitClient.evalResponse(response);
  }

  async device(objId: string = ROOT_ID, detailLevel?: number): Promise<DeviceData> {
    const packet: MqttMessage = {
      req_type: REQUEST_TYPE.STATUS,
      seq_id: this.props.index++,
      req_sub_type: REQUEST_SUB_TYPE.NONE,
      sessiontoken: this.props.sessiontoken,
      obj_id: objId,
      detail_level: detailLevel || 1,
    };
    const response = await this.publish(packet);
    ComelitClient.evalResponse(response);
    return response.out_data[0] as DeviceData;
  }

  async zones(objId: string): Promise<DeviceData> {
    const packet: MqttMessage = {
      req_type: REQUEST_TYPE.STATUS,
      seq_id: this.props.index++,
      req_sub_type: REQUEST_SUB_TYPE.NONE,
      sessiontoken: this.props.sessiontoken,
      obj_id: objId,
      obj_type: 1000,
      detail_level: 1,
    };
    const response = await this.publish(packet);
    ComelitClient.evalResponse(response);
    return response.out_data[0] as DeviceData;
  }

  async fetchHomeIndex(): Promise<HomeIndex> {
    const root = await this.device(ROOT_ID);
    return this.mapHome(root);
  }

  async toggleDeviceStatus(id: string, status: number): Promise<boolean> {
    return this.sendAction(id, ACTION_TYPE.SET, status);
  }

  async setTemperature(id: string, temperature: number): Promise<boolean> {
    return this.sendAction(id, ACTION_TYPE.CLIMA_SET_POINT, temperature);
  }

  async switchThermostatMode(id: string, mode: ClimaMode): Promise<boolean> {
    return this.sendAction(id, ACTION_TYPE.SWITCH_CLIMA_MODE, parseInt(mode));
  }

  async switchThermostatSeason(id: string, mode: ThermoSeason): Promise<boolean> {
    return this.sendAction(id, ACTION_TYPE.SWITCH_SEASON, parseInt(mode));
  }

  async setHumidity(id: string, humidity: number): Promise<boolean> {
    return this.sendAction(id, ACTION_TYPE.UMI_SETPOINT, humidity);
  }

  async switchHumidifierMode(id: string, mode: ClimaMode): Promise<boolean> {
    return this.sendAction(id, ACTION_TYPE.SWITCH_UMI_MODE, parseInt(mode));
  }

  async toggleHumidifierStatus(id: string, mode: ClimaOnOff): Promise<boolean> {
    return this.sendAction(id, ACTION_TYPE.SET, mode);
  }

  async toggleThermostatStatus(id: string, mode: ClimaOnOff): Promise<boolean> {
    return this.sendAction(id, ACTION_TYPE.SET, mode);
  }

  async sendAction(id: string, type: ACTION_TYPE, value: any) {
    const packet: MqttMessage = {
      req_type: REQUEST_TYPE.ACTION,
      seq_id: this.props.index++,
      req_sub_type: REQUEST_SUB_TYPE.SET_ACTION_OBJ,
      act_type: type,
      sessiontoken: this.props.sessiontoken,
      obj_id: id,
      act_params: [value],
    };
    await sleep(DEFAULT_SEND_DELAY);
    const response = await this.publish(packet);
    return ComelitClient.evalResponse(response);
  }

  mapHome(home: DeviceData): HomeIndex {
    this.homeIndex = new HomeIndex(home);
    return this.homeIndex;
  }

  private getOrCreateClientId(clientId: string): string {
    if (this.clientId) {
      // We already generated a client id, reuse it
      return this.clientId;
    }
    return clientId
      ? `${CLIENT_ID_PREFIX}_${clientId}`
      : `${CLIENT_ID_PREFIX}_${generateUUID(`${Math.random()}`).toUpperCase()}`;
  }

  private async retrieveAgentId(): Promise<number> {
    this.logger.info('Retrieving agent id...');
    const packet: MqttMessage = {
      req_type: REQUEST_TYPE.ANNOUNCE,
      seq_id: this.props.index++,
      req_sub_type: REQUEST_SUB_TYPE.NONE,
      agent_type: 0,
    };
    const msg = await this.publish(packet);
    const agentId = msg.out_data[0].agent_id;
    const desc = msg.out_data[0].descrizione;
    this.logger.info(`Logged into Comelit hub: ${desc}`);
    return agentId;
  }

  private publish(packet: MqttMessage): Promise<MqttIncomingMessage> {
    this.logger.info(`Sending message to HUB ${JSON.stringify(packet)}`);
    return this.props.client
      .publish(this.rxTopic, JSON.stringify(packet))
      .then(() => this.enqueue(packet))
      .catch(response => {
        this.logger.error('Error while sending packet');
        if (response.req_result === 1 && response.message === 'invalid token') {
          return this.login().then(() => this.publish(packet)); // relogin and override invalid token
        }
        if (response.message.indexOf('Timeout') > 0) {
          return this.publish(packet);
        }
        throw response;
      });
  }

  private handleIncomingMessage(topic: string, message: any) {
    const msg: MqttIncomingMessage = deserializeMessage(message);
    this.logger.debug(`Received message with id ${msg.seq_id}`);
    if (topic === this.txTopic) {
      this.processQueue(msg);
    } else {
      console.error(`Unknown topic ${topic}, message ${msg.toString()}`);
    }
  }
}
