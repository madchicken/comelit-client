import { ClimaMode, ThermoSeason } from './comelit-client';

export interface DomoticData {
  id: string;
  type: number;
  sub_type: number;
  sched_status?: string;
  sched_lock?: string;
  status: string;
}

export interface DeviceData extends DomoticData {
  descrizione: string;
  placeOrder?: string;
  num_modulo?: string;
  num_uscita?: string;
  icon_id?: string;
  isProtected?: string;
  objectId?: string;
  placeId?: string;
  elements?: DeviceInfo[];
}

export interface DeviceInfo {
  id: string;
  data: DeviceData;
}

export interface LightDeviceData extends DeviceData {}

export interface BlindDeviceData extends DeviceData {
  tempo_uscita: number;
  open_status?: number;
}

export interface OutletDeviceData extends DeviceData {
  instant_power: string;
  out_power: number;
}

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
  out_enable_inv?: string;
  out_enable_est?: string;
  dir_enable_inv?: string;
  dir_enable_est?: string;
  heatAutoFanDisable?: string;
  coolAutoFanDisable?: string;
  heatSwingDisable?: string;
  coolSwingDisable?: string;
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
  BLIND = 2,
  LIGHT = 3,
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
  ELECTRIC_BLIND = 7,
  CLIMA_TERM = 12,
  GENERIC_ZONE = 13,
  CONSUMPTION = 15,
  CLIMA_THERMOSTAT_DEHUMIDIFIER = 16,
  CLIMA_DEHUMIDIFIER = 17,
}

export const ON = 1;
export const OFF = 0;
export const IDLE = 2;
export const STATUS_ON = '1';
export const STATUS_OFF = '0';

export class HomeIndex {
  public readonly lightsIndex: DeviceIndex<LightDeviceData> = new Map<string, LightDeviceData>();
  public readonly roomsIndex: DeviceIndex = new Map() as DeviceIndex;
  public readonly thermostatsIndex: DeviceIndex<ThermostatDeviceData> = new Map<
    string,
    ThermostatDeviceData
  >();
  public readonly blindsIndex: DeviceIndex<BlindDeviceData> = new Map<string, BlindDeviceData>();
  public readonly outletsIndex: DeviceIndex<OutletDeviceData> = new Map<string, OutletDeviceData>();
  public readonly supplierIndex: DeviceIndex<SupplierDeviceData> = new Map<
    string,
    SupplierDeviceData
  >();

  public readonly mainIndex: DeviceIndex = new Map<string, Readonly<DeviceData>>();

  constructor(home: DeviceData) {
    home.elements.forEach((info: DeviceInfo) => {
      this.visitElement(info);
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
