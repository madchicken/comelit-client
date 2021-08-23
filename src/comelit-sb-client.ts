import axios from 'axios';
import {
  ConsoleLike,
  DEVICE_STATUS,
  DeviceData,
  DeviceIndex,
  HomeIndex,
  OBJECT_SUBTYPE,
  OBJECT_TYPE,
  ON,
  STATUS_OFF,
  STATUS_ON,
  ThermostatDeviceData,
} from './types';
import { ClimaMode, ClimaOnOff, ROOT_ID, ThermoSeason } from './comelit-client';
import * as https from 'https';

export interface BridgeLoginInfo {
  domus: string;
  life: number;
  logged: number;
  rt_stat: number;
  old_auth: string;
  dataora: number;
  toolbar: string;
  icon_status: string;
}

interface DeviceInfo {
  num: number;
  desc: string[];
  env: number[];
  status: number[];
  val: number[] | any[][][];
  type: number[];
  protected: number[];
  env_desc: string[];
}

interface DeviceStatus {
  life: number;
  domus: string;
  status: number[];
  val: number[] | any[][][];
}

const ANONYMOUS = 99;

export function getLightKey(index: number) {
  return `DOM#LT#${index}`;
}

export function getBlindKey(index: number) {
  return `DOM#BL#${index}`;
}

export function getClimaKey(index: number) {
  return `DOM#CL#${index}`;
}

export function getOtherKey(index: number) {
  return `DOM#LC#${index}`;
}

export function getZoneKey(index: number) {
  return `GEN#PL#${index}`;
}

function updateClima(value: any[][], thermostatData: ThermostatDeviceData) {
  const [thermo, dehumidifier] = value;
  if (thermo) {
    const state = thermo[2]; // can be U, L, O
    const mode = thermo[3]; // can be M, A

    thermostatData.temperatura = thermo[0];
    switch (mode) {
      case 'M':
        thermostatData.auto_man = state === 'O' ? ClimaMode.OFF_MANUAL : ClimaMode.MANUAL;
        break;
      case 'A':
        thermostatData.auto_man = state === 'O' ? ClimaMode.OFF_AUTO : ClimaMode.AUTO;
        break;
    }
    thermostatData.soglia_attiva = thermo[4];

    if (state === 'L') {
      thermostatData.est_inv = ThermoSeason.SUMMER;
    } else if (state === 'U') {
      thermostatData.est_inv = ThermoSeason.WINTER;
    }
  }

  if (dehumidifier) {
    thermostatData.umidita = dehumidifier[0];
    const state = dehumidifier[2]; // can be U, L, O
    const mode = dehumidifier[3]; // can be M, A

    thermostatData.umidita = dehumidifier[0];
    switch (mode) {
      case 'M':
        thermostatData.auto_man_umi = state === 'O' ? ClimaMode.OFF_MANUAL : ClimaMode.MANUAL;
        break;
      case 'A':
        thermostatData.auto_man_umi = state === 'O' ? ClimaMode.OFF_AUTO : ClimaMode.AUTO;
        break;
    }
    thermostatData.soglia_attiva_umi = dehumidifier[4];

    if (state === 'L') {
      thermostatData.est_inv = ThermoSeason.SUMMER;
    } else if (state === 'U') {
      thermostatData.est_inv = ThermoSeason.WINTER;
    }

    thermostatData.soglia_attiva_umi = dehumidifier[4];
  }
}

export class ComelitSbClient {
  private readonly address: string;
  private readonly onUpdate: (objId: string, device: DeviceData) => void;
  private readonly log: ConsoleLike;

  constructor(
    address: string,
    port: number = 80,
    onUpdate?: (objId: string, device: DeviceData) => void,
    log?: ConsoleLike
  ) {
    this.address =
      address.startsWith('http://') || address.startsWith('https://')
        ? `${address}:${port}`
        : `http://${address}:${port}`;
    this.onUpdate = onUpdate;
    this.log = log || console;
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    axios.defaults.httpsAgent = agent;
  }

  async login(): Promise<boolean> {
    const info = await axios.get<BridgeLoginInfo>(`${this.address}/login.json`);
    return info.status === 200 && info.data.logged === ANONYMOUS;
  }

  async shutdown(): Promise<void> {
    return Promise.resolve();
  }

