import nock from "nock";
import { BridgeClient } from "../bridge-client";
import { STATUS_OFF, STATUS_ON } from "../types";

function mockLightIconDesc() {
  nock("http://localhost:8090")
    .get("/icon_desc.json?type=light")
    .reply(200, {
      num: 20,
      desc: [
        "Luce Studio",
        "Luce Bagno",
        "Luce Porta",
        "Luci appontaggio",
        "Luce Perimetrale",
        "Luce disimpegno",
        "Lampadario camera",
        "Applique DX",
        "Applique SX",
        "Luce Specchio del ba",
        "Luce Ripostiglio",
        "Luce Tavolo",
        "Luce Piano cucina",
        "Luce corridoio",
        "Luce ambiente",
        "Lampadario Sala",
        "Luce Baracca",
        "Luce bancone",
        "Luci Terrazza",
        "Luce Barbacuo"
      ],
      env: [2, 2, 3, 3, 3, 4, 5, 5, 5, 6, 7, 8, 8, 8, 8, 8, 9, 9, 10, 10],
      status: [1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      val: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      type: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      protected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      env_desc: [
        "",
        "Casa",
        "Zona Notte",
        "Esterno",
        "Corridoio",
        "Camera da letto",
        "Bagno",
        "Ripostiglio",
        "Zona Giorno",
        "Baracca",
        "Terrazza"
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

    const client = new BridgeClient("localhost", 8090);
    const homeIndex = await client.fecthHomeIndex();
    expect(homeIndex).toBeDefined();
    expect(homeIndex.roomsIndex.size).toBe(10);
    expect(homeIndex.lightsIndex.size).toBe(20);
    expect(homeIndex.lightsIndex.get(`DOM#LT#0`).status).toBe(STATUS_ON);
    expect(homeIndex.lightsIndex.get(`DOM#LT#1`).status).toBe(STATUS_ON);
    expect(homeIndex.lightsIndex.get(`DOM#LT#3`).status).toBe(STATUS_OFF);
  });

  it("should update the status of index", async () => {
    mockLightIconDesc();

    nock("http://localhost:8090")
      .get("/user/icon_status.json?type=light")
      .reply(200, {
        life: 0,
        domus: "100CC0C00CC0",
        status: [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        val: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      });

    const client = new BridgeClient("localhost", 8090);
    const homeIndex = await client.fecthHomeIndex();
    await client.updateHomeStatus(homeIndex);
    expect(homeIndex.lightsIndex.get(`DOM#LT#0`).status).toBe(STATUS_ON);
    expect(homeIndex.lightsIndex.get(`DOM#LT#1`).status).toBe(STATUS_OFF);
    expect(homeIndex.lightsIndex.get(`DOM#LT#2`).status).toBe(STATUS_ON);
  });
});
