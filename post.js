let errorCount = 0;
let startCount = 0;
let result;
let port = null;
let parser = null;

let POST_COMMANDS = [
	'AT+HTTPPARA="URL",',
	'AT+HTTPACTION=1',
	'AT+HTTPREAD=0,'
];

/* additional POST_COMMANDS / Body transfer */
// 'AT+HTTPPARA="CID",1',
// 'AT+HTTPPARA="CONTENT","application/json"',
// 'AT+HTTPDATA=',	

POST_COMMANDS_RESET = [...POST_COMMANDS];

const post = (port, parser, pos, url='"http://sea-drone-center.herokuapp.com/api/boats/1') => {
	return new Promise((resolve, reject) => {
		const { position, heading, speed, clear } = JSON.parse(pos);

		const queryString = `?position=${position}&heading=${heading}&speed=${speed}&clear=${clear}&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNWU2OTgwYTRmODljMmYwYzkzNTA0YmJjIn0sImlhdCI6MTU4NDAxNzk1MiwiZXhwIjoxNTg0MTA0MzUyfQ.Y5gUImf4lO6Pyh-THPUJ2W9WWl3FFS5tk_hMFf-fA6E"`;

		write(port, POST_COMMANDS[0] + url + queryString);

		const parsePost = data => {
			let response = evaluatePost(port, data);
			if (response === true) {
				startCount = 0;
				POST_COMMANDS = [...POST_COMMANDS_RESET];
				parser.removeListener('data', parsePost);
				resolve(result);
			} else if(response === false) {
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

const includesAny = (string, arr) => {
	let match;
	arr.map(i => {
		if (string.includes(i)) match = i;
	});
	return match;
};

const write = (port, cmd, params = '') => {
	port.write(cmd + params + '\r\n');
	params = '';
};

const evaluatePost = (port, data) => {

	if (startCount == 0) {
		currentCommand = POST_COMMANDS.shift();
		startCount++;
	}

	const availableResponses = ['ERROR', '+HTTPACTION:', 'coordinates', 'OK'];
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
			startCount = 0;
			POST_COMMANDS = [...POST_COMMANDS_RESET];
			break;
	}
};

module.exports = post, POST_COMMANDS, POST_COMMANDS_RESET;
