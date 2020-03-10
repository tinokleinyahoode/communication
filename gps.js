const Readline = require('@serialport/parser-readline');

let GPS_COMMAND = 'AT+CGNSINF'; 

let gps_error_count = 0;
let coord, result;
const port = null;
const parser = null

const getPosition = (port, parser) => {
	return new Promise((resolve, reject) => {
		
		write(port,GPS_COMMAND);

		const parsePosition = data => {
			let response = evaluate(port, data);
			if (response === true) {
				resolve(JSON.stringify(coord));
				parser.removeListener('data', parsePosition);
			}
		};

		const errorPosition = () => {
			reject(err.data);
			parser.removeListener('data', errorPosition);
		}

		parser.on('data', parsePosition).on('error', errorPosition );
	});
};

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

const evaluate = (port, data) => { 
	console.log('GPSparse << ', data);
	
	const availableResponses = ['ERROR', '+CGNSINF:', 'OK']; 
	switch (includesAny(data, availableResponses)) {
		case 'OK':
			if(coord){
				return true;
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
			} else {
				setTimeout(() => {
					write(port,GPS_COMMAND);
				}, 5000);
			}
			break;
		case 'ERROR':
			if (gps_error_count < 5) {
				gps_error_count++
				write(port,GPS_COMMAND);
			}else{
				return false;
			}
			break;
	}
};

module.exports = getPosition;