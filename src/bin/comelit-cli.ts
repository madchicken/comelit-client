#!/usr/bin/env node
import yargs = require('yargs');
import chalk from 'chalk';
import {
  ACTION_TYPE,
  ClimaMode,
  ClimaOnOff,
  ComelitClient,
  ComelitDevice,
  ROOT_ID,
  ThermoSeason,
} from '../comelit-client';
import { DeviceData, OFF, ON, STATUS_OFF, STATUS_ON, ThermostatDeviceData } from '../types';
import { sleep } from '../utils';

const readline = require('readline');

const DEFAULT_BROKER_PASSWORD = 'sf1nE9bjPc';
const DEFAULT_BROKER_USER = 'hsrv-user';

interface ClientOptions {
  host?: string;
  username?: string;
  password?: string;
  broker_username?: string;
  broker_password?: string;
  client_id?: string;
  id?: string;
  detail?: number;
}

const options: ClientOptions & any = yargs
  .options({
    username: {
      description: 'Username to use when authenticating to the HUB',
      alias: 'u',
      type: 'string',
      demandOption: true,
      default: 'admin',
    },
    password: {
      description: 'Password to use when authenticating to the HUB',
      alias: 'p',
      type: 'string',
      demandOption: true,
      default: 'admin',
    },
    hub_username: {
      description: 'Username to use to connect MQTT broker',
      alias: 'bu',
      type: 'string',
      demandOption: true,
      default: DEFAULT_BROKER_USER,
    },
    hub_password: {
      description: 'Password to use to connect MQTT broker',
      alias: 'bp',
      type: 'string',
      demandOption: true,
      default: DEFAULT_BROKER_PASSWORD,
    },
    client_id: {
      description:
        'Client ID to use when connecting to the broker. Leave it empty to have the client generate it for you.',
      type: 'string',
      default: null,
    },
  })
  .command('scan', 'Find the HUB on your network')
  .command('info', 'Get info about a device', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
    id: { type: 'string', demandOption: true },
    detail: { type: 'number', demandOption: false, default: 1 },
  })
  .command('params', 'Get HUB parameters', {
    host: { type: 'string', demandOption: false },
    username: {
      alias: 'u',
      type: 'string',
      demandOption: true,
      default: 'admin',
    },
    password: {
      alias: 'p',
      type: 'string',
      demandOption: true,
      default: 'admin',
    },
    broker_username: {
      alias: 'bu',
      type: 'string',
      demandOption: true,
      default: DEFAULT_BROKER_USER,
    },
    broker_password: {
      alias: 'bp',
      type: 'string',
      demandOption: true,
      default: DEFAULT_BROKER_PASSWORD,
    },
    client_id: { type: 'string', default: null },
  })
  .command('action', 'Send action to device', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
    id: { type: 'string', demandOption: true },
    type: { type: 'number', demandOption: true, default: ACTION_TYPE.SET },
    value: { type: 'string', demandOption: true },
  })
  .command('zones', 'Get zones for a given parent zone', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
    id: {
      description: 'ID of the parent room/zone',
      type: 'string',
      demandOption: true,
    },
  })
  .command('rooms', 'Get info about house rooms', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
  })
  .command('lights', 'Get info about house lights', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
    toggle: {
      describe: 'Turn on/off a light',
      type: 'string',
    },
  })
  .command('outlets', 'Get the list of all outlets in the house', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
    toggle: {
      describe: 'Turn on/off an outlets',
      type: 'number',
    },
  })
  .command('shutters', 'Get the list of all shutters in the house', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
    toggle: {
      describe: 'Open/close a shutter',
      type: 'number',
    },
  })
  .command('clima', 'Get the list of all thermostats/clima in the house', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
    toggle: {
      describe: 'Turn on/off a thermostat',
      type: 'number',
    },
    temp: {
      describe: 'Set the temperature for a thermostat',
      type: 'string',
    },
    season: {
      describe: 'Set the season for a thermostat',
      type: 'string',
      choices: ['winter', 'summer'],
    },
  })
  .command('umi', 'Get the list of all dehumidifiers in the house', {
    host: {
      alias: 'h',
      description: 'broker host or IP',
      type: 'string',
      demandOption: false,
    },
    toggle: {
      alias: 't',
      describe: 'Turn on/off a dehumidifier',
      type: 'number',
    },
    percentage: {
      alias: 'perc',
      describe: 'Set the threshold humidity for a dehumidifier',
      type: 'number',
    },
  })
  .command(
    'listen',
    'Optionally Subscribe to an object and listen on the read topic (CTRL+C to exit)',
    {
      host: {
        alias: 'h',
        description: 'broker host or IP',
        type: 'string',
        demandOption: false,
      },
      id: {
        type: 'string',
        demandOption: false,
        description: 'The ID of the object to subscribe to',
        default: ROOT_ID,
      },
      topic: {
        type: 'string',
        demandOption: false,
        description: 'The topic name to listen',
      },
    }
  )
  .demandCommand()
  .help().argv;

