// const raspi = require('raspi');
// const gpio = require('raspi-gpio');
// const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

// , 'AT+CGNSPWR=0' 
let GPS_COMMANDS = ['AT+CGNSPWR=1', 'AT+CGNSTST=1', 'AT+CGNSTST=0', 'AT+CGNSINF'];
const COMMANDSRESET = GPS_COMMANDS.slice();

let error_count = 0;
let startCount = 0;
let coord, result, port, currentCommand;

const includesAny = (string, arr) => {
	let match;
	arr.map(i => {
		if (string.includes(i)) match = i;
	});
	return match;
};

const gps_write = (port, cmd) => {
	port.write(cmd + '\r\n');
};

const getPosition = port => {
	return new Promise((res, rej) => {
		parse = port.pipe(new Readline({ delimiter: '\r\n' }))
		gps_write(port, GPS_COMMANDS[0]);
		// GPS_COMMANDS = COMMANDSRESET.slice();

		parse.on('data', data => {
			let response = getResults(data);
            if(response == 'position'){
                res(coord);
			}
		})
		parse.on('error', err => reject(err.data));
	});
};

const getResults = data => {
	console.log("> ",data);
	if(startCount == 0) { currentCommand = GPS_COMMANDS.shift(); startCount++; };
	let availableResponses = ['ERROR', '+CGNSINF:', 'OK'];

	switch (includesAny(data, availableResponses)) {
		case 'OK':
			if(currentCommand != 'AT+CGNSINF'){
				if(GPS_COMMANDS.length != 0){
					currentCommand = GPS_COMMANDS.shift();
				console.log("cc: ",currentCommand);
					gps_write(port, currentCommand);
				}else{
					return 'position';	
				}
			}
			break;
		case '+CGNSINF:':
			result = data.split(',');
			if (result[3] != '') {
				coord = {
					position: [
						result[3],
						result[4]
					],
					heading: result[7],
					speed: result[6],
					clearCommandList: true
				};
			} else {
				setTimeout(() => {
					gps_write(port, currentCommand);
				}, 5000);
			}
			break;
		case 'ERROR':
			console.log('--- RESET ---');
			if (error_count < 5) {
				error_count++;
				gps_write(port, currentCommand);
			}else{	
				GPS_COMMANDS = COMMANDSRESET;
				gps_write(port, GPS_COMMANDS[0]);
				// reject('GPS Error');
			}
			break;
	}
}

module.exports = getPosition;