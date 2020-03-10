let errorCount = 0;
let startCount = 0;
let result;

let POST_COMMANDS = [
	'AT+HTTPPARA="URL",',
	// 'AT+HTTPPARA="CID",1',
	// 'AT+HTTPPARA="CONTENT","application/json"',
	// 'AT+HTTPDATA=',
	'AT+HTTPACTION=1',
	'AT+HTTPREAD=0,'
];

POST_COMMANDS_RESET = [...POST_COMMANDS];

const post = (port, parser, pos) => {
		return new Promise((resolve, reject) => {
			const { position, heading, speed, clear } = JSON.parse(pos);

			url = '"http://sea-drone-center.herokuapp.com/api/boats/1';
			queryString = `?position=${position}&heading=${heading}&speed=${speed}&clear=${clear}"`;

			write(port, POST_COMMANDS[0] + url + queryString);

			parsePost = data => {
				let response = evaluatePost(port, data);
				if (response === true) {
					resolve(result);
					startCount = 0;
					POST_COMMANDS = [...POST_COMMANDS_RESET];
					parser.removeListener('data', parsePost);
				} else if(response === false) {
					parser.removeListener('data', parsePost);
				}
				// else {
				// 	startCount = 0;
				// 	POST_COMMANDS = [...POST_COMMANDS_RESET];
				// 	resolve(response);
				// }
			};

			const errorPost = err => {
				reject(err.data);
				parser.removeListener('error', errorPost);
			};

			parser.on('data', parsePost).on('error', errorPost);
		});
	};

const includesAny = (string, arr) => {
	let match;
	arr.map(i => {
		if (string.includes(i)) match = i;
	});
	return match;
};

const write = (port, cmd, params = '') => {
	console.log('POST >> ', cmd + params);
	port.write(cmd + params + '\r\n');
	params = '';
	
};

const evaluatePost = (port, data) => {
	console.log('POST << ', data);

	if (startCount == 0) {
		currentCommand = POST_COMMANDS.shift();
		startCount++;
	}

	let availableResponses = ['ERROR', '+HTTPACTION:', 'coordinates', 'OK'];
	switch (includesAny(data, availableResponses)) {
		case 'OK':
			if (currentCommand != 'AT+HTTPACTION=1') {
				if (POST_COMMANDS.length != 0) {
					currentCommand = POST_COMMANDS.shift();
					write(port, currentCommand);
				} else {
					return true;
				}
			}
			break;
		case '+HTTPACTION:':
			let param = data.split(',').pop();
			currentCommand = POST_COMMANDS.shift();
			write(port, currentCommand, param);
			break;
		case 'coordinates':
			result = data;
			break;
		case 'ERROR':
			if (errorCount <= 5) {
				write(port, currentCommand);
				errorCount++;
			} else {
				return false;
			}
			break;
	}
};

module.exports = post;
