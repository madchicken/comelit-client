import {ClimaMode, ThermoSeason} from './comelit-client';

export type DEVICE_STATUS = '0' | '1' | '2';

export interface DomoticData {
  id: string;
  type: OBJECT_TYPE;
  sub_type: OBJECT_SUBTYPE;
  sched_status?: DEVICE_STATUS;
  sched_lock?: string;
  schedZoneStatus?: number[];
  status: DEVICE_STATUS;
}

export interface DeviceData<T extends DeviceData = any> extends DomoticData {
  descrizione: string;
  placeOrder?: string;
  num_modulo?: string;
  num_uscita?: string;
  icon_id?: string;
  isProtected?: DEVICE_STATUS;
  objectId?: string;
  placeId?: string;
  powerst: DEVICE_STATUS;
  elements?: T[];
}

export interface DeviceInfo {
  id: string;
  data: DeviceData;
}

export interface OtherDeviceData extends DeviceData {
  tempo_uscita: string;
}

export interface LightDeviceData extends DeviceData {}

export interface BlindDeviceData extends DeviceData {
  open_status?: DEVICE_STATUS;
  position?: string;
  openTime?: string;
  closeTime?: string;
  preferPosition?: string;
  enablePreferPosition?: DEVICE_STATUS;
}

export interface OutletDeviceData extends DeviceData {
  instant_power: string;
  out_power: number;
}

export interface IrrigationDeviceData extends DeviceData {}

export interface ThermostatDeviceData extends DeviceData {
  num_ingresso?: number;
  num_moduloIE?: string;
  num_uscitaIE?: string;
  num_moduloI?: string;
  num_uscitaI?: string;
  num_moduloE?: string;
  num_uscitaE?: string;
  num_moduloI_ana?: string;
  num_uscitaI_ana?: string;
  num_moduloE_ana?: string;
  num_uscitaE_ana?: string;
  num_moduloUD?: string;
  num_uscitaUD?: string;
  num_moduloU?: string;
  num_uscitaU?: string;
  num_moduloD?: string;
  num_uscitaD?: string;
  num_moduloU_ana?: string;
  num_uscitaU_ana?: string;
  num_moduloD_ana?: string;
  num_uscitaD_ana?: string;
  night_mode?: string;
  soglia_man_inv?: string;
  soglia_man_est?: string;
  soglia_man_notte_inv?: string;
  soglia_man_notte_est?: string;
  soglia_semiauto?: string;
  soglia_auto_inv?: string;
  soglia_auto_est?: string;
  out_enable_inv?: DEVICE_STATUS;
  out_enable_est?: DEVICE_STATUS;
  dir_enable_inv?: DEVICE_STATUS;
  dir_enable_est?: DEVICE_STATUS;
  heatAutoFanDisable?: DEVICE_STATUS;
  coolAutoFanDisable?: DEVICE_STATUS;
  heatSwingDisable?: DEVICE_STATUS;
  coolSwingDisable?: DEVICE_STATUS;
  out_type_inv?: string;
  out_type_est?: string;
  temp_base_inv?: string;
  temp_base_est?: string;
  out_enable_umi?: string;
  out_enable_deumi?: string;
  dir_enable_umi?: string;
  dir_enable_deumi?: string;
  humAutoFanDisable?: string;
  dehumAutoFanDisable?: string;
  humSwingDisable?: string;
  dehumSwingDisable?: string;
  out_type_umi?: string;
  out_type_deumi?: string;
  soglia_man_umi?: string;
  soglia_man_deumi?: string;
  soglia_man_notte_umi?: string;
  soglia_man_notte_deumi?: string;
  night_mode_umi?: string;
  soglia_semiauto_umi?: string;
  umi_base_umi?: string;
  umi_base_deumi?: string;
  coolLimitMax?: string;
  coolLimitMin?: string;
  heatLimitMax?: string;
  heatLimitMin?: string;
  viewOnly?: string;
  temperatura?: string;
  auto_man?: ClimaMode;
  est_inv?: ThermoSeason;
  soglia_attiva?: string;
  out_value_inv?: string;
  out_value_est?: string;
  dir_out_inv?: string;
  dir_out_est?: string;
  semiauto_enabled?: string;
  umidita?: string;
  auto_man_umi?: ClimaMode;
  deumi_umi?: string;
  soglia_attiva_umi?: string;
  semiauto_umi_enabled?: string;
}

export interface SupplierDeviceData extends DeviceData {
  label_value: string;
  label_price: string;
  prod: string;
  count_div: string;
  cost: string;
  kCO2: string;
  compare: string;
  groupOrder: string;
  instant_power: string;
}

export type DeviceIndex<T = DeviceData> = Map<string, T>;

export enum OBJECT_TYPE {
  OTHER = 1,
  BLIND = 2,
  LIGHT = 3,
  IRRIGATION = 4,
  THERMOSTAT = 9,
  OUTLET = 10,
  POWER_SUPPLIER = 11,
  ZONE = 1001,
}

export enum OBJECT_SUBTYPE {
  GENERIC = 0,
  DIGITAL_LIGHT = 1,
  RGB_LIGHT = 2,
  TEMPORIZED_LIGHT = 3,
  DIMMER_LIGHT = 4,
  OTHER_DIGIT = 5,
  OTHER_TMP = 6,
  ELECTRIC_BLIND = 7,
  CLIMA_TERM = 12,
  GENERIC_ZONE = 13,
  CONSUMPTION = 15,
  CLIMA_THERMOSTAT_DEHUMIDIFIER = 16,
  CLIMA_DEHUMIDIFIER = 17,
  ENHANCED_ELECTRIC_BLIND = 31,
}

