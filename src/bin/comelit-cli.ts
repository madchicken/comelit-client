#!/usr/bin/env node
import yargs = require('yargs');
import chalk from 'chalk';
import { ACTION_TYPE, ComelitClient, ROOT_ID } from '../comelit-client';
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
  .options({})
  .command('scan', 'Find the HUB on your network')
  .command('info', 'Get info about a device', {
    host: { type: 'string', demandOption: true },
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
    id: { type: 'string', demandOption: true },
    detail: { type: 'number', demandOption: false, default: 1 },
  })
  .command('params', 'Get HUB parameters', {
    host: { type: 'string', demandOption: true },
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
    host: { type: 'string', demandOption: true },
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
    id: { type: 'string', demandOption: true },
    type: { type: 'number', demandOption: true, default: ACTION_TYPE.SET },
    value: { type: 'string', demandOption: true },
  })
  .command('zones', 'Get zones for a given parent zone', {
    host: { type: 'string', demandOption: true },
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
    id: { type: 'string', demandOption: true, default: ROOT_ID },
  })
  .command(
    'listen',
    'Optionally Subscribe to an object and listen on the read topic (CTRL+C to exit)',
    {
      host: { type: 'string', demandOption: true },
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
      await scan();
    } else {
      await client.init(
        options.host,
        options.username,
        options.password,
        options.broker_username,
        options.broker_password,
        options.client_id
      );
      await client.login();

      switch (command) {
        case 'info':
          await info(options.id as string, options.detail as number);
          break;
        case 'params':
          await params();
          break;
        case 'action':
          await action(
            options.id as string,
            options.type as number,
            options.value
          );
          break;
        case 'zones':
          await zones(options.id as string);
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
  console.log(
    chalk.green(`Sending action ${type} with value ${value} to ${id}`)
  );
  const data = await client.sendAction(id, type, value);
  console.log(JSON.stringify(data, null, 4));
}

async function zones(id: string) {
  console.log(chalk.green(`Retrieving zones for object ${id}`));
  const data = await client.zones(id);
  console.log(JSON.stringify(data, null, 4));
}

async function scan() {
  console.log(chalk.green('Scanning local network for HUB...'));
  await client.scan();
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