const client = new ComelitClient();

async function run() {
  const command = options._[0];
  console.log(chalk.green(`Executing command ${command}`));
  try {
    if (command === 'scan') {
      const devices = await scan();
      devices.forEach(device =>
        console.log(
          `Found hardware ${device.hwID} MAC ${device.macAddress}, app ${device.appID} version ${device.appVersion}, system id ${device.systemID}, ${device.model} - ${device.description} at IP ${device.ip}`
        )
      );
    } else {
      await client.init(options);
      await client.login();

      const toggle: string = options.toggle;
      switch (command) {
        case 'info':
          await info(options.id as string, options.detail as number);
          break;
        case 'params':
          await params();
          break;
        case 'action':
          await action(options.id as string, options.type as number, options.value);
          break;
        case 'zones':
          await zones(options.id as string);
          break;
        case 'rooms':
          await listRooms();
          break;
        case 'lights':
          if (toggle !== undefined) {
            switch (toggle) {
              case 'all-off':
                await listLights(async light => {
                  return await client.toggleDeviceStatus(light.id, OFF);
                });
                break;
              case 'all-on':
                await listLights(async light => {
                  return await client.toggleDeviceStatus(light.id, ON);
                });
                break;
              default:
                await Promise.all(toggle.split(',').map(async objID => toggleLight(objID.trim())));
            }
          } else {
            await listLights(printObj);
          }
          break;
        case 'outlets':
          if (toggle !== undefined) {
            await toggleOutlets(toggle);
          } else {
            await listOutlets();
          }
          break;
        case 'shutters':
          if (toggle !== undefined) {
            await toggleShutter(toggle);
          } else {
            await listShutters();
          }
          break;
        case 'clima':
          if (toggle !== undefined) {
            if (options.temp !== undefined) {
              await setThermostatTemperature(toggle, options.temp);
            } else if (options.season !== undefined) {
              await switchThermostatSeason(toggle, options.season);
            } else {
              await switchThermostatState(toggle);
            }
          } else {
            await listClima();
          }
          break;
        case 'umi':
          if (toggle !== undefined) {
            if (options.perc !== undefined) {
              await setHumidifierTemperature(toggle, options.temp);
            } else {
              await switchHumidifierState(toggle);
            }
          } else {
            await listClima();
          }
          break;
        case 'listen':
          await listen(options.id as string, options.topic as string);
          break;
        default:
          console.error(chalk.red(`Unknown command ${command}`));
      }

      console.log(chalk.green('Shutting down'));
      await client.shutdown();
    }
    console.log(chalk.green(`Command ${command} executed successfully`));
  } catch (e) {
    console.error(e);
    await client.shutdown();
  }
}

async function info(id: string, detailLevel: number = 1) {
  console.log(chalk.green(`Getting device information for ${options.id}`));
  const data = await client.device(id, detailLevel);
  console.log(JSON.stringify(data, null, 4));
}

async function params() {
  console.log(chalk.green(`Getting parameters`));
  const data = await client.readParameters();
  console.log(JSON.stringify(data, null, 4));
}

