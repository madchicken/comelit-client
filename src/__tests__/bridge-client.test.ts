import nock from 'nock';
import { BridgeClient } from '../bridge-client';

describe('Comelit Serial Bridge client', () => {
  it('should execute login', async () => {
    nock('http://localhost:8090')
      .get('/login.json')
      .reply(200, {
        domus: '100CC0C00CC0',
        life: 0,
        logged: 99,
        rt_stat: 0,
        old_auth: '000000000',
        dataora: 0,
        toolbar: '',
        icon_status: '001212200',
      });

    const client = new BridgeClient('localhost', 8090);
    const logged = await client.login();
    expect(logged).toBe(true);
  });
});
