#!/usr/bin/env node
import yargs = require('yargs');
import chalk from 'chalk';
import {ICONA_BRIDGE_PORT, IconaBridgeClient} from '../icona-bridge-client';
import YAML from "yamljs";
import log4js from "log4js";

log4js.configure({
    appenders: { 'out': { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'info' } }
});

const logger = log4js.getLogger('out');
logger.level = 'info';

interface ClientOptions {
    _: string[];
    $0: string;
    host: string;
    port: number;
    token: string;
    output: string;
    debug: boolean;
    command?: string;
    door?: string;
    type?: string;
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
        port: {
            description: 'Comelit HUB port for ICONA Bridge (default ' + ICONA_BRIDGE_PORT + ')',
            alias: 'p',
            type: 'number',
            demandOption: true,
            default: ICONA_BRIDGE_PORT
        },
        token: {
            description: 'Icona access token',
            alias: 't',
            type: 'string',
            demandOption: true,
        },
        output: {
            description: 'Output mode: json, yaml',
            alias: 'o',
            type: 'string',
            demandOption: false,
            default: 'yaml'
        },
        debug: {
            description: 'Output debug information',
            alias: 'd',
            type: 'boolean',
            demandOption: false,
            default: false
        },
    })
    .demandOption('host')
    .demandOption('token')
    .command('get-config <addressbook>', 'Get configuration of ICONA bridge', () => {
        yargs.positional('addressbook', {
            describe: 'Name of the address Book to request (valid values are none or all)',
            type: 'string',
            demandOption: true,
        });
    })
    .command('server-info', 'Get server information')
    .command('list-doors', 'List all available doors using ICONA bridge')
    .command('open-door <door>', 'Open a door using ICONA bridge', () => {
        yargs.option('door', {
            describe: 'Name of the door to open',
            type: 'string',
            demandOption: true
        }).option('type', {
            describe: 'Type of the command to open (possible values are: opendoor, actuator or entrance)',
            type: 'string',
            demandOption: false,
            default: 'opendoor'
        });
    })
    .demandCommand()
    .help().argv;

async function run() {
    const command = options._[0];
    if(options.debug) {
        logger.level = 'debug';
    } else {
        logger.level = 'info';
    }
    logger.info(chalk.green(`Executing command ${command}`));
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
                break;
            case 'list-doors':
                await listDoors();
                break;
            default:
                logger.error(chalk.red(`Unrecognized command ${command}`));
        }

        logger.info(chalk.green('Shutting down'));
        logger.info(chalk.green(`Command ${command} executed successfully`));
    } catch (e) {
        logger.error(e);
    }
}

async function config() {
    const client = new IconaBridgeClient(options.host, options.port, logger);
    await client.connect();
    const code = await client.authenticate(options.token);
    if (code === 200) {
        const res = await client.getConfig(options.addressbook);
        logger.info(chalk.green(`Address books ${options.addressbook} response: `));
        logger.info(serialize(res, options.output));
        await client.shutdown();
    } else {
        logger.error(chalk.red(`Error while authenticating: server responded with code ${code}`));
    }
}

async function serverInfo() {
    const client = new IconaBridgeClient(options.host, options.port, logger);
    await client.connect();
    const code = await client.authenticate(options.token);
    if (code === 200) {
        const res = await client.getServerInfo();
        logger.info(chalk.green('Server Info response: '));
        logger.info(serialize(res, options.output));
        await client.shutdown();
    } else {
        logger.error(chalk.red(`Error while authenticating: server responded with code ${code}`));
    }
}

async function pushInfo() {
    const client = new IconaBridgeClient(options.host, options.port, logger);
    await client.connect();
    const code = await client.authenticate(options.token);
    if (code === 200) {
        const conf = await client.getConfig(options.addressbook);
        const res = await client.getPushInfo(conf.vip, options.deviceToken);
        logger.info(chalk.green('Push Info response: '));
        logger.info(serialize(res, options.output));
        await client.shutdown();
    } else {
        logger.error(chalk.red(`Error while authenticating: server responded with code ${code}`));
    }
}

async function listDoors(includeEntrance = false, includeActuators = true) {
    const client = new IconaBridgeClient(options.host, options.port, logger);
    await client.connect();
    const code = await client.authenticate(options.token);
    if (code === 200) {
        const addressBookAll = await client.getConfig('all');
        logger.info(chalk.green(`Available doors:`));
        logger.info(serialize(addressBookAll.vip["user-parameters"]["opendoor-address-book"], options.output));

        if(includeEntrance) { // excluded by default, since entrance doors don't have module and index, so I don't know how to use them ATM
            logger.info(chalk.green(`Available entrance doors:`));
            logger.info(serialize(addressBookAll.vip["user-parameters"]["entrance-address-book"], options.output));
        }

        if(includeActuators) {
            logger.info(chalk.green(`Available actuators:`));
            logger.info(serialize(addressBookAll.vip["user-parameters"]["actuator-address-book"], options.output));
        }

        await client.shutdown();
    } else {
        logger.error(chalk.red(`Error while authenticating: server responded with code ${code}`));
    }
}

async function openDoor() {
    const client = new IconaBridgeClient(options.host, options.port, logger);
    await client.connect();
    try {
        const code = await client.authenticate(options.token);
        if (code === 200) {
            const addressBook = await client.getConfig('none', false);
            logger.info(serialize(addressBook, options.output));
            const serverInfo = await client.getServerInfo(false);
            logger.info(serialize(serverInfo, options.output));
            const addressBookAll = await client.getConfig('all', false);
            logger.info(serialize(addressBookAll, options.output));
            const type = options.type || 'opendoor';
            const item = addressBookAll.vip["user-parameters"][type + "-address-book"].find(doorItem => doorItem.name === options.door);
            if (item) {
                logger.info(`Opening door ${item.name} at address ${item["apt-address"]} and index ${item["output-index"]}`);
                logger.info(serialize(await client.getServerInfo(), options.output));
                if (type === 'actuator') {
                    await client.openActuator(addressBookAll.vip, item);
                } else {
                    await client.openDoor(addressBookAll.vip, item);
                }
            } else {
                logger.error(`No door with name ${options.door} found in config. Available door names are: ${addressBookAll.vip["user-parameters"]["opendoor-address-book"].map(d => d.name).join(', ')}`);
            }
            await client.shutdown();
        } else {
            logger.error(chalk.red(`Error while authenticating: server responded with code ${code}`));
        }
    } catch (e) {
        logger.error(chalk.red('Error while executing openDoor command'), e);
    } finally {
        await client.shutdown();
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
    logger.info(chalk.green('Exiting'));
    process.exit(0);
});
