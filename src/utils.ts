import crypto, { BinaryLike } from 'crypto';
import axios from 'axios';

// See https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
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

axios.defaults.timeout = 3000;

export async function doGet<T = any>(
  address: string,
  path: string,
  uid: string,
  params: any = null
): Promise<T> {
  const resp = await axios.get<any>(`${address}${path}`, {
    params,
    headers: {
      Cookie: uid,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: '*/*',
    },
  });
  if (resp.status >= 200 && resp.status < 300) {
    return resp.data;
  }
  throw new Error(`Unable to GET data: ${resp.statusText}`);
}

export async function sleep(time) {
  return new Promise((resolve) => setTimeout(() => resolve(), time));
}
