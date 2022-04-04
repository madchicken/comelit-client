#!/usr/bin/env node
import yargs = require('yargs');
import chalk from 'chalk';
import {IconaBridgeClient} from '../icona-bridge-client';
import YAML from "yamljs";

interface ClientOptions {
  _: string[];
  $0: string;
  host: string;
  token: string;
  output: string;
  door?: string;
  addressbook?: string;
  deviceToken?: string;
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
    output: {
      description: 'Output mode: json, yaml',
      alias: 'o',
      type: 'string',
      demandOption: false,
      default: 'yaml'
    },
  })
  .demandOption('host')
  .demandOption('token')
  .command('get-config <addressbook>', 'Get configuration of ICONA bridge', () => {
    yargs.positional('addressbook', {
      describe: 'Address Book to request (none or all)',
      type: 'string',
      demandOption: true,
    });
  })
  .command('server-info', 'Get server information')
  .command('push-info <deviceToken>', 'Get server push information', () => {
    yargs.positional('deviceToken', {
      describe: 'Device token',
      type: 'string',
      demandOption: true,
    });
  })
  .command('open-door <door>', 'Open a door using ICONA bridge', () => {
    yargs.positional('door', {
      describe: 'Name of the door to open',
      type: 'string',
    });
  })
  .demandCommand()
  .help().argv;

async function run() {
  const command = options._[0];
  console.log(chalk.green(`Executing command ${command}`));
  try {
    switch (command) {
      case 'get-config':
        await config();
        break;
      case 'server-info':
        await serverInfo();
        break;
      case 'push-info':
        await pushInfo();
        break;
      case 'open-door':
        await openDoor();
        break
      default:
        console.error(chalk.red(`Unrecognized command ${command}`));
    }

    console.log(chalk.green('Shutting down'));
    console.log(chalk.green(`Command ${command} executed successfully`));
  } catch (e) {
    console.error(e);
  }
}

async function config() {
  const client = new IconaBridgeClient(options.host);
  await client.connect();
  const code = await client.authenticate(options.token);
  if (code === 200) {
    const res = await client.getConfig(options.addressbook);
    console.log(chalk.green('Address books ALL response: '));
    console.log(serialize(res, options.output));
    await client.shutdown();
  }
}

async function serverInfo() {
  const client = new IconaBridgeClient(options.host);
  await client.connect();
  const code = await client.authenticate(options.token);
  if (code === 200) {
    const res = await client.getServerInfo();
    console.log(chalk.green('Server Info response: '));
    console.log(serialize(res, options.output));
    await client.shutdown();
  }
}

async function pushInfo() {
  const client = new IconaBridgeClient(options.host);
  await client.connect();
  const code = await client.authenticate(options.token);
  if (code === 200) {
    const conf = await client.getConfig(options.addressbook);
    const res = await client.getPushInfo(conf.vip, options.deviceToken);
    console.log(chalk.green('Push Info response: '));
    console.log(serialize(res, options.output));
    await client.shutdown();
  }
}

async function openDoor() {
  const client = new IconaBridgeClient(options.host);
  await client.connect();
  const code = await client.authenticate(options.token);
  if (code === 200) {
    const res = await client.getConfig(options.addressbook);
    let item = res.vip["user-parameters"]["opendoor-address-book"].find(doorItem => doorItem.name === options.door);
    console.log(`Opening door ${item.name} at address ${item["apt-address"]} and index ${item["output-index"]}`);
  }
}

function serialize(obj: any, output: string) {
  switch (output) {
    case "yaml":
      return YAML.stringify(obj);
    case "json":
    default:
      return JSON.stringify(obj, null, 2);
  }
}

run().then(() => {
  console.log(chalk.green('Exiting'));
  process.exit(0);
});
