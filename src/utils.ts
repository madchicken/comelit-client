import crypto, {BinaryLike} from "crypto";
import http, {IncomingMessage, RequestOptions} from "http";

export function generateUUID(data: BinaryLike) {
    const sha1sum = crypto.createHash('sha1');
    sha1sum.update(data);
    const s = sha1sum.digest('hex');
    let i = -1;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        i += 1;
        switch (c) {
            case 'y':
                return ((parseInt('0x' + s[i], 16) & 0x3) | 0x8).toString(16);
            case 'x':
            default:
                return s[i];
        }
    });
}

export function doGet<T = any>(address: string, path: string, uid: string): Promise<T> {
    const options: RequestOptions = {
        protocol: 'http:',
        host: `${address}`,
        method: 'GET',
        family: 4,
        path,
        headers: {
            Cookie: `uid=${uid}`,
            Referer: `http://${address}/user/index.htm`,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: '*/*',
        }
    };

    return new Promise<T>((resolve, reject) => {
        console.log(`Executing GET ${options.protocol}//${options.host}${path}`);
        const req = http.request(options, (res: IncomingMessage) => {
            let result = '';
            res.on('data', (chunk: string) => result += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    if (result) {
                        resolve(JSON.parse(result) as T);
                    } else {
                        resolve();
                    }
                } else {
                    reject(new Error(`Unknown error on GET ${options.host}${options.path}: ${res.statusCode}`));
                }
            });
            res.on('error', (err: Error) => reject(err));
        });
        req.on('error', (error: Error) => reject(error));
        req.end();
    });
}

export async function sleep(time) {
    return new Promise(
        resolve => setTimeout(() => resolve(), time)
    )
}
