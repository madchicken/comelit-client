#!/usr/bin/env node
import yargs = require('yargs');
import chalk = require('chalk');
import { VedoClient } from '../vedo-client';

interface ClientOptions {
  host: string;
  code: string;
}

const options: ClientOptions & any = yargs
  .scriptName('vedo')
  .option('host', { alias: 'h', type: 'string', demandOption: true })
  .option('code', { alias: 'c', type: 'string', demandOption: true })
  .option('port', { alias: 'p', type: 'number', demandOption: false })
  .command('area', 'Get info about active areas', {
    desc: {
      describe: 'Get info about areas status',
    },
    status: {
      describe: 'Get info about active areas',
    },
    active: {
      describe: 'Get active areas',
    },
    arm: {
      describe: 'Arm a specific area',
      type: 'number',
    },
    disarm: {
      describe: 'Arm a specific area',
      type: 'number',
    },
  })
  .command('zone', 'Get info about active zones', {
    desc: {
      describe: 'Get info about zones status',
    },
    status: {
      describe: 'Get info about active zones',
    },
    exclude: {
      describe: 'Exclude given zone',
    },
    include: {
      describe: 'Include given zone',
    },
  })
  .demandCommand()
  .help().argv;

let client: VedoClient = null;

async function run() {
  const command = options._[0];
  console.log(chalk.green(`Executing command ${command} - ${JSON.stringify(options)}`));
  client = new VedoClient(options.host, options.port || 80);
  let uid = null;
  try {
    uid = await client.loginWithRetry(options.code); // this will throw an error if the system cannot login
    switch (command) {
      case 'area':
        if (options.desc) {
          await areaDesc(uid);
        }
        if (options.status) {
          await areaStatus(uid);
        }
        if (options.active) {
          await activeAreas(uid);
        }
        if (options.arm !== undefined) {
          await armArea(uid, options.arm);
        } else if (options.disarm !== undefined) {
          await disarmArea(uid, options.disarm);
        }
        break;
      case 'zone':
        if (options.desc) {
          await zoneDesc(uid);
        }
        if (options.status) {
          await zoneStatus(uid);
        }
        if (options.include) {
          await includeZone(uid, options.include);
        }
        if (options.exclude) {
          await excludeZone(uid, options.exclude);
        }
        break;
      default:
        console.error(chalk.red(`Unknown command ${command}`));
        process.exit(1);
    }

    console.log(chalk.green('Shutting down'));
    await client.shutdown(uid);
    console.log(chalk.green(`Command ${command} executed successfully`));
  } catch (e) {
    console.error(e.message);
    if (uid) {
      await client.shutdown(uid);
    }
  }
}

async function areaDesc(uid: string) {
  const desc = await client.areaDesc(uid);
  console.log(desc);
}

async function zoneDesc(uid: string) {
  const desc = await client.zoneDesc(uid);
  console.log(desc);
}

async function areaStatus(uid: string) {
  const stats = await client.areaStatus(uid);
  console.log(stats);
}

async function zoneStatus(uid: string) {
  const stats = await client.zoneStatus(uid);
  console.log(stats);
}

async function activeAreas(uid: string) {
  const desc = await client.findActiveAreas(uid);
  console.log(desc);
}

async function armArea(uid: string, num: number = 32) {
  const areas = await client.findActiveAreas(uid);
  const isReady = areas.reduce((prev, area) => prev && area.ready, true);
  if (isReady) {
    return await client.arm(uid, num);
  }
  return Promise.reject(new Error('Area not ready'));
}

async function disarmArea(uid: string, num: number = 32) {
  return await client.disarm(uid, num);
}

async function includeZone(uid: any, include: number) {
  return await client.includeZone(uid, include);
}

async function excludeZone(uid: any, include: number) {
  return await client.excludeZone(uid, include);
}

run().then(() => {
  console.log(chalk.green('Exiting'));
  process.exit(0);
});
