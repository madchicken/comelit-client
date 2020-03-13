import http, {IncomingMessage, RequestOptions} from "http";
import {doGet, sleep} from "./utils";

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

const MAX_LOGIN_RETRY = 15;

export class VedoClient {
    private readonly address: string;

    constructor(address: string) {
        this.address = address;
    }

    private async login(code: string): Promise<string> {
        const data = `code=${code}`;

        const options: RequestOptions = {
            protocol: 'http:',
            host: this.address,
            path: '/login.cgi',
            method: 'POST',
            family: 4,
            headers: {
                'Content-Length': data.length,
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };

        return new Promise<string>((resolve, reject) => {
            const req = http.request(options, (res: IncomingMessage) => {
                let result = '';
                res.on('data', (chunk: string) => result += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        const header = res.headers["set-cookie"];
                        if (header) {
                            const uid = header[0].split('=')[1];
                            resolve(uid);
                        } else {
                            console.log('No cookie, retrying...');
                            reject(new Error('No cookie in header'));
                        }
                    } else {
                        reject(`Unknown error: ${res.statusCode}`);
                    }
                });
                res.on('error', err => reject(err));
            });
            req.on('error', (error: Error) => reject(error));
            req.write(data);
            req.end();
        });
    }

    async logout(uid: string) {
        const data = `logout=1`;

        const options: RequestOptions = {
            protocol: 'http:',
            host: this.address,
            path: '/login.cgi',
            method: 'POST',
            family: 4,
            headers: {
                Cookie: `uid=${uid}`,
                'Content-Length': data.length,
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };

        return new Promise<boolean>((resolve, reject) => {
            const req = http.request(options, (res: IncomingMessage) => {
                let result = '';
                res.on('data', (chunk: string) => result += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(true);
                    } else {
                        reject(`Unknown error: ${res.statusCode}`);
                    }
                });
                res.on('error', err => reject(err));
            });
            req.on('error', (error: Error) => reject(error));
            req.write(data);
            req.end();
        });

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
                console.log('trying login with uid ' + uid);
                logged = await this.isLogged(uid);
            } catch (e) {
                console.error(e);
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
            const loginInfo: LoginInfo = await doGet<LoginInfo>(this.address, '/login.json', uid);
            return loginInfo.logged === 1;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    async areaDesc(uid: string): Promise<AreaDesc> {
        return await doGet<AreaDesc>(this.address, '/user/area_desc.json', uid);
    }

    async areaStatus(uid: string): Promise<AreaStatus> {
        return doGet<AreaStatus>(this.address, '/user/area_stat.json', uid);
    }

    async zoneDesc(uid: string): Promise<any> {
        return doGet(this.address, '/user/zone_desc.json', uid);
    }

    async zoneStatus(uid: string): Promise<any> {
        const page_list = [
            {hash: 'open', title: 'Aperte', bit_mask: 1, no_present: 'Nessuna zona aperta'},
            {hash: 'excluded', title: 'Escluse', bit_mask: 128, no_present: 'Nessuna zona esclusa'},
            {hash: 'isolated', title: 'Isolate', bit_mask: 256, no_present: 'Nessuna zona isolata'},
            {hash: 'sabotated', title: 'Sabotate/Guasto', bit_mask: 12, no_present: 'Nessuna zona sabotata/in guasto'},
            {hash: 'alarm', title: 'Allarme', bit_mask: 2, no_present: 'Nessuna zona in allarme'},
            {hash: 'inhibited', title: 'Inibite', bit_mask: 32768, no_present: 'Nessuna zona inibita'}
        ];

        const zones = await doGet(this.address, '/user/zone_desc.json', uid);
        const status = await doGet(this.address, '/user/zone_stat.json', uid);
        const statuses = status.status.split(',');
        return statuses.map((status, index) => {
            const stat = {
                description: zones.description[index],
            };
            page_list.forEach(o => stat[o.hash] = (parseInt(status) & o.bit_mask) !== 0);
            return stat;
        }).filter(zone => !zone.excluded);
    }

    async findActiveAreas(uid: string): Promise<AlarmArea[]> {
        const areaDesc = await this.areaDesc(uid);
        const areaStat = await this.areaStatus(uid);
        return areaDesc.present.map((areaNum, index) => {
            if (areaNum === 1) {
                return {
                    index,
                    description: areaDesc.description[index],
                    armed: areaStat.armed[index] !== 0,
                    ready: areaStat.ready[index] === 0,
                    triggered: areaStat.alarm[index] !== 0,
                }
            }
            return null;
        }).filter(a => a !== null);
    }

    async arm(uid: string, area: number) {
        return doGet(this.address, `/action.cgi?force=1&vedo=1&tot=${area}&_=${new Date().getTime()}`, uid);
    }

    async disarm(uid: string, area: number) {
        return doGet(this.address, `/action.cgi?force=1&vedo=1&dis=${area}&_=${new Date().getTime()}`, uid);
    }

    async shutdown(uid: string) {
        return this.logout(uid);
    }
}
