import { VedoClient } from '../vedo-client';
import nock from 'nock';

describe('vedo client', () => {
  it('should extract the cookie from the header when logging in', async () => {
    nock('http://localhost')
      .post('/login.cgi', 'code=12345678')
      .reply(200, {}, { 'Set-Cookie': 'uid=B7FE1B2544A473F4' });

    nock('http://localhost')
      .get('/login.json')
      .reply(200, {
        life: 0,
        logged: 1,
        rt_stat: 9,
        permission: [false, false],
      });

    const client = new VedoClient('localhost');
    const uid = await client.loginWithRetry('12345678');
    expect(uid).toBe('uid=B7FE1B2544A473F4');
  });

  it('should retrive active areas', async () => {
    nock('http://localhost')
      .get('/user/area_desc.json')
      .reply(200, {
        logged: 1,
        rt_stat: 9,
        vedo_auth: [0, 1],
        life: 1,
        present: [1, 0, 0, 0, 0, 0, 0, 0],
        description: ['RADAR', '', '', '', '', '', '', ''],
        p1_pres: [0, 0, 0, 0, 0, 0, 0, 0],
        p2_pres: [0, 0, 0, 0, 0, 0, 0, 0],
      });

    nock('http://localhost')
      .get('/user/area_stat.json')
      .reply(200, {
        logged: 1,
        rt_stat: 9,
        vedo_auth: [0, 1],
        life: 1,
        zone_open: 0,
        ready: [0, 0, 0, 0, 0, 0, 0, 0],
        armed: [0, 0, 0, 0, 0, 0, 0, 0],
        alarm: [0, 0, 0, 0, 0, 0, 0, 0],
        alarm_memory: [1, 0, 0, 0, 0, 0, 0, 0],
        sabotage: [0, 0, 0, 0, 0, 0, 0, 0],
        anomaly: [0, 0, 0, 0, 0, 0, 0, 0],
        in_time: [0, 0, 0, 0, 0, 0, 0, 0],
        out_time: [0, 0, 0, 0, 0, 0, 0, 0],
      });

    const client = new VedoClient('localhost');
    const areas = await client.findActiveAreas('uid=B7FE1B2544A473F4');
    expect(areas.length).toBe(1);
    expect(areas[0].description).toBe('RADAR');
    expect(areas[0].ready).toBe(true);
    expect(areas[0].triggered).toBe(false);
    expect(areas[0].armed).toBe(false);
  });

  it('should extract the cookie from the header when logging in with a different config', async () => {
    nock('http://localhost')
      .post('/user/login.cgi', 'alm=12345678')
      .reply(200, {}, { 'Set-Cookie': 'sid=B7FE1B2544A473F4' });

    nock('http://localhost')
      .get('/user/login.json')
      .reply(200, {
        life: 0,
        logged: 1,
        rt_stat: 9,
        permission: [false, false],
      });

    const client = new VedoClient('localhost', null, {
      login: '/user/login.cgi',
      code_param: 'alm',
      login_info: '/user/login.json',
    });
    const uid = await client.loginWithRetry('12345678');
    expect(uid).toBe('sid=B7FE1B2544A473F4');
  });
});
