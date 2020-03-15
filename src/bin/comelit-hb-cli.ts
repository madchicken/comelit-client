#!/usr/bin/env node
import yargs = require('yargs');
import chalk = require('chalk');
import { BridgeClient } from '../bridge-client';

interface ClientOptions {
  host: string;
  port: number;
}

const options: ClientOptions & any = yargs
  .option('host', { alias: 'h', type: 'string', demandOption: true })
  .option('port', { alias: 'p', type: 'number', demandOption: true })
  .command('house', 'Get info about house', {})
  .demandCommand()
  .help().argv;

let client: BridgeClient = null;

async function run() {
  const command = options._[0];
  console.log(
    chalk.green(`Executing command ${command} - ${JSON.stringify(options)}`)
  );
  client = new BridgeClient(options.host, options.port);
  await client.login();
  try {
    switch (command) {
      case 'house':
        break;
      case 'zone':
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
