#!/usr/bin/env node
import yargs = require('yargs');
import chalk from 'chalk';
import { IconaBridgeClient } from '../icona-bridge-client';

interface ClientOptions {
  _: string[];
  $0: string;
  host: string;
  token: string;
  door?: any;
}

const options: ClientOptions = yargs
  .options({
    host: {
      description: 'Comelit HUB host',
      alias: 'h',
      type: 'string',
      demandOption: true,
    },
    token: {
      description: 'Icona access token',
      alias: 't',
      type: 'string',
      demandOption: true,
      // default: '9f32acb3e7f452f86d43e1b7c9a3eac4',
    },
  })
  .demandOption('host')
  .demandOption('token')
  .command('get-config', 'Find the HUB on your network')
  .command('open-door <door>', 'Open a door using Icona bridge', () => {
    yargs.positional('door', {
      describe: 'Number of door to open',
      type: 'number',
    });
  })
  .demandCommand()
  .help().argv;

async function run() {
  const command = options._[0];
  console.log(chalk.green(`Executing command ${command}`));
  try {
    if (command === 'get-config') {
      await config();
    } else if (command === 'open-door') {
      await openDoor(options.door);
    }

    console.log(chalk.green('Shutting down'));
    console.log(chalk.green(`Command ${command} executed successfully`));
  } catch (e) {
    console.error(e);
  }
}

async function config() {
  const client = new IconaBridgeClient(options.token, options.host);
  await client.connect();
  const resp = await client.getConfig();
  await client.shutdown();
  return console.log(chalk.blue(resp));
}

async function openDoor(door: number) {
  if (door) {
    const client = new IconaBridgeClient(options.token, options.host);
    await client.connect();
    const resp = await client.openDoor(door);
    await client.shutdown();
    return console.log(chalk.blue(resp));
  }
  return console.log(chalk.red('You must provide a door number'));
}

run().then(() => {
  console.log(chalk.green('Exiting'));
  process.exit(0);
});
