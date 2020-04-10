import { doGet, sleep } from './utils';
import axios from "axios";

export interface LoginInfo {
  rt_stat: number;
  life: number;
  logged: number;
  vedo_auth: number[];
}

export interface AreaDesc extends LoginInfo {
  present: number[];
  p1_pres: number[];
  p2_pres: number[];
  description: string[];
}

export interface AlarmArea {
  index: number;
  description: string;
  ready: boolean;
  armed: boolean;
  triggered: boolean;
  sabotaged: boolean;
}

export interface AreaStatus extends LoginInfo {
  zone_open: number;
  ready: number[];
  armed: number[];
  alarm: number[];
  alarm_memory: number[];
  sabotage: number[];
  anomaly: number[];
  in_time: number[];
  out_time: number[];
}

export interface ZoneDesc extends LoginInfo {
  present: string;
  in_area: number[];
  description: string[];
}

export interface ZoneStatus {
  description: string;
  open: boolean;
  excluded: boolean;
  isolated: boolean;
  sabotated: boolean;
  alarm: boolean;
  inhibited: boolean;
}
const MAX_LOGIN_RETRY = 15;

export interface VedoClientConfig {
  login: string;
  login_info: string;
  area_desc: string;
  area_stat: string;
  zone_desc: string;
  zone_stat: string;
  action: string;
  code_param: string;
}

const DEFAULT_URL_CONFIG: VedoClientConfig = {
  login: '/login.cgi',
  login_info: '/login.json',
  area_desc: '/user/area_desc.json',
  area_stat: '/user/area_stat.json',
  zone_desc: '/user/zone_desc.json',
  zone_stat: '/user/zone_stat.json',
  action: '/action.cgi',
  code_param: 'code',
};

export class VedoClient {
  private readonly address: string;
  private readonly config: VedoClientConfig;

  constructor(address: string, port: number = 80, config: Partial<VedoClientConfig> = {}) {
    this.address = address.startsWith('http://') ? address : `http://${address}`;
    if (port && port !== 80) {
      this.address = `${this.address}:${port}`;
    }
    this.config = { ...DEFAULT_URL_CONFIG, ...config };
  }

  private async login(code: string): Promise<string> {
    const data = `${this.config.code_param}=${code}`;
    const resp = await axios.post<string>(
      `${this.address}${this.config.login}`,
      data
    );
    if (resp.status >= 200 && resp.status < 300 && resp.headers['set-cookie']) {
      return resp.headers['set-cookie'][0];
    }

    throw new Error('No cookie in header');
  }

  async logout(uid: string) {
    const data = `logout=1`;

    const resp = await axios.post<string>(
      `${this.address}${this.config.login}`,
      data,
      {
        headers: {
          Cookie: uid,
        }
      }
    );
    if (resp.status >= 200 && resp.status < 300) {
      return true;
    }

    throw new Error('Cannot logout');
  }

  async loginWithRetry(code: string): Promise<string> {
    let retry = 0;
    let uid = null;
    let logged = false;
    const l = async () => {
      try {
        if (!uid) {
          uid = await this.login(code);
        }
        console.debug('trying login with cookie ' + uid);
        logged = await this.isLogged(uid);
      } catch (e) {
        console.error(e.message);
      }
    };
    while (logged === false && retry < MAX_LOGIN_RETRY) {
      await l();
      if (logged === false && retry < MAX_LOGIN_RETRY) {
        console.log('not logged');
        retry++;
        await sleep(1000);
      } else {
        if (logged) {
          console.log('logged');
          return uid;
        }
      }
    }

    throw new Error('Cannot login');
  }

  async isLogged(uid: string): Promise<boolean> {
    try {
      const loginInfo: LoginInfo = await doGet<LoginInfo>(
        this.address,
        this.config.login_info,
        uid
      );
      return loginInfo.logged === 1;
    } catch (e) {
      console.error(e.message);
      return false;
    }
  }

  async areaDesc(uid: string): Promise<AreaDesc> {
    return await doGet<AreaDesc>(this.address, this.config.area_desc, uid);
  }

  async areaStatus(uid: string): Promise<AreaStatus> {
    return doGet<AreaStatus>(this.address, this.config.area_stat, uid);
  }

  async zoneDesc(uid: string): Promise<ZoneDesc> {
    return doGet(this.address, this.config.zone_desc, uid);
  }

  async zoneStatus(uid: string): Promise<ZoneStatus[]> {
    const page_list = [
      {
        hash: 'open',
        title: 'Aperte',
        bit_mask: 1,
        no_present: 'Nessuna zona aperta',
      },
      {
        hash: 'excluded',
        title: 'Escluse',
        bit_mask: 128,
        no_present: 'Nessuna zona esclusa',
      },
      {
        hash: 'isolated',
        title: 'Isolate',
        bit_mask: 256,
        no_present: 'Nessuna zona isolata',
      },
      {
        hash: 'sabotated',
        title: 'Sabotate/Guasto',
        bit_mask: 12,
        no_present: 'Nessuna zona sabotata/in guasto',
      },
      {
        hash: 'alarm',
        title: 'Allarme',
        bit_mask: 2,
        no_present: 'Nessuna zona in allarme',
      },
      {
        hash: 'inhibited',
        title: 'Inibite',
        bit_mask: 32768,
        no_present: 'Nessuna zona inibita',
      },
    ];

    const zones = await doGet(this.address, this.config.zone_desc, uid);
    const status = await doGet(this.address, this.config.zone_stat, uid);
    const statuses = status.status.split(',');
    return statuses
      .map((status, index) => {
        const stat = {
          description: zones.description[index],
        };
        page_list.forEach(
          o => (stat[o.hash] = (parseInt(status) & o.bit_mask) !== 0)
        );
        return stat;
      })
      .filter(zone => !zone.excluded);
  }

  async findActiveAreas(uid: string): Promise<AlarmArea[]> {
    const areaDesc = await this.areaDesc(uid);
    const areaStat = await this.areaStatus(uid);
    return areaDesc.present
      .map((areaNum, index) => {
        if (areaNum === 1) {
          return {
            index,
            description: areaDesc.description[index],
            armed: areaStat.armed[index] !== 0,
            ready: areaStat.ready[index] === 0,
            triggered: areaStat.alarm[index] !== 0,
            sabotaged: areaStat.sabotage[index] !== 0,
          };
        }
        return null;
      })
      .filter(a => a !== null);
  }

  async arm(uid: string, area: number) {
    const resp = await axios.get<any>(`${this.address}${this.config.action}`, {
      params: {
        force: '1',
        vedo: '1',
        tot: area,
        _: new Date().getTime(),
      },
      headers: {
        Cookie: uid,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: '*/*',
      }
    });
    if (resp.status === 200) {
      return resp.data;
    }
    throw new Error(`Unable to arm alarm: ${resp.statusText}`);
  }

  async disarm(uid: string, area: number) {
    const resp = await axios.get<any>(`${this.address}${this.config.action}`, {
      params: {
        force: '1',
        vedo: '1',
        dis: area,
        _: new Date().getTime(),
      },
      headers: {
        Cookie: uid,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: '*/*',
      }
    });
    if (resp.status === 200) {
      return resp.data;
    }
    throw new Error(`Unable to disarm alarm: ${resp.statusText}`);
  }

  async shutdown(uid: string) {
    return this.logout(uid);
  }
}
