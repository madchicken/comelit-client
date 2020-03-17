#!/usr/bin/env node
import yargs = require("yargs");
import chalk = require("chalk");
import { BridgeClient, getLightKey } from "../bridge-client";
import { OFF, ON, STATUS_OFF } from "../types";

interface ClientOptions {
  host: string;
  port: number;
}

const options: ClientOptions & any = yargs
  .option("host", { alias: "h", type: "string", demandOption: true })
  .option("port", { alias: "p", type: "number", demandOption: false, default: 80 })
  .command("lights", "Get info about house", {
    list: {
      describe: "Get the list of all lights in the house"
    },
    toggle: {
      describe: "Turn on/off a light",
      type: "number"
    }
  })
  .demandCommand()
  .help().argv;

let client: BridgeClient = null;

async function listLights() {
  const homeIndex = await client.fecthHomeIndex();
  [...homeIndex.lightsIndex.values()].forEach(light => {
    console.log(`${light.objectId} - ${light.descrizione}`);
  });
}

async function toggleLight(index: number) {
  const homeIndex = await client.fecthHomeIndex();
  const lightDeviceData = homeIndex.lightsIndex.get(getLightKey(index));
  if (lightDeviceData.status === STATUS_OFF) {
    await client.toggleDeviceStatus(index, ON, "light");
  } else {
    await client.toggleDeviceStatus(index, OFF, "light");
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