export const ON = 1;
export const OFF = 0;
export const OPEN = 1;
export const CLOSE = 0;
export const IDLE = 2;
export const STATUS_ON = '1';
export const STATUS_OFF = '0';
export const STATUS_OPEN = '1';
export const STATUS_CLOSED = '0';

export class HomeIndex {
  public readonly othersIndex: DeviceIndex<OtherDeviceData> = new Map<string, OtherDeviceData>();
  public readonly lightsIndex: DeviceIndex<LightDeviceData> = new Map<string, LightDeviceData>();
  public readonly roomsIndex: DeviceIndex = new Map() as DeviceIndex;
  public readonly thermostatsIndex: DeviceIndex<ThermostatDeviceData> = new Map<
    string,
    ThermostatDeviceData
  >();
  public readonly blindsIndex: DeviceIndex<BlindDeviceData> = new Map<string, BlindDeviceData>();
  public readonly outletsIndex: DeviceIndex<OutletDeviceData> = new Map<string, OutletDeviceData>();
  public readonly irrigationIndex: DeviceIndex<IrrigationDeviceData> = new Map<
    string,
    IrrigationDeviceData
  >();
  public readonly supplierIndex: DeviceIndex<SupplierDeviceData> = new Map<
    string,
    SupplierDeviceData
  >();
  public readonly unknownIndex: DeviceIndex = new Map<string, DeviceData>();

  public readonly mainIndex: DeviceIndex = new Map<string, Readonly<DeviceData>>();

  constructor(home: DeviceData, logger: ConsoleLike = console) {
    home.elements.forEach((info: DeviceInfo) => {
      this.visitElement(info);
      logger.debug(
        `Added home device with id: ${info.id}, type: ${info.data.type} (sub-type ${info.data.sub_type})`
      );
    });
  }

  get(id: string): DeviceData {
    return this.mainIndex.get(id);
  }

  updateObject(id: string, data: Readonly<DeviceData>): DeviceData {
    if (this.mainIndex.has(id)) {
      const deviceData = this.mainIndex.get(id);
      const value = { ...deviceData, ...data };
      this.mainIndex.set(id, Object.freeze(value));
      return value;
    }
    return null;
  }

  private visitElement(element: DeviceInfo) {
    switch (element.data.type) {
      case OBJECT_TYPE.OTHER:
        this.othersIndex.set(element.id, element.data as OtherDeviceData);
        break;
      case OBJECT_TYPE.LIGHT:
        this.lightsIndex.set(element.id, element.data as LightDeviceData);
        break;
      case OBJECT_TYPE.ZONE:
        this.roomsIndex.set(element.id, element.data);
        break;
      case OBJECT_TYPE.THERMOSTAT:
        this.thermostatsIndex.set(element.id, element.data as ThermostatDeviceData);
        break;
      case OBJECT_TYPE.BLIND:
        this.blindsIndex.set(element.id, element.data as BlindDeviceData);
        break;
      case OBJECT_TYPE.OUTLET:
        this.outletsIndex.set(element.id, element.data as OutletDeviceData);
        break;
      case OBJECT_TYPE.POWER_SUPPLIER:
        this.supplierIndex.set(element.id, element.data as SupplierDeviceData);
        break;
      case OBJECT_TYPE.IRRIGATION:
        this.irrigationIndex.set(element.id, element.data as IrrigationDeviceData);
        break;
      default:
        this.unknownIndex.set(element.id, element.data);
    }

    if (this.mainIndex.has(element.id)) {
      console.warn(`Overwriting element with key ${element.id} in index!`);
    }
    this.mainIndex.set(element.id, element.data);

    if (element.data.elements) {
      element.data.elements.forEach(value => this.visitElement(value));
    }
  }
}

export interface ConsoleLike {
  log: (message?: any, ...optionalParams: any[]) => void;
  info: (message?: any, ...optionalParams: any[]) => void;
  warn: (message?: any, ...optionalParams: any[]) => void;
  debug: (message?: any, ...optionalParams: any[]) => void;
  error: (message?: any, ...optionalParams: any[]) => void;
}

// ICONA types

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ViperChannelType = {
  SERVER_INFO: 20,
  PUSH: 2,
  UAUT: 2,
  UCFG: 3,
  CTPP: 7,
  CSPB: 8,
};

/*
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const allConfigExample: ConfigurationResponse = {
  message: 'get-configuration',
  'message-type': 'response',
  'message-id': 3,
  'response-code': 200,
  'response-string': 'OK',
  'viper-server': <ViperServer>{
    'local-address': '192.168.0.66',
    'local-tcp-port': 64100,
    'local-udp-port': 64100,
    'remote-address': '',
    'remote-tcp-port': 64100,
    'remote-udp-port': 64100,
  },
  'viper-client': <ViperClient>{description: 'SU0EG'},
  'viper-p2p': {
    mqtt: <MQTTConfig>{
      role: 'a',
      base: 'HSrv/0025291701EC/vip/COMHUB01/sdp',
      server: 'tls://hub-vip3.cloud.comelitgroup.com:443',
      auth: {method: ['CCS_TOKEN', 'CCS_DEVICE']},
    },
    http: <HTTPConfig>{role: 'a', duuid: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'},
    stun: <STUNConfig>{
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
        <DoorItem>{name: 'CANCELLO', 'apt-address': '00000100', 'output-index': 2, 'secure-mode': false},
      ],
      'opendoor-actions': [<OpenDoorAction>{action: 'peer', 'apt-address': '', 'output-index': 1}],
    },
  },
  'building-config': <BuildingConfig>{description: 'your building'},
};
*/
