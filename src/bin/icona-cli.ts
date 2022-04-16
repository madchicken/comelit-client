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
    command?: string;
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
                break;
            case 'list-doors':
                await listDoors();
                break;
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
        console.log(chalk.green(`Address books ${options.addressbook} response: `));
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

async function listDoors() {
    const client = new IconaBridgeClient(options.host);
    await client.connect();
    const code = await client.authenticate(options.token);
    if (code === 200) {
        const addressBookAll = await client.getConfig('all');
        console.log(chalk.green(`Available doors:`));
        console.log(serialize(addressBookAll.vip["user-parameters"]["opendoor-address-book"], options.output));
        await client.shutdown();
    }

}

async function openDoor() {
    const client = new IconaBridgeClient(options.host);
    await client.connect();
    try {
        const code = await client.authenticate(options.token);
        if (code === 200) {
            const addressBook = await client.getConfig('none', false);
            console.log(serialize(addressBook, options.output));
            const serverInfo = await client.getServerInfo(false);
            console.log(serialize(serverInfo, options.output));
            const addressBookAll = await client.getConfig('all', false);
            console.log(serialize(addressBookAll, options.output));
            const item = addressBookAll.vip["user-parameters"]["opendoor-address-book"].find(doorItem => doorItem.name === options.door);
            console.log(`Opening door ${item.name} at address ${item["apt-address"]} and index ${item["output-index"]}`);
            if (item) {
                console.log(serialize(await client.getServerInfo(), options.output));
                const ctpp = await client.openDoorInit(addressBook.vip);
                await client.openDoor(addressBookAll.vip, item, ctpp);
            }
            await client.shutdown();
        }
    } catch (e) {
        console.error(chalk.red('Error while executing openDoor command'), e);
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
    console.log(chalk.green('Exiting'));
    process.exit(0);
});
