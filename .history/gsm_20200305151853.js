const raspi = require('raspi');
const gpio = require('raspi-gpio');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

let POST_COMMANDS = [
	'AT+HTTPPARA="URL",',
	// 'AT+HTTPPARA="CID",1',
	// 'AT+HTTPPARA="CONTENT","application/json"',
	// 'AT+HTTPDATA=',
	'AT+HTTPACTION=1',
	'AT+HTTPREAD=0,'
];

let START_COMMANDS = ['AT+CGNSPWR=1', 'AT+SAPBR=1,1', 'AT+SAPBR=2,1', 'AT+HTTPINIT'];
let STOP_COMMANDS = ['AT+SAPBR=0,1', 'AT+HTTPTERM'];

let STOP_COMMANDS_RESTART = [];
let USED_COMMANDS = [];

let POST_COMMANDS_RESET = [...POST_COMMANDS];
let START_COMMANDS_RESET = [...START_COMMANDS];
let STOP_COMMANDS_RESET = [...STOP_COMMANDS];

let errorCount = 0;
let startCount = 0;
let result, command, currentCommand, response; //bytes

const port = new SerialPort('/dev/ttyS0', {
	baudRate: 57600
});

const parser = port.pipe(new Readline());

const start = () => {
	return new Promise((resolve, reject) => {
		const output = new gpio.DigitalOutput('P1-31');
		output.write(gpio.HIGH);

		setTimeout(() => {
			output.write(gpio.LOW);
			command = 'start';
			write(START_COMMANDS[0]);
		}, 1000);

		const parseStart = data => {
			response = evaluate(data);
			if (response === 'started') {
				console.log('[ MODEM STARTED SUCCESSFULLY ]');
				resolve({ port, parser });
				reset();
				parser.removeListener('data', parseStart);
			}
		};

		const errorStart = err => {
			reject(err.data);
			parser.removeListener('error', errorStart);
		};

		parser.on('data', parseStart).on('error', errorStart);
	});
};

const stop = () => {
	return new Promise((resolve, reject) => {

		// reset();
		command = 'stop';
		write(STOP_COMMANDS[0]);
		
		const parseStop = data => {
			let response = evaluate(data);
			if (response === true) {
				resolve(response);
				reset();
				parser.removeListener('data', parseStop);
			} 
		};

		const errorStop = err => {
			reject(err.data);
			parser.removeListener('error', errorStop);
		};

		parser.on('data', parseStop).on('error', errorStop);
	});
};

const post = pos => {
	return new Promise((resolve, reject) => {
		const { position, heading, speed, clear } = JSON.parse(pos);
		url = '"http://sea-drone-center.herokuapp.com/api/boats/1';
		queryString = `?position=${position}&heading=${heading}&speed=${speed}&clear=${clear}"`;

		write(POST_COMMANDS[0] + url + queryString);

		const parsePost = data => {
			command = 'post';
			let response = evaluate(data, pos);
			if (response === 'serverResponse') {
				console.log('RESULT: ', result);
				resolve(result);
				reset();
				parser.removeListener('data', parsePost);
			}
		};

		const errorPost = err => {
			reject(err.data);
			parser.removeListener('error', errorPost);
		};

		parser.on('data', parsePost).on('error', errorPost);
	});
};

const reset = () => {
	startCount = 0;
	errorCount = 0;
	
	USED_COMMANDS = [];

	START_COMMANDS = [...START_COMMANDS_RESET];
	STOP_COMMANDS = [...STOP_COMMANDS_RESET];
	POST_COMMANDS = [...POST_COMMANDS_RESET];
};

const resetListener = () =>{
	parser.removeListener('data', parseStart);
	parser.removeListener('data', parseStop);
	parser.removeListener('data', parsePost);
	parser.removeListener('data', parsePosition);
}

const includesAny = (string, arr) => {
	let match;
	arr.map(i => {
		if (string.includes(i)) match = i;
	});
	return match;
};

const write = (cmd, params = '', option = '') => {
	console.log('GSM > ', cmd + params);
	if (option === 'send') {
		port.write(cmd + '\r\n');
	} else {
		port.write(cmd + params + '\r\n');
	}
};

const evaluate = (data, pos = '') => {
	console.log('GSM < ', data);
	if (command === 'start') com = START_COMMANDS;
	if (command === 'stop') com = STOP_COMMANDS;
	if (command === 'post') com = POST_COMMANDS;
	if (command === 'stop_restart') com = STOP_COMMANDS_RESTART;

	if (startCount == 0) {
		currentCommand = com.shift();
		startCount++;
	}

	USED_COMMANDS.push(currentCommand);

	// let availableResponses = ['ERROR', 'DOWNLOAD', '+HTTPACTION:', 'coordinates', 'OK', 'AT+HTTPPARA="URL"'];
	let availableResponses = ['ERROR', '+HTTPACTION:', 'coordinates', 'OK'];
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
				// case 'stop_restart':
					if (com.length != 0) {
						currentCommand = com.shift();
						write(currentCommand);
					} else {
						return true;
					}
					break;
				case 'stop_restart':
					if (com.length != 0) {
						currentCommand = com.shift();
						write(currentCommand);
					} else {
						command = 'start';
						reset();
						write(START_COMMANDS[0]);
					}
					break;
				case 'post':
					// if (currentCommand === 'AT+HTTPPARA="CONTENT","application/json"') {
					// 	bytes = pos.length;
					// 	currentCommand = com.shift();
					// 	write(currentCommand, bytes + ',2000');
					// } else
					if (currentCommand != 'AT+HTTPACTION=1') {
						if (com.length != 0) {
							currentCommand = com.shift();
							write(currentCommand);
						} else {
							return 'serverResponse';
						}
					}
					break;
				default:
			}
			break;
		// case 'DOWNLOAD':
		// 	currentCommand = 'download';
		// 	write(pos, '', 'send');
		// 	break;
		case '+HTTPACTION:':
			let param = data.split(',').pop();
			currentCommand = com.shift();
			write(currentCommand, param);
			break;
		case 'coordinates':
			result = data;
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
					command = 'start';
					write(START_COMMANDS[0]);
				}else if(command === 'stop'){
					reset();
					currentCommand = 'start';
					write(START_COMMANDS[0]);
				}else if(command === 'post'){
					reset();
				}
			}
			break;
	}
};

module.exports = { start, stop, post, reset, resetListener };