  async fetchHomeIndex(): Promise<HomeIndex> {
    const rooms: DeviceIndex = new Map<string, DeviceData>();
    let data: DeviceInfo = await this.fetchDeviceDesc('light');
    data.env_desc.forEach((desc, index) => {
      rooms.set(getZoneKey(index), {
        id: getZoneKey(index),
        objectId: `${index}`,
        status: STATUS_OFF,
        powerst: STATUS_OFF,
        type: OBJECT_TYPE.ZONE,
        sub_type: OBJECT_SUBTYPE.GENERIC_ZONE,
        descrizione: desc || 'Root',
        elements: [],
      });
    }, rooms);
    if (data && data.desc) {
      data.desc.forEach((desc, index) => {
        const roomId = getZoneKey(data.env[index]);
        const room: DeviceData = rooms.get(roomId);
        room.elements.push({
          id: getLightKey(index),
          data: {
            id: getLightKey(index),
            objectId: `${index}`,
            status: data.status[index] === 1 ? STATUS_ON : STATUS_OFF,
            type: OBJECT_TYPE.LIGHT,
            sub_type:
              data.type[index] === 1
                ? OBJECT_SUBTYPE.TEMPORIZED_LIGHT
                : OBJECT_SUBTYPE.DIGITAL_LIGHT,
            descrizione: desc,
            isProtected: `${data.protected[index]}`,
            placeId: `${roomId}`,
          },
        });
      });
    }

    data = await this.fetchDeviceDesc('shutter');
    if (data && data.desc) {
      data.desc.forEach((desc, index) => {
        const roomId = getZoneKey(data.env[index]);
        const room: DeviceData = rooms.get(roomId);
        room.elements.push({
          id: getBlindKey(index),
          data: {
            id: getBlindKey(index),
            objectId: `${index}`,
            status: data.status[index] === 1 ? STATUS_ON : STATUS_OFF,
            type: OBJECT_TYPE.BLIND,
            sub_type: OBJECT_SUBTYPE.ELECTRIC_BLIND,
            descrizione: desc,
            isProtected: `${data.protected[index]}`,
            placeId: `${roomId}`,
          },
        });
      });
    }

    data = await this.fetchDeviceDesc('clima');
    if (data && data.desc) {
      data.desc.forEach((desc, index) => {
        const roomId = getZoneKey(data.env[index]);
        const room: DeviceData = rooms.get(roomId);
        const value = data.val[index] as any[];
        const thermostatData: ThermostatDeviceData = {
          id: getClimaKey(index),
          objectId: `${index}`,
          status: data.status[index] === 1 ? STATUS_ON : STATUS_OFF,
          powerst: data.status[index] === 1 ? STATUS_ON : STATUS_OFF,
          type: OBJECT_TYPE.THERMOSTAT,
          sub_type:
            data.type[index] >= 11 && data.type[index] <= 14 && data.type[index] !== 12
              ? OBJECT_SUBTYPE.CLIMA_THERMOSTAT_DEHUMIDIFIER
              : OBJECT_SUBTYPE.CLIMA_TERM,
          descrizione: desc,
          isProtected: `${data.protected[index]}` as DEVICE_STATUS,
          placeId: `${roomId}`,
        };
        updateClima(value, thermostatData);
        room.elements.push({
          id: getClimaKey(index),
          data: thermostatData,
        });
      });
    }

    data = await this.fetchDeviceDesc('other');
    if (data && data.desc) {
      data.desc.forEach((desc, index) => {
        const roomId = getZoneKey(data.env[index]);
        const room: DeviceData = rooms.get(roomId);
        room.elements.push({
          id: getOtherKey(index),
          data: {
            id: getOtherKey(index),
            objectId: `${index}`,
            status: data.status[index] === 1 ? STATUS_ON : STATUS_OFF,
            type: OBJECT_TYPE.OUTLET,
            sub_type: OBJECT_SUBTYPE.CONSUMPTION,
            descrizione: desc,
            isProtected: `${data.protected[index]}`,
            placeId: `${roomId}`,
          },
        });
      });
    }

    return new HomeIndex({
      id: ROOT_ID,
      objectId: ROOT_ID,
      status: STATUS_OFF,
      powerst: STATUS_OFF,
      type: OBJECT_TYPE.ZONE,
      sub_type: OBJECT_SUBTYPE.GENERIC_ZONE,
      descrizione: 'root',
      elements: [...rooms.values()].map(dd => ({ id: dd.id, data: dd })),
    });
  }

  private async fetchDeviceDesc(type: string): Promise<DeviceInfo> {
    const resp = await axios.get<DeviceInfo>(`${this.address}/user/icon_desc.json`, {
      params: {
        type,
      },
    });
    if (resp.status === 200) {
      return resp.data;
    }

    throw new Error(`Unable to fetch description data for ${type}`);
  }