async function action(id: string, type: number, value: any) {
  console.log(chalk.green(`Sending action ${type} with value ${value} to ${id}`));
  const data = await client.sendAction(id, type, value);
  console.log(JSON.stringify(data, null, 4));
}

async function zones(id: string) {
  console.log(chalk.green(`Retrieving zones for object ${id}`));
  const data = await client.zones(id);
  console.log(JSON.stringify(data, null, 4));
}

async function listRooms() {
  const homeIndex = await client.fetchHomeIndex();
  [...homeIndex.roomsIndex.values()].forEach(room => {
    console.log(chalk.green(`${room.id} - ${room.descrizione}`));
  });
}

function printObj(obj: DeviceData) {
  console.log(
    chalk.green(
      `${obj.objectId} - ${obj.descrizione} (status ${obj.status === STATUS_ON ? 'ON' : 'OFF'})`
    )
  );
}

async function listLights(fn: (obj: DeviceData) => void) {
  const homeIndex = await client.fetchHomeIndex();
  return [...homeIndex.lightsIndex.values()].forEach(light => {
    return fn(light);
  });
}

async function listOutlets() {
  const homeIndex = await client.fetchHomeIndex();
  [...homeIndex.outletsIndex.values()].forEach(outlet => {
    console.log(
      chalk.green(
        `${outlet.objectId} - ${outlet.descrizione} (status ${
          outlet.status === STATUS_ON ? 'ON' : 'OFF'
        })`
      )
    );
  });
}

async function listShutters() {
  const homeIndex = await client.fetchHomeIndex();
  [...homeIndex.blindsIndex.values()].forEach(blind => {
    console.log(
      chalk.green(
        `${blind.objectId} - ${blind.descrizione} (status ${
          blind.status === STATUS_ON ? 'DOWN' : 'UP'
        })`
      )
    );
  });
}

async function listClima() {
  const homeIndex = await client.fetchHomeIndex();
  [...homeIndex.thermostatsIndex.values()].forEach(clima => {
    const auto_man = clima.auto_man;
    const isOff = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.OFF_MANUAL;
    const isManual = auto_man === ClimaMode.OFF_MANUAL || auto_man === ClimaMode.MANUAL;
    console.log(
      chalk.green(
        `${clima.objectId} - ${clima.descrizione}:\nThermostat status ${isOff ? 'OFF' : 'ON'}, ${
          isManual ? 'manual mode' : 'auto mode'
        }, ${clima.est_inv === ThermoSeason.WINTER ? 'winter' : 'summer'}, Temperature ${parseInt(
          clima.temperatura
        ) / 10}°, threshold ${parseInt(clima.soglia_attiva) / 10}°`
      )
    );
    const humi_auto_man = clima.auto_man_umi;
    const humi_isOff =
      humi_auto_man === ClimaMode.OFF_AUTO || humi_auto_man === ClimaMode.OFF_MANUAL;
    const humi_isManual =
      humi_auto_man === ClimaMode.OFF_MANUAL || humi_auto_man === ClimaMode.MANUAL;
    console.log(
      chalk.blue(
        `Dehumidifier status is ${humi_isOff ? 'OFF' : 'ON'}, ${
          humi_isManual ? 'manual mode' : 'auto mode'
        }, Humidity level ${parseInt(clima.umidita)}%, threshold ${
          clima.soglia_attiva_umi
        }%\nGeneral status is ${clima.status === '1' ? 'ON' : 'OFF'}\n`
      )
    );
  });
}

async function toggleLight(index: string) {
  const lightDeviceData = await client.device(index);
  if (lightDeviceData) {
    if (lightDeviceData.status === STATUS_OFF) {
      return client.toggleDeviceStatus(index, ON);
    } else {
      return client.toggleDeviceStatus(index, OFF);
    }
  } else {
    console.log(chalk.red('Selected light does not exists'));
  }
}

async function toggleOutlets(index: string) {
  const homeIndex = await client.fetchHomeIndex();
  const otherDeviceData = homeIndex.get(index);
  if (otherDeviceData) {
    if (otherDeviceData.status === STATUS_OFF) {
      await client.toggleDeviceStatus(index, ON);
    } else {
      await client.toggleDeviceStatus(index, OFF);
    }
  } else {
    console.log(chalk.red('Selected outlet does not exists'));
  }
}

