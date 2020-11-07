[![CircleCI](https://circleci.com/gh/madchicken/comelit-client.svg?style=shield)](https://circleci.com/gh/madchicken/comelit-client)
[![npm version](https://badge.fury.io/js/comelit-client.svg)](https://badge.fury.io/js/comelit-client)

# Comelit CLI
A simple command line tool to interact with the Comelit HUB, Comelit Serial Bridge and Vedo Alarm.

The package contains three different tools:
1. comelit - a CLI to interact with the Comelit HUB (https://pro.comelitgroup.com/product/20003150)
2. vedo - a CLI to interact with Comelit Vedo Alarm
3. comelit-sb - a CLI to interact with comelit Serial Bridge (https://pro.comelitgroup.com/product/20003101)

## Installation

To install this tool use the command:

`npm install -g comelit-client@latest`

## Comelit CLI

## Vedo Alarm CLI

This is the CLI to interact with VEDO alarm. Vedo has is own WEB UI that could be different from the serial bridge one.
This is why is a separate tool.

### Basic usage
When using the tool, you always have to pass the host and the port of the VEDO UI. Port is not mandatory,
the default is 80.

To get the description of configured areas, use the `area` along with `--desc` option:

`vedo -h VEDO_IP -p PORT area --desc`

To get the status of all areas, use the `area` along with `--status` option:

`vedo -h VEDO_IP -p PORT area --status`

To get the active areas, use `--active` parameter:

`vedo -h VEDO_IP -p PORT area --active`

To arm the system, use `--arm` parameter followed by the are number (32 means all the system):

`vedo -h VEDO_IP -p PORT area --arm 32`

To disarm the system, use `--disarm` parameter followed by the are number (32 means all the system):

`vedo -h VEDO_IP -p PORT area --disarm 32`

To get the description of configured zones, use the `zone` along with `--desc` option:

`vedo -h VEDO_IP -p PORT zone --desc`

To get the status of area use the `area` along with `--status` option:

`vedo -h VEDO_IP -p PORT zone --status`

## Comelit Serial Bridge

This is a CLI to interact with the old serial bridge. This model uses polling to update status on external systems.

### Basic usage
When using the tool, you always have to pass the host and the port of the serial bridge. Port is not mandatory,
the default is 80.

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT`

You can query the system and ask to show the current configuration of the house by using one of the following
commands in conjunction to the parameter `--list`:

* rooms - prints the list of rooms in the house
* lights - prints the list of lights in the house
* shutters - prints out the list of shutters/blinds
* clima - prints out the list of thermostats/dehumidifiers in the house

### Rooms
Rooms only support `list` action:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT rooms --list`

```text
GEN#PL#0 - root
GEN#PL#1 - Living room
GEN#PL#2 - Kitchen
GEN#PL#3 - Hallway
GEN#PL#4 - Room 1
GEN#PL#5 - Room 2
GEN#PL#6 - Bedroom
GEN#PL#7 - Bathroom 1
GEN#PL#8 - Bathroom 2
GEN#PL#9 - Terrace
```

### Lights

As with `rooms` you can get the list of the house lights by using the `lights` command:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT lights --list`

```text
0 - Entrance spotlights (status ON)
1 - Main entrance (status OFF)
2 - Kitchen (status OFF)
3 - Main living room (status OFF)
4 - Spotlights living room (status OFF)
5 - Bedroom left (status OFF)
6 - Bedroom right (status OFF)
7 - Bathroom 1 (status OFF)
8 - Bathroom 2 (status OFF)
9 - Terrace (status OFF)
```

Then, with the number printed in the list, you can interact with the specific light and turn it on and off:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT lights --toggle 3`

The above command should toggle light number 3 of the list.

### Shutters

Shutters work in the same way of lights. Use:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT shutters --list`

to get a list of shutters in the house. Then use:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT shutters --toggle 0`

to open/close the shutter number 0 in the list

### Outlets / Other devices

Outlets work in the same way of lights. Use:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT outlets --list`

to get a list of outlets in the house. Then use:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT outlets --toggle 0`

to turn on/off the outlet number 0 in the list

### Thermostats and dehumidifiers

To get a list of thermostats in the house use the command 

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT clima --list`

Then, to turn on and off a specific thermostat, use

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT clima --toggle 0`

To change the temperature for a specific thermostat, use the `--temp` parameter:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT clima --toggle 0 --temp 21.5`

The above command will set the temperature of thermostat 0 to 21.5 Celsius degrees.

To change the season for a specific thermostat, use the `--season` parameter:

`comelit-sb -h SERIAL_BRIDGE_IP -p PORT clima --toggle 0 --season [summer|winter]`

## Comelit HUB

This is a CLI to interact with the new HUB. This model uses MQTT to update status on external systems.

### Basic usage
When using the tool, you can pass the host of the HUB. If you don't specify them, the CLI will try
to find it on your network automatically.

`comelit -h HUB_IP `

You can query the system and ask to show the current configuration of the house by using one of the following
commands in conjunction to the parameter `--list`:

* rooms - prints the list of rooms in the house
* lights - prints the list of lights in the house
* shutters - prints out the list of shutters/blinds
* clima - prints out the list of thermostats/dehumidifiers in the house
* others - prints out the list of uncategorized (others) devices in the house

### Rooms
Rooms only support `list` action:

`comelit rooms --list`

```text
GEN#PL#0 - root
GEN#PL#1 - Living room
GEN#PL#2 - Kitchen
GEN#PL#3 - Hallway
GEN#PL#4 - Room 1
GEN#PL#5 - Room 2
GEN#PL#6 - Bedroom
GEN#PL#7 - Bathroom 1
GEN#PL#8 - Bathroom 2
GEN#PL#9 - Terrace
```

### Lights

As with `rooms` you can get the list of the house lights by using the `lights` command:

`comelit lights --list`

```text
DOM#LT#0 - Entrance spotlights (status ON)
DOM#LT#1 - Main entrance (status OFF)
DOM#LT#2 - Kitchen (status OFF)
DOM#LT#3 - Main living room (status OFF)
DOM#LT#4 - Spotlights living room (status OFF)
DOM#LT#5 - Bedroom left (status OFF)
DOM#LT#6 - Bedroom right (status OFF)
DOM#LT#7 - Bathroom 1 (status OFF)
DOM#LT#8 - Bathroom 2 (status OFF)
DOM#LT#9 - Terrace (status OFF)
```

Then, with the ID printed in the list, you can interact with the specific light and turn it on and off:

`comelit lights --toggle DOM#LT#3`

The above command should toggle light with ID `DOM#LT#3` of the list.

### Shutters

Shutters work in the same way of lights. Use:

`comelit shutters --list`

to get a list of shutters in the house. Then use:

`comelit shutters --toggle DOM#BL#0`

to open/close the shutter with ID `DOM#BL#0` in the list

### Outlets devices

Outlets work in the same way of lights. Use:

`comelit outlets --list`

to get a list of outlets in the house. Then use:

`comelit outlets --toggle DOM#LC#0`

to turn on/off the outlet with ID `DOM#LC#0` in the list

### Thermostats and dehumidifiers

To get a list of thermostats in the house use the command 

`comelit clima --list`

Then, to turn on and off a specific thermostat, use

`comelit clima --toggle DOM#CL#0`

To change the temperature for a specific thermostat, use the `--temp` parameter:

`comelit clima --toggle DOM#CL#0 --temp 21.5`

The above command will set the temperature of thermostat `DOM#CL#0` to 21.5 Celsius degrees.

To change the season for a specific thermostat, use the `--season` parameter:

`comelit clima --toggle DOM#CL#0 --season [summer|winter]`