  async updateHomeStatus(homeIndex: HomeIndex) {
    if (homeIndex.lightsIndex.size > 0) {
      const info = await this.fetchDevicesStatus('light');
      if (info.status === 200) {
        info.data.status.forEach((status, index) => {
          const id = getLightKey(index);
          const deviceData = homeIndex.lightsIndex.get(id);
          if (deviceData) {
            const updatedStatus = status === ON ? STATUS_ON : STATUS_OFF;
            if (updatedStatus !== deviceData.status) {
              deviceData.status = updatedStatus;
              this.updateSingleDevice(homeIndex, id, deviceData);
            }
          }
        });
      }
    }
    if (homeIndex.blindsIndex.size > 0) {
      const info = await this.fetchDevicesStatus('shutter');
      if (info.status === 200) {
        info.data.status.forEach((status, index) => {
          const id = getBlindKey(index);
          const deviceData = homeIndex.blindsIndex.get(id);
          if (deviceData) {
            const updatedStatus = `${status}`; // can be 0, 1 or 2
            if (updatedStatus !== deviceData.status) {
              deviceData.status = updatedStatus as DEVICE_STATUS;
              this.updateSingleDevice(homeIndex, id, deviceData);
            }
          }
        });
      }
    }
    if (homeIndex.outletsIndex.size > 0) {
      const info = await this.fetchDevicesStatus('other');
      if (info.status === 200) {
        info.data.status.forEach((status, index) => {
          const id = getOtherKey(index);
          const deviceData = homeIndex.outletsIndex.get(id);
          if (deviceData) {
            const updatedStatus = status === ON ? STATUS_ON : STATUS_OFF;
            if (updatedStatus !== deviceData.status) {
              deviceData.status = updatedStatus;
              this.updateSingleDevice(homeIndex, id, deviceData);
            }
          }
        });
      }
    }
    if (homeIndex.thermostatsIndex.size > 0) {
      const info = await this.fetchDevicesStatus('clima');
      if (info.status === 200) {
        info.data.status.forEach((status, index) => {
          const id = getClimaKey(index);
          const deviceData = homeIndex.thermostatsIndex.get(id);
          if (deviceData) {
            const value = info.data.val[index] as any[][];
            deviceData.status = `${status}` as DEVICE_STATUS;
            updateClima(value, deviceData);
            this.updateSingleDevice(homeIndex, id, deviceData);
          }
        });
      }
    }
    return homeIndex;
  }

  private updateSingleDevice(homeIndex: HomeIndex, id: string, deviceData: ThermostatDeviceData) {
    const newData = homeIndex.updateObject(id, deviceData);
    if (this.onUpdate && typeof this.onUpdate === 'function') {
      this.onUpdate(id, newData);
    }
  }

  async toggleDeviceStatus(index: number, status: number, type?: string): Promise<boolean> {
    const resp = await axios.get(`${this.address}/user/action.cgi`, {
      params: {
        type: type || 'light',
        [`num${status}`]: index,
      },
    });
    return resp.status === 200;
  }

  async setTemperature(clima: number, temperature: number): Promise<boolean> {
    const resp = await axios.get(`${this.address}/user/action.cgi`, {
      params: {
        clima,
        thermo: 'set',
        val: temperature,
      },
    });
    return resp.status === 200;
  }

  async switchThermostatMode(clima: number, mode: ClimaMode): Promise<boolean> {
    let thermo = null;
    if (mode) {
      switch (mode) {
        case ClimaMode.AUTO:
          thermo = 'auto';
          break;
        case ClimaMode.MANUAL:
          thermo = 'man';
          break;
        case ClimaMode.OFF_AUTO:
        case ClimaMode.OFF_MANUAL:
          return this.toggleHumidifierStatus(clima, ClimaOnOff.OFF_THERMO);
      }
    }

    const resp = await axios.get(`${this.address}/user/action.cgi`, {
      params: {
        clima,
        thermo,
      },
    });
    return resp.status === 200;
  }

  async switchThermostatSeason(clima: number, season: ThermoSeason): Promise<boolean> {
    const resp = await axios.get(`${this.address}/user/action.cgi`, {
      params: {
        clima,
        thermo: season === ThermoSeason.WINTER ? 'upper' : 'lower',
      },
    });
    return resp.status === 200;
  }

  async setHumidity(humi: number, humidity: number): Promise<boolean> {
    const resp = await axios.get(`${this.address}/user/action.cgi`, {
      params: {
        humi,
        thermo: 'set',
        val: humidity,
      },
    });
    return resp.status === 200;
  }

  async switchHumidifierMode(humi: number, mode: ClimaMode): Promise<boolean> {
    let thermo = null;
    if (mode) {
      switch (mode) {
        case ClimaMode.AUTO:
          thermo = 'auto';
          break;
        case ClimaMode.MANUAL:
          thermo = 'man';
          break;
        case ClimaMode.OFF_AUTO:
        case ClimaMode.OFF_MANUAL:
          return this.toggleHumidifierStatus(humi, ClimaOnOff.OFF_THERMO);
      }
    }

    const resp = await axios.get(`${this.address}/user/action.cgi`, {
      params: {
        humi,
        thermo,
      },
    });
    return resp.status === 200;
  }

  async toggleThermostatStatus(clima: number, mode: ClimaOnOff): Promise<boolean> {
    const resp = await axios.get(`${this.address}/user/action.cgi`, {
      params: {
        clima,
        thermo: mode === ClimaOnOff.ON_THERMO ? 'on' : 'off',
      },
    });
    return resp.status === 200;
  }

  async toggleHumidifierStatus(humi: number, mode: ClimaOnOff): Promise<boolean> {
    const resp = await axios.get(`${this.address}/user/action.cgi`, {
      params: {
        humi,
        thermo: mode === ClimaOnOff.ON_HUMI ? 'on' : 'off',
      },
    });
    return resp.status === 200;
  }

  private async fetchDevicesStatus(type: string) {
    return await axios.get<DeviceStatus>(`${this.address}/user/icon_status.json`, {
      params: {
        type,
      },
    });
  }
}
