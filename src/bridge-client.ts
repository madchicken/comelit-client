import axios from "axios";
import {DeviceData, DeviceIndex, HomeIndex, OBJECT_SUBTYPE, OBJECT_TYPE, ON, STATUS_OFF, STATUS_ON} from "./types";
import {ROOT_ID} from "./comelit-client";

export interface LoginInfo {
  domus: string;
  life: number;
  logged: number;
  rt_stat: number;
  old_auth: string;
  dataora: number;
  toolbar: string;
  icon_status: string;
}

interface LightsInfo {
  num: number;
  desc: string[];
  env: number[];
  status: number[];
  val: number[];
  type: number[];
  protected: number[];
  env_desc: string[];
}

interface DeviceStatus {
  life: number;
  domus: string;
  status: number[];
  val: number[];
}

const ANONYMOUS = 99;

export function getLightKey(index: number) {
  return `DOM#LT#${index}`;
}

export function getBlindKey(index: number) {
  return `DOM#BL#${index}`;
}

function getZoneKey(index: number) {
  return `GEN#PL#${index}`;
}

export class BridgeClient {
  private readonly address: string;

  constructor(address: string, port: number = 80) {
    this.address = address.startsWith("http://")
      ? `${address}:${port}`
      : `http://${address}:${port}`;
  }

  public init() {}

  async login(): Promise<boolean> {
    const info = await axios.get<LoginInfo>(
      `${this.address}/login.json`
    );
    return info.status === 200 && info.data.logged === ANONYMOUS;
  }

  async shutdown(): Promise<void> {
    return Promise.resolve();
  }

  async fecthHomeIndex(): Promise<HomeIndex> {
    const rooms: DeviceIndex = new Map<string, DeviceData>();
    const info = await this.fetchDeviceDesc('light');
    if (info.status === 200) {
      const data: LightsInfo = info.data;
      data.env_desc.forEach((desc, index) => {
        if (desc) {
          rooms.set(getZoneKey(index), {
            id: getZoneKey(index),
            objectId: getZoneKey(index),
            status: STATUS_OFF,
            type: OBJECT_TYPE.ZONE,
            sub_type: OBJECT_SUBTYPE.GENERIC_ZONE,
            descrizione: desc,
            elements: []
          });
        }
      }, rooms);

      data.desc.forEach((desc, index) => {
        const roomId = getZoneKey(data.env[index]);
        const room: DeviceData = rooms.get(roomId);
        room.elements.push({
          id: getLightKey(index),
          data: {
            id: getLightKey(index),
            objectId: `{index}`,
            status: data.status[index] === 1 ? STATUS_ON : STATUS_OFF,
            type: OBJECT_TYPE.LIGHT,
            sub_type:
              data.type[index] === 1
                ? OBJECT_SUBTYPE.TEMPORIZED_LIGHT
                : OBJECT_SUBTYPE.DIGITAL_LIGHT,
            descrizione: desc,
            isProtected: `${data.protected[index]}`,
            placeId: `${roomId}`
          }
        });
      });

      return new HomeIndex({
        id: ROOT_ID,
        objectId: ROOT_ID,
        status: STATUS_OFF,
        type: OBJECT_TYPE.ZONE,
        sub_type: OBJECT_SUBTYPE.GENERIC_ZONE,
        descrizione: "root",
        elements: [...rooms.values()].map(dd => ({ id: dd.id, data: dd }))
      });
    }
    return null;
  }

  private async fetchDeviceDesc(type: string) {
    return await axios.get<LightsInfo>(
        `${this.address}/icon_desc.json`,
        {
          params: {
            type
          }
        }
    );
  }

  async updateHomeStatus(homeIndex: HomeIndex) {
    let info = await this.fetchDevicesStatus('light');
    if (info.status === 200) {
      info.data.status.forEach((status, index) => {
        const id = getLightKey(index);
        const lightDeviceData = homeIndex.lightsIndex.get(id);
        if (lightDeviceData) {
          lightDeviceData.status = status === ON ? STATUS_ON : STATUS_OFF;
        }
      });
    }
    info = await this.fetchDevicesStatus('shutter');
    if (info.status === 200) {
      info.data.status.forEach((status, index) => {
        const id = getBlindKey(index);
        const blindDeviceData = homeIndex.blindsIndex.get(id);
        if (blindDeviceData) {
          blindDeviceData.status = status === ON ? STATUS_ON : STATUS_OFF;
        }
      });
    }
    return null;
  }

  async toggleDeviceStatus(
    index: number,
    status: number,
    type?: string
  ): Promise<boolean> {
    const resp = await axios.get(
      `${this.address}/user/action.cgi`,
      {
        params: {
          type: type || "light",
          [`num${status}`]: index
        }
      }
    );
    return resp.status === 200;
  }

  private async fetchDevicesStatus(type: string) {
    return await axios.get<DeviceStatus>(
        `${this.address}/user/icon_status.json`,
        {
          params: {
            type
          }
        }
    );
  }

}
