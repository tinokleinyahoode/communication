const raspi = require('raspi');
const gpio = require('raspi-gpio');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

let COMMANDS = [
	'AT+HTTPPARA="URL","http://sea-drone-center.herokuapp.com/api/boats/1"',
	'AT+HTTPPARA="CID",1',
	'AT+HTTPPARA="CONTENT","application/json"',
	'AT+HTTPDATA=',
	'AT+HTTPACTION=1',
	'AT+HTTPREAD=0,'
];

let START_COMMANDS = ['AT+CGNSPWR=0', 'AT+SAPBR=1,1', 'AT+SAPBR=2,1', 'AT+HTTPINIT'];
let STOP_COMMANDS = ['AT+SAPBR=0,1', 'AT+HTTPTERM'];

let STOP_COMMANDS_RESTART = [];
let USED_COMMANDS = [];

let COMMANDSRESET = [...COMMANDS];
let START_COMMANDS_RESET = [...START_COMMANDS];
let STOP_COMMANDS_RESET = [...STOP_COMMANDS];

let errorCount = 0;
let startCount = 0;
let result, bytes, command, currentCommand, response;

const port = new SerialPort('/dev/ttyS0', {
	baudRate: 57600
});

const start = () => {
	return new Promise((resolve, reject) => {
		const output = new gpio.DigitalOutput('P1-31');
		output.write(gpio.HIGH);

		const parser = port.pipe(new Readline({ delimiter: '\r\n' }), { autoOpen: true });

		setTimeout(() => {
			output.write(gpio.LOW);
			command = 'start';
			write(START_COMMANDS[0]);
		}, 1000);

		const parseStart = data => {
			response = evaluate(data);
			if (response === 'started') {
				console.log('[ MODEM STARTED SUCCESSFULLY ]');
				resolve(port);
				reset();
				parser.removeListener('data', parseStart);
			}
		};

		parser.on('data', parseStart);
		parser.on('error', err => reject(err.data));
	});
};

const stop = () => {
	return new Promise((resolve, reject) => {
		write(STOP_COMMANDS[0]);

		const parseStop = data => {
			command = 'stop';
			let response = evaluate(data);
			if (response === 'stopped') {
				resolve(response);
				reset();
				parser.removeListener('data', parseStop);
			}
		};

		parser.on('data', parseStop);
		parser.on('error', err => reject(err.data));
	});
};

const post = pos => {
	return new Promise((resolve, reject) => {
		const parser = port.pipe(new Readline(), { autoOpen: true });

		write(COMMANDS[0]);

		const parsePost = data => {
			command = 'post';
			let response = evaluate(data, pos);
			if (response === 'serverResponse') {
				resolve(result);
				reset();
				parser.removeListener('data', parsePost);
			}
		};

		parser.on('data', parsePost);
		parser.on('error', err => reject(err.data));
	});
};

const reset = () => {
	USED_COMMANDS = [];
	startCount = 0;

	if(command === 'start') START_COMMANDS = [...START_COMMANDS_RESET];
	if(command === 'stop') STOP_COMMANDS = [...STOP_COMMANDS_RESET];
	if(command === 'post') COMMANDS = [...COMMANDSRESET];
}

const includesAny = (string, arr) => {
	let match;
	arr.map(i => {
		if (string.includes(i)) match = i;
	});
	return match;
};

const write = (cmd, params = '', option = '') => {
	console.log('GSM > ', cmd);
	if (option == 'send') {
		port.write(params + '\r\n');
	} else {
		port.write(cmd + params + '\r\n');
	}
};

const evaluate = (data, pos = '') => {
	console.log('GSM < ', data);
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

	let availableResponses = ['ERROR', 'DOWNLOAD', '+HTTPACTION:', 'position', 'OK'];
	switch (includesAny(data, availableResponses)) {
		case 'OK':
			switch (command) {
				case 'start':
					errorCount = 0;
					if (com.length != 0) {
						currentCommand = com.shift();
						write(currentCommand);
					} else {
						return 'started';
					}
					break;
				case 'stop':
				case 'stop_restart':
					if (com.length != 0) {
						currentCommand = com.shift();
						write(currentCommand);
					} else {
						if (command === 'stop_restart') {
							command = 'start';
							reset();
							write(START_COMMANDS[0]);
						} else {
							return 'stopped';
						}
					}
					break;
				case 'post':
					if (currentCommand === 'AT+HTTPPARA="CONTENT","application/json"') {
						bytes = pos.length;
						currentCommand = com.shift();
						write(currentCommand, bytes + ',2000');
					} else if(currentCommand != 'AT+HTTPACTION=1'){
						if (com.length != 0) {
							currentCommand = com.shift();
							write(currentCommand);
						} 
						// else {
							
						// }
					}
					break;
				default:
			}
			break;
		case 'DOWNLOAD':
			currentCommand = 'download';
			write(pos, 'send');
			break;
		case '+HTTPACTION:':
			let param = data.split(',').pop();
			currentCommand = com.shift();
			write(currentCommand, param);
			break;
		case 'position':
				result = data;
				return 'serverResponse';
			break;
		case 'ERROR':
			if (errorCount <= 5) {
				write(currentCommand);
				errorCount++;
			} else {
				if (command === 'start') {
					command = 'stop_restart';
					errorCount = 0;
					startCount = 0;

					if (includesAny('AT+SAPBR=1,1', USED_COMMANDS)) STOP_COMMANDS_RESTART.push('AT+SAPBR=0,1');
					if (includesAny('AT+HTTPINIT', USED_COMMANDS)) STOP_COMMANDS_RESTART.push('AT+HTTPTERM');
					write(STOP_COMMANDS_RESTART[0]);
				} else if (command === 'stop_restart') {
					reset();
					write(START_COMMANDS[0]);
				}
			}
			break;
	}
};

module.exports = { start, stop, post };
