#!/usr/bin/env node
import yargs = require("yargs");
import chalk from "chalk";
import { BridgeClient, getBlindKey, getLightKey } from "../bridge-client";
import {OFF, ON, STATUS_OFF, STATUS_ON} from "../types";

interface ClientOptions {
  host: string;
  port: number;
}

const options: ClientOptions & any = yargs
  .option("host", { alias: "h", type: "string", demandOption: true })
  .option("port", {
    alias: "p",
    type: "number",
    demandOption: false,
    default: 80
  })
  .command("lights", "Get info about house lights", {
    list: {
      describe: "Get the list of all lights in the house"
    },
    toggle: {
      describe: "Turn on/off a light",
      type: "number"
    }
  })
  .command("shutters", "Get info about house shutters/blinds", {
    list: {
      describe: "Get the list of all shutters in the house"
    },
    toggle: {
      describe: "Open/close a shutter",
      type: "number"
    }
  })
  .command("clima", "Get info about house thermostats/clima", {
    list: {
      describe: "Get the list of all thermostats/clima in the house"
    },
  })
  .demandCommand()
  .help().argv;

let client: BridgeClient = null;

async function listLights() {
  const homeIndex = await client.fecthHomeIndex();
  [...homeIndex.lightsIndex.values()].forEach(light => {
    console.log(chalk.green(`${light.objectId} - ${light.descrizione} (status ${light.status === STATUS_ON ? 'ON' : 'OFF'})`));
  });
}

async function listShutters() {
  const homeIndex = await client.fecthHomeIndex();
  [...homeIndex.blindsIndex.values()].forEach(blind => {
    console.log(chalk.green(`${blind.objectId} - ${blind.descrizione} (status ${blind.status === STATUS_ON ? 'DOWN' : 'UP'})`));
  });
}

async function listClima() {
  const homeIndex = await client.fecthHomeIndex();
  [...homeIndex.thermostatsIndex.values()].forEach(clima => {
    console.log(chalk.green(`${clima.objectId} - ${clima.descrizione} (status ${clima.status === STATUS_ON ? 'ON' : 'OFF'})`));
  });
}

async function toggleLight(index: number) {
  const homeIndex = await client.fecthHomeIndex();
  const lightDeviceData = homeIndex.get(getLightKey(index));
  if (lightDeviceData) {
    if (lightDeviceData.status === STATUS_OFF) {
      await client.toggleDeviceStatus(index, ON, "light");
    } else {
      await client.toggleDeviceStatus(index, OFF, "light");
    }
  } else {
    console.log(chalk.red('Selected light does not exists'));
  }
}

async function toggleShutter(index: number) {
  const homeIndex = await client.fecthHomeIndex();
  const blindDeviceData = homeIndex.get(getBlindKey(index));
  if (blindDeviceData) {
    if (blindDeviceData.status === STATUS_OFF) {
      await client.toggleDeviceStatus(index, ON, "shutter");
    } else {
      await client.toggleDeviceStatus(index, OFF, "shutter");
    }
  } else {
    console.log(chalk.red('Selected shutter does not exists'));
  }
}

async function run() {
  const command = options._[0];
  console.log(
    chalk.green(`Executing command ${command} - ${JSON.stringify(options)}`)
  );
  client = new BridgeClient(options.host, options.port);
  await client.login();
  try {
    switch (command) {
      case "lights":
        if (options.list) {
          await listLights();
        }
        if (options.toggle && typeof options.toggle === "number") {
          await toggleLight(options.toggle);
        }
        break;
      case "shutters":
        if (options.list) {
          await listShutters();
        }
        if (options.toggle && typeof options.toggle === "number") {
          await toggleShutter(options.toggle);
        }
        break;
      case "clima":
        if (options.list) {
          await listClima();
        }
        break;
      default:
        console.error(chalk.red(`Unknown command ${command}`));
        process.exit(1);
    }

    console.log(chalk.green("Shutting down"));
    await client.shutdown();
    console.log(chalk.green(`Command ${command} executed successfully`));
  } catch (e) {
    console.error(e);
    await client.shutdown();
  }
}

run().then(() => {
  console.log(chalk.green("Exiting"));
  process.exit(0);
});
