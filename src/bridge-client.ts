import axios from "axios";
import {DeviceIndex, DeviceData} from "./types";
import {OBJECT_SUBTYPE, OBJECT_TYPE, ROOT_ID, STATUS_OFF, STATUS_ON} from "./comelit-client";

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

const ANONYMOUS = 99;

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

  async getRoot(): Promise<DeviceData> {
    const info = await axios.get<LightsInfo>(
      `${this.address}:${this.port}/icon_desc.json`,
      {
        params: {
          type: "light",
          _: new Date().getTime()
        }
      }
    );
    if (info.status === 200) {
        const data: LightsInfo = info.data;
        const rooms: DeviceIndex = new Map<string, DeviceData>();
        data.env_desc.forEach((desc, index) => {
            if (desc) {
                rooms.set(`GEN#PL#${index}`, {
                    id: `GEN#PL#${index}`,
                    objectId: `GEN#PL#${index}`,
                    status: STATUS_OFF,
                    type: OBJECT_TYPE.ZONE,
                    sub_type: OBJECT_SUBTYPE.GENERIC_ZONE,
                    descrizione: desc,
                    elements: [],
                });
            }
        }, rooms);

        data.desc.forEach((desc, index) => {
            const roomId = `GEN#PL#${data.env[index]}`;
            const room: DeviceData = rooms.get(roomId);
            room.elements.push({
                id: `DOM#LT#${index}`,
                data: {
                    id: `DOM#LT#${index}`,
                    objectId: `DOM#LT#${index}`,
                    status: data.status[index] === 1 ? STATUS_ON : STATUS_OFF,
                    type: OBJECT_TYPE.LIGHT,
                    sub_type: data.type[index] === 1 ? OBJECT_SUBTYPE.TEMPORIZED_LIGHT : OBJECT_SUBTYPE.DIGITAL_LIGHT,
                    descrizione: desc,
                    isProtected: `${data.protected[index]}`,
                    placeId: `${roomId}`,
                }
            });
        });

        return {
            id: ROOT_ID,
            objectId: ROOT_ID,
            status: STATUS_OFF,
            type: OBJECT_TYPE.ZONE,
            sub_type: OBJECT_SUBTYPE.GENERIC_ZONE,
            descrizione: 'root',
            elements: [...rooms.values()].map(dd => ({id: dd.id, data: dd})),
        };
    }
    return null;
  }
}