async function toggleShutter(index: string) {
  const homeIndex = await client.fetchHomeIndex();
  const blindDeviceData = homeIndex.get(index);
  if (blindDeviceData) {
    if (blindDeviceData.status === STATUS_OFF) {
      await client.toggleDeviceStatus(index, ON);
    } else {
      await client.toggleDeviceStatus(index, OFF);
    }
  } else {
    console.log(chalk.red('Selected shutter does not exists'));
  }
}

async function switchThermostatState(index: string) {
  const homeIndex = await client.fetchHomeIndex();
  const climaDeviceData: ThermostatDeviceData = homeIndex.get(index);
  if (climaDeviceData) {
    switch (climaDeviceData.auto_man) {
      case ClimaMode.OFF_AUTO:
        await client.switchThermostatMode(index, ClimaMode.AUTO);
        break;
      case ClimaMode.OFF_MANUAL:
        await client.switchThermostatMode(index, ClimaMode.MANUAL);
        break;
      case ClimaMode.MANUAL:
      case ClimaMode.AUTO:
        await client.toggleThermostatStatus(index, ClimaOnOff.OFF);
        break;
    }
  }
}

async function switchThermostatSeason(index: string, season: string) {
  const homeIndex = await client.fetchHomeIndex();
  const climaDeviceData: ThermostatDeviceData = homeIndex.get(index);
  if (climaDeviceData) {
    await client.switchThermostatSeason(
      index,
      season === 'summer' ? ThermoSeason.SUMMER : ThermoSeason.WINTER
    );
  }
}

async function setThermostatTemperature(index: string, temperature: string) {
  try {
    const temp = parseFloat(temperature);
    const homeIndex = await client.fetchHomeIndex();
    const climaDeviceData = homeIndex.get(index);
    if (climaDeviceData) {
      await client.setTemperature(index, temp * 10);
    }
  } catch (e) {
    console.log(chalk.red(e.message));
  }
}

async function switchHumidifierState(index: string) {
  const homeIndex = await client.fetchHomeIndex();
  const climaDeviceData: ThermostatDeviceData = homeIndex.get(index);
  if (climaDeviceData) {
    switch (climaDeviceData.auto_man_umi) {
      case ClimaMode.OFF_AUTO:
        await client.switchHumidifierMode(index, ClimaMode.AUTO);
        break;
      case ClimaMode.OFF_MANUAL:
        await client.switchHumidifierMode(index, ClimaMode.MANUAL);
        break;
      case ClimaMode.MANUAL:
      case ClimaMode.AUTO:
        await client.toggleHumidifierStatus(index, ClimaOnOff.OFF_HUMI);
        break;
    }
  }
}

async function setHumidifierTemperature(index: string, temperature: string) {
  try {
    const temp = parseFloat(temperature);
    const homeIndex = await client.fetchHomeIndex();
    const climaDeviceData = homeIndex.get(index);
    if (climaDeviceData) {
      await client.setHumidity(index, temp);
    }
  } catch (e) {
    console.log(chalk.red(e.message));
  }
}

async function scan(): Promise<ComelitDevice[]> {
  console.log(chalk.green('Scanning local network for HUB...'));
  return await client.scan();
}

async function listen(id?: string, topic?: string) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  console.log(chalk.green(`Subscribing to object ${id}`));
  if (id) {
    await client.subscribeObject(id);
  }
  if (topic) {
    await client.subscribeTopic(topic, (topic, message) => {
      console.log(chalk.blue(`Received message on topic ${topic}`));
      console.log(chalk.blue(message));
    });
  }
  console.log(chalk.green(`Listening...(press CTRL+c to interrupt)`));
  return new Promise<void>(resolve => {
    process.stdin.on('keypress', async (str, key) => {
      if (key.ctrl && key.name === 'c') {
        resolve();
      }
    });
  });
}

run().then(() => {
  console.log(chalk.green('Exiting'));
  process.exit(0);
});
