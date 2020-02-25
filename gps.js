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

const write = (port, cmd) => {
	console.log('GPScmd >>', cmd);
	port.write(cmd + '\r\n');
};

const getPosition = port => {
	return new Promise((resolve, reject) => {
		const parser = port.pipe(new Readline({}));
		write(port, GPS_COMMANDS[0]);

		const parsePosition = data => {
			let response = evaluate(port, data);
			if (response === 'position') {
				resolve(JSON.stringify(coord));
				gps_startCount = 0;
				GPS_COMMANDS = [...GPS_COMMANDS_RESET];
				parser.removeListener('data', parsePosition);
			}
		};

		parser.on('data', parsePosition);
		parser.on('error', err => reject(err.data));
	});
};

const evaluate = (port, data) => {
	console.log('GPSparse << ', data);
	if (gps_startCount == 0) {
		currentCommand = GPS_COMMANDS.shift();
		gps_startCount++;
	}

	const availableResponses = ['ERROR', '+CGNSINF:', 'OK'];
	switch (includesAny(data, availableResponses)) {
		case 'OK':
			if (currentCommand != 'AT+CGNSINF') {
				if (GPS_COMMANDS.length != 0) {
					currentCommand = GPS_COMMANDS.shift();
					write(port, currentCommand);
				}
			}
			break;
		case '+CGNSINF:':
			result = data.split(',');
			if (result[3] != '') {
				coord = {
					id:1,
					position: [parseFloat(result[3]), parseFloat(result[4])],
					heading: parseFloat(result[7]),
					speed: parseFloat(result[6]),
					clear: true
				};
				return 'position';
			} else {
				setTimeout(() => {
					write(port, currentCommand);
				}, 5000);
			}
			break;
		case 'ERROR':
			console.log('--- RESET ---');
			if (gps_error_count < 5) {
				gps_error_count++;
				write(port, currentCommand);
			} else {
				GPS_COMMANDS = COMMANDSRESET;
				write(port, GPS_COMMANDS[0]);
			}
			break;
	}
};

module.exports = getPosition;
