#!/usr/bin/env node
import yargs = require('yargs');
import chalk from 'chalk';
import { ComelitSbClient, getBlindKey, getClimaKey, getLightKey, getOtherKey } from '../comelit-sb-client';
import {OBJECT_SUBTYPE, OFF, ON, STATUS_OFF, STATUS_ON, ThermostatDeviceData} from '../types';
import { ClimaMode, ThermoSeason } from '../comelit-client';

interface ClientOptions {
  host: string;
  port: number;
}

const options: ClientOptions & any = yargs
  .option('host', { alias: 'h', type: 'string', demandOption: true })
  .option('port', {
    alias: 'p',
    type: 'number',
    demandOption: false,
    default: 80,
  })
  .command('rooms', 'Get the list of all rooms in the house')
  .command('lights', 'Get the list of all lights in the house', {
    toggle: {
      describe: 'Turn on/off a light',
      type: 'number',
    },
  })
  .command('outlets', 'Get the list of all outlets in the house', {
    toggle: {
      describe: 'Turn on/off an outlets',
      type: 'number',
    },
  })
  .command('shutters', 'Get the list of all shutters in the house', {
    toggle: {
      describe: 'Open/close a shutter',
      type: 'number',
    },
  })
  .command('clima', 'Get the list of all thermostats/clima in the house', {
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
  .demandCommand(1, 1)
  .help().argv;

let client: ComelitSbClient = null;

async function listLights() {
  const homeIndex = await client.fetchHomeIndex();
  [...homeIndex.lightsIndex.values()].forEach(light => {
    let subtype= 'Unknown light type';
    switch (light.sub_type) {
      case OBJECT_SUBTYPE.DIGITAL_LIGHT:
        subtype = 'Digital light';
        break;
      case OBJECT_SUBTYPE.TEMPORIZED_LIGHT:
        subtype = 'Temporized light';
        break;
      case OBJECT_SUBTYPE.RGB_LIGHT:
        subtype = 'RGB light';
        break;
    }

    console.log(
      chalk.green(
        `${light.objectId} - ${light.descrizione} (status ${
          light.status === STATUS_ON ? 'ON' : 'OFF'
        } (${subtype})`
      )
    );
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
      const humi_isOff = humi_auto_man === ClimaMode.OFF_AUTO || humi_auto_man === ClimaMode.OFF_MANUAL;
      const humi_isManual = humi_auto_man === ClimaMode.OFF_MANUAL || humi_auto_man === ClimaMode.MANUAL;
      console.log(chalk.blue(`Dehumidifier status is ${humi_isOff ? 'OFF' : 'ON'}, ${
        humi_isManual ? 'manual mode' : 'auto mode'
      }, Humidity level ${parseInt(clima.umidita)}%, threshold ${clima.soglia_attiva_umi}%\nGeneral status is ${clima.status === '1' ? 'ON' : 'OFF'}\n`));
    }
  );
}

async function listRooms() {
  const homeIndex = await client.fetchHomeIndex();
  [...homeIndex.roomsIndex.values()].forEach(room => {
    console.log(chalk.green(`${room.objectId} - ${room.descrizione}`));
  });
}

async function toggleLight(index: number) {
  const homeIndex = await client.fetchHomeIndex();
  const lightDeviceData = homeIndex.get(getLightKey(index));
  if (lightDeviceData) {
    if (lightDeviceData.status === STATUS_OFF) {
      await client.toggleDeviceStatus(index, ON, 'light');
    } else {
      await client.toggleDeviceStatus(index, OFF, 'light');
    }
  } else {
    console.log(chalk.red('Selected light does not exists'));
  }
}

async function toggleOutlets(index: number) {
  const homeIndex = await client.fetchHomeIndex();
  const otherDeviceData = homeIndex.get(getOtherKey(index));
  if (otherDeviceData) {
    if (otherDeviceData.status === STATUS_OFF) {
      await client.toggleDeviceStatus(index, ON, 'other');
    } else {
      await client.toggleDeviceStatus(index, OFF, 'other');
    }
  } else {
    console.log(chalk.red('Selected outlet does not exists'));
  }
}

async function toggleShutter(index: number) {
  const homeIndex = await client.fetchHomeIndex();
  const blindDeviceData = homeIndex.get(getBlindKey(index));
  if (blindDeviceData) {
    if (blindDeviceData.status === STATUS_OFF) {
      await client.toggleDeviceStatus(index, ON, 'shutter');
    } else {
      await client.toggleDeviceStatus(index, OFF, 'shutter');
    }
  } else {
    console.log(chalk.red('Selected shutter does not exists'));
  }
}

async function switchThermostatState(index: number) {
  const homeIndex = await client.fetchHomeIndex();
  const climaDeviceData: ThermostatDeviceData = homeIndex.get(getClimaKey(index));
  if (climaDeviceData) {
    switch (climaDeviceData.auto_man) {
      case ClimaMode.OFF_AUTO:
        await client.switchThermostatMode(index, ClimaMode.AUTO);
        break;
      case ClimaMode.OFF_MANUAL:
        await client.switchThermostatMode(index, ClimaMode.MANUAL);
        break;
      case ClimaMode.AUTO:
        await client.switchThermostatMode(index, ClimaMode.OFF_AUTO);
        break;
      case ClimaMode.MANUAL:
        await client.switchThermostatMode(index, ClimaMode.OFF_MANUAL);
        break;
    }
  }
}

async function switchThermostatSeason(index: number, season: string) {
  const homeIndex = await client.fetchHomeIndex();
  const climaDeviceData: ThermostatDeviceData = homeIndex.get(getClimaKey(index));
  if (climaDeviceData) {
    await client.switchThermostatSeason(
      index,
      season === 'summer' ? ThermoSeason.SUMMER : ThermoSeason.WINTER
    );
  }
}

async function setThermostatTemperature(index: number, temperature: string) {
  try {
    const temp = parseFloat(temperature);
    const homeIndex = await client.fetchHomeIndex();
    const climaDeviceData = homeIndex.get(getClimaKey(index));
    if (climaDeviceData) {
      await client.setTemperature(index, temp * 10);
    }
  } catch (e) {
    console.log(chalk.red(e.message));
  }
}

async function run() {
  const command = options._[0];
  console.log(chalk.green(`Executing command ${command} - ${JSON.stringify(options)}`));
  client = new ComelitSbClient(options.host, options.port);
  await client.login();
  try {
    switch (command) {
      case 'lights':
        if (options.toggle !== undefined) {
          await toggleLight(options.toggle);
        } else {
          await listLights();
        }
        break;
      case 'outlets':
        if (options.toggle !== undefined) {
          await toggleOutlets(options.toggle);
        } else {
          await listOutlets();
        }
        break;
      case 'shutters':
        if (options.toggle !== undefined) {
          await toggleShutter(options.toggle);
        } else {
          await listShutters();
        }
        break;
      case 'clima':
        if (options.toggle !== undefined) {
          if (options.temp !== undefined) {
            await setThermostatTemperature(options.toggle, options.temp);
          } else if (options.season !== undefined) {
            await switchThermostatSeason(options.toggle, options.season);
          } else {
            await switchThermostatState(options.toggle);
          }
        } else {
          await listClima();
        }
        break;
      case 'rooms':
        await listRooms();
        break;
      default:
        console.error(chalk.red(`Unknown command ${command}`));
        process.exit(1);
    }

    console.log(chalk.green('Shutting down'));
    await client.shutdown();
    console.log(chalk.green(`Command ${command} executed successfully`));
  } catch (e) {
    console.error(e);
    await client.shutdown();
  }
}

run().then(() => {
  console.log(chalk.green('Exiting'));
  process.exit(0);
});
