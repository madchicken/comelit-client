import axios from "axios";
import {
    DeviceIndex,
    DeviceData,
    STATUS_OFF,
    STATUS_ON,
    OBJECT_SUBTYPE,
    OBJECT_TYPE,
    HomeIndex, ON
} from "./types";
import { ROOT_ID } from "./comelit-client";

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

interface LightsStatus {
  life: number;
  domus: string;
  status: number[];
  val: number[];
}

const ANONYMOUS = 99;

export function getLightKey(index: number) {
    return `DOM#LT#${index}`;
}

function getZoneKey(index: number) {
    return `GEN#PL#${index}`;
}

export class BridgeClient {
  private readonly address: string;
  private readonly port: number;

  constructor(address: string, port: number) {
    this.address = address.startsWith("http://")
      ? address
      : `http://${address}`;
    this.port = port;
  }

  public init() {}

  async login(): Promise<boolean> {
    const info = await axios.get<LoginInfo>(
      `${this.address}:${this.port}/login.json`
    );
    return info.status === 200 && info.data.logged === ANONYMOUS;
  }

  async shutdown(): Promise<void> {
    return Promise.resolve();
  }

  async fecthHomeIndex(): Promise<HomeIndex> {
    const info = await axios.get<LightsInfo>(
      `${this.address}:${this.port}/icon_desc.json`,
      {
        params: {
          type: "light"
        }
      }
    );
    if (info.status === 200) {
      const data: LightsInfo = info.data;
      const rooms: DeviceIndex = new Map<string, DeviceData>();
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

  async updateHomeStatus(homeIndex: HomeIndex) {
    const info = await axios.get<LightsStatus>(`${this.address}:${this.port}/user/icon_status.json`, {
        params: {
            type: 'light',
        }
    });
    if (info.status === 200) {
        info.data.status.forEach((status, index) => {
            const id = getLightKey(index);
            const lightDeviceData = homeIndex.lightsIndex.get(id);
            if (lightDeviceData) {
                lightDeviceData.status = status === ON ? STATUS_ON : STATUS_OFF;
            }
        });
    }
    return null;
  }

  async toggleDeviceStatus(index: number, status: number, type?: string): Promise<boolean> {
      const resp = await axios.get(`${this.address}:${this.port}/user/action.cgi`, {
          params: {
              type: type || 'light',
              [`num${status}`]: index,
          }
      });
      return resp.status === 200;
  }
}
