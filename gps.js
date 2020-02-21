// const raspi = require('raspi');
// const gpio = require('raspi-gpio');
// const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

// , 'AT+CGNSPWR=0'
let GPS_COMMANDS = ['AT+CGNSPWR=1', 'AT+CGNSTST=1', 'AT+CGNSTST=0', 'AT+CGNSINF'];
const GPS_COMMANDS_RESET = [...GPS_COMMANDS];

let gps_error_count = 0;
let gps_startCount = 0;
let coord, result, currentCommand;

const includesAny = (string, arr) => {
	let match;
	arr.map(i => {
		if (string.includes(i)) match = i;
	});
	return match;
};

const gps_write = (port, cmd) => {
	port.write(cmd + '\r\n');
	parse = port.pipe(new Readline({}));
};

const getPosition = port => {
	return new Promise((res, rej) => {
		const parse = port.pipe(new Readline({}));
		gps_write(port, GPS_COMMANDS[0]);

		parse.on('data', data => {
			parse = null;
			let response = evaluate_gps(port, data);
			if (response === 'position') {
				gps_startCount = 0;
				res(JSON.stringify(coord));
			}
		});
		parse.on('error', err => reject(err.data));
	});
};

const evaluate_gps = (port, data) => {
	console.log('> ', data);
	if (gps_startCount == 0) {
		currentCommand = GPS_COMMANDS.shift();
		gps_startCount++;
	}
	let availableResponses = ['ERROR', '+CGNSINF:', 'OK'];

	switch (includesAny(data, availableResponses)) {
		case 'OK':
			if (currentCommand != 'AT+CGNSINF') {
				if (GPS_COMMANDS.length != 0) {
					currentCommand = GPS_COMMANDS.shift();
					gps_write(port, currentCommand);
				}
			}
			break;
		case '+CGNSINF:':
			result = data.split(',');
			if (result[3] != '') {
				coord = {
					position: [parseFloat(result[3]), parseFloat(result[4])],
					heading: parseFloat(result[7]),
					speed: parseFloat(result[6]),
					clear: true
				};
				GPS_COMMANDS = [...GPS_COMMANDS_RESET];
				return 'position';
			} else {
				setTimeout(() => {
					gps_write(port, currentCommand);
				}, 5000);
				// GPS_COMMANDS = GPS_COMMANDS_RESET.slice();
			}
			break;
		case 'ERROR':
			console.log('--- RESET ---');
			// if (gps_error_count < 5) {
			// 	gps_error_count++;
			// 	gps_write(port, currentCommand);
			// } else {
			// 	GPS_COMMANDS = COMMANDSRESET;
			// 	gps_write(port, GPS_COMMANDS[0]);
			// }
			break;
	}
};

module.exports = getPosition;
