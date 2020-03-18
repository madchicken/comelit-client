import nock from "nock";
import { BridgeClient } from "../bridge-client";
import { STATUS_OFF, STATUS_ON } from "../types";

function mockLightIconDesc() {
  nock("http://localhost:8090")
    .get("/icon_desc.json?type=light")
    .reply(200, {
      num: 21,
      desc: [
        "Faretti ingresso",
        "Soffitto",
        "Presa Angolo",
        "Presa Parete",
        "Soffitto",
        "Luci pensili",
        "Faretti",
        "Soffitto",
        "Prese Comandate",
        "Soffitto",
        "Prese Comandate",
        "Soffitto",
        "Presa Comandata",
        "Armadio dx",
        "Armadio sx",
        "Soffitto",
        "Specchio",
        "Soffitto",
        "Specchio",
        "Led doccia",
        "Terrazzo"
      ],
      env: [1, 1, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 6, 6, 7, 7, 8, 8, 8, 9],
      status: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      val: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      type: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      protected: [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      env_desc: [
        "",
        "Salotto",
        "Cucina",
        "Corridoio notte",
        "Camera 1",
        "Camera 2",
        "Matrimoniale",
        "Bagno Giorno",
        "Bagno Notte",
        "Terrazzo"
      ]
    });
}

function mockShutterIconDesc() {
  nock("http://localhost:8090")
    .get("/icon_desc.json?type=shutter")
    .reply(200, {
      num: 10,
      desc: [
        "Salotto dx",
        "Salotto sx",
        "Cucina",
        "Camera 1",
        "Camera 2 dx",
        "Camera 2 sx",
        "Matrimoniale Fronte",
        "Matrimoniale Retro",
        "Bagno Giorno",
        "Bagno Notte"
      ],
      env: [1, 1, 2, 4, 5, 5, 6, 6, 7, 8],
      status: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      val: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      type: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      protected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      env_desc: [
        "",
        "Salotto",
        "Cucina",
        "Corridoio notte",
        "Camera 1",
        "Camera 2",
        "Matrimoniale",
        "Bagno Giorno",
        "Bagno Notte",
        "Terrazzo"
      ]
    });
}

describe("Comelit Serial Bridge client", () => {
  it("should execute login", async () => {
    nock("http://localhost:8090")
      .get("/login.json")
      .reply(200, {
        domus: "100CC0C00CC0",
        life: 0,
        logged: 99,
        rt_stat: 0,
        old_auth: "000000000",
        dataora: 0,
        toolbar: "",
        icon_status: "001212200"
      });

    const client = new BridgeClient("localhost", 8090);
    const logged = await client.login();
    expect(logged).toBe(true);
  });

  it("should read house structure", async () => {
    mockLightIconDesc();
    mockShutterIconDesc();

    const client = new BridgeClient("localhost", 8090);
    const homeIndex = await client.fecthHomeIndex();
    expect(homeIndex).toBeDefined();
    expect(homeIndex.roomsIndex.size).toBe(9);
    expect(homeIndex.blindsIndex.size).toBe(10);
    expect(homeIndex.lightsIndex.get(`DOM#LT#0`).status).toBe(STATUS_ON);
    expect(homeIndex.lightsIndex.get(`DOM#LT#1`).status).toBe(STATUS_ON);
    expect(homeIndex.lightsIndex.get(`DOM#LT#2`).status).toBe(STATUS_OFF);
  });

  it("should update the status of index", async () => {
    mockLightIconDesc();
    mockShutterIconDesc();

    nock("http://localhost:8090")
      .get("/user/icon_status.json?type=light")
      .reply(200, {
        life: 1,
        domus: "10CC0CC00C00",
        status: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        val: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      });

    nock("http://localhost:8090")
      .get("/user/icon_status.json?type=shutter")
      .reply(200, {
        life: 1,
        domus: "10CC0CC00C00",
        status: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        val: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      });

    const client = new BridgeClient("localhost", 8090);
    const homeIndex = await client.fecthHomeIndex();
    await client.updateHomeStatus(homeIndex);
    expect(homeIndex.lightsIndex.get(`DOM#LT#0`).status).toBe(STATUS_ON);
    expect(homeIndex.lightsIndex.get(`DOM#LT#1`).status).toBe(STATUS_OFF);
    expect(homeIndex.lightsIndex.get(`DOM#LT#2`).status).toBe(STATUS_ON);
    expect(homeIndex.blindsIndex.get(`DOM#BL#0`).status).toBe(STATUS_ON);
  });
});
