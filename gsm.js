const raspi = require('raspi');
const gpio = require('raspi-gpio');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

const COMMANDS = [
	'AT+HTTPPARA="URL","http://sea-drone-center.herokuapp.com/api/boats/1"',
	'AT+HTTPPARA="CID",1',
	'AT+HTTPPARA="CONTENT","application/json"',
	'AT+HTTPDATA=',
	'AT+HTTPACTION=1',
	'AT+HTTPREAD=0,'
];

let START_COMMANDS = ['AT+SAPBR=1,1', 'AT+SAPBR=2,1', 'AT+HTTPINIT'];
const STOP_COMMANDS = ['AT+SAPBR=0,1', 'AT+HTTPTERM'];

let STOP_COMMANDS_RESTART = [];
let USED_COMMANDS = [];

let COMMANDSRESET = COMMANDS.slice();
let START_COMMANDS_RESET = START_COMMANDS.slice();
let STOP_COMMANDS_RESET = STOP_COMMANDS.slice();

let error_count = 0;
let startCount = 0;
let result, bytes, command, currentCommand;

const port = new SerialPort('/dev/ttyS0', { baudRate: 57600 });
const parser = port.pipe(new Readline({}), { autoOpen: true }); //{ delimiter: '\r\n' }

start = () => {
	return new Promise((resolve, reject) => {
		const output = new gpio.DigitalOutput('P1-31');
		output.write(gpio.HIGH);

		setTimeout(() => {
			output.write(gpio.LOW);
			command = 'start';
			write(START_COMMANDS[0]);
		}, 1000);

		parser.on('data', data => {
			let response = evaluate(data);
			if (response === 'started') resolve(port);
		});
	});
};

const stop = () => {
	return new Promise((resolve, reject) => {
		write(STOP_COMMANDS[0]);
		parser.on('data', data => {
			command = 'stop';
			let response = evaluate(data);
			resolve(response);
		});
	});
};

const includesAny = (string, arr) => {
	let match;
	arr.map(i => {
		if (string.includes(i)) match = i;
	});
	return match;
};

const write = (cmd, params = '', option = '') => {
	console.log('> ', cmd);
	if (option == 'send') {
		port.write(params + '\r\n');
	} else {
		params = '';
		port.write(cmd + '\r\n');
	}
};

const evaluate = data => {
	console.log('< ', data);
	if (command === 'start') com = START_COMMANDS;
	if (command === 'stop') com = STOP_COMMANDS;
	if (command === 'post') com = COMMANDS;
	if (command === 'stop_restart') com = STOP_COMMANDS_RESTART;

	if (startCount == 0) {
		currentCommand = com.shift();
		startCount++;
	}

	// error handling
	USED_COMMANDS.push(currentCommand);

	let availableResponses = ['ERROR', 'DOWNLOAD', '+HTTPACTION:', 'OK'];
	switch (includesAny(data, availableResponses)) {
		case 'OK':
			if (command === 'start') {
				error_count = 0;
				if (com.length != 0) {
					currentCommand = com.shift();
					write(currentCommand);
				} else {
					return 'started';
				}
			} else if (command === 'stop' || command === 'stop_restart') {
				if (com.length != 0) {
					currentCommand = com.shift();
					write(currentCommand);
				} else {
					if (command === 'stop_restart') {
						command = 'start';
						startCount = 0;
						USED_COMMANDS = [];
						write(START_COMMANDS[0]);
					} else {
						return 'stopped';
					}
				}
			} else if (command == 'post') {
				if (currentCommand != 'AT+HTTPACTION=1' && currentCommand != 'AT+HTTPPARA="CONTENT","application/json"') {
					if (com.length == 1) {
						write(currentCommand);
					} else {
						if (errorCount == 0) {
							resolve(result);
						} else {
							reject(errordata);
						}
					}
				} else if (currentCommand == 'AT+HTTPPARA="CONTENT","application/json"') {
					write(bytes + ',2000');
				} else if (currentCommand.includes('AT+HTTPPARA="URL",')) {
					write(currentCommand, url);
				}
			}
			break;
		case 'DOWNLOAD':
			write(pos, 'send');
			break;
		case '+HTTPACTION:':
			let param = data.split(',').pop();
			write(currentCommand, param);
			break;
		case 'ERROR':
			if (error_count < 5) {
				error_count++;
				write(currentCommand);
			} else {
				if (command === 'start') {
					START_COMMANDS = START_COMMANDS_RESET.slice();
					command = 'stop_restart';
					error_count = 0;

					if (includesAny('AT+SAPBR=1,1', USED_COMMANDS)) STOP_COMMANDS_RESTART.push('AT+SAPBR=0,1');
					if (includesAny('AT+HTTPINIT', USED_COMMANDS)) STOP_COMMANDS_RESTART.push('AT+HTTPTERM');
					write(STOP_COMMANDS_RESTART.shift());
				} else if (command == 'stop') {
				}
			}
			break;
		// default:
		// if(currentCommand.includes('AT+HTTPREAD=0,')){
		//     console.log('read');
		//     if(!data.includes('+HTTPREAD:') && !data.includes('AT+HTTPREAD=0,')){
		//         result = data;
		//     }
		// }
		// break;
	}
};

post = (pos, url) => {
	pos = JSON.stringify(pos);
	bytes = pos.length;

	write(COMMANDS[0]);

	parser.on('data', data => evaluate(data, 'post'));
	parser.on('error', err => reject(err.data));
};

module.exports = { start, stop, post };
