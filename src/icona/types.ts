type JSONMessageType = 'access' | 'get-configuration' | 'server-info' | 'push-info';

export interface BaseMessage {
    message: JSONMessageType;
    'message-id': number;
    'message-type': 'request' | 'response';
}

export interface ServerInfoMessage extends BaseMessage {
}

export interface AuthMessage extends BaseMessage {
    'user-token': string;
}

export interface AddressbooksConfigMessage extends BaseMessage {
    addressbooks: string;
}

export interface BaseResponse extends BaseMessage {
    'response-string': string;
    'response-code': number;
}

export interface PushInfoMessage extends BaseMessage {
    'apt-address': string,
    'apt-subaddress': number;
    'bundle-id': string; // 'com.comelitgroup.friendhome'
    'os-type': 'ios' | 'android';
    'profile-id': string;
    'device-token': string;
}

export interface ConfigurationResponse extends BaseResponse {
    'viper-server': ViperServer;
    'viper-client': ViperClient;
    'viper-p2p': ViperP2PConfig;
    vip: VIPConfig;
    'building-config': BuildingConfig;
}

export interface AptConfig {
    description: string;
    'call-divert-busy-en': boolean;
    'call-divert-address': string;
    'virtual-key-enabled': boolean;
}

export interface UserParameters {
    forced: boolean;
    'apt-address-book': any[];
    'switchboard-address-book': any[];
    'camera-address-book': any[];
    'rtsp-camera-address-book': any[];
    'entrance-address-book': any[];
    'actuator-address-book': any[];
    'opendoor-address-book': DoorItem[];
    'opendoor-actions': OpenDoorAction[];
}

export interface VIPConfig {
    enabled: boolean;
    'apt-address': string;
    'apt-subaddress': number;
    'logical-subaddress': number;
    'apt-config'?: AptConfig;
    'user-parameters'?: UserParameters;
}

// all config response example
export interface ViperServer {
    "local-address": string;
    "local-tcp-port": number;
    "local-udp-port": number;
    "remote-address": string;
    "remote-tcp-port": number;
    "remote-udp-port": number;
}

export interface ViperClient {
    description: string;
}

export interface MQTTConfig {
    role: string;
    base: string;
    server: string;
    auth: { method: string[] };
}

export interface HTTPConfig {
    role: string;
    duuid: string;
}

export interface STUNConfig {
    server: string[];
}

export interface ViperP2PConfig {
    mqtt: MQTTConfig;
    http: HTTPConfig;
    stun: STUNConfig;
}

export interface DoorItem {
    name: string;
    "apt-address": string;
    "output-index": number;
    "secure-mode": boolean;
}

export interface OpenDoorAction {
    action: string;
    "apt-address": string;
    "output-index": number;
}

export interface BuildingConfig {
    description: string;
}