// const raspi = require('raspi');
const gpio = require('raspi-gpio');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

const stop = require('./stop');

errorCount = 0;
startCount = 0;

let START_COMMANDS = ['AT+CGNSPWR=1', 'AT+SAPBR=1,1', 'AT+SAPBR=2,1', 'AT+HTTPINIT'];

let START_COMMANDS_RESET = [...START_COMMANDS];

const port = new SerialPort('/dev/ttyS0', {
	baudRate: 57600
});

const parser = port.pipe(new Readline());

const start = () => {
	return new Promise((resolve, reject) => {
		const output = new gpio.DigitalOutput('P1-31');
		output.write(gpio.HIGH);

		initTimeout = setTimeout(() => {
			output.write(gpio.LOW);
			write(START_COMMANDS[0]);
			clearTimeout(initTimeout);
		}, 1000);

		const parseStart = data => {
			response = evaluateStart(data);
			if (response === true) {
                resolve({ port, parser });
                startCount = 0;
				START_COMMANDS = [...START_COMMANDS_RESET];
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

const includesAny = (string, arr) => {
	let match;
	arr.map(i => {
		if (string.includes(i)) match = i;
	});
	return match;
};

const write = (cmd) => {
	port.write(cmd + '\r\n');
};

const evaluateStart = (data) => {

    if (startCount == 0) {
		currentCommand = START_COMMANDS.shift();
		startCount++;
    }
    
    const availableResponses = ['OK', 'ERROR'];
	switch (includesAny(data, availableResponses)) {
        case 'OK':
            errorCount = 0;
			if (START_COMMANDS.length != 0) {
				currentCommand = START_COMMANDS.shift();
				write(currentCommand);
			} else {
                return true;
            }
        break;
        case 'ERROR':
            if (errorCount <= 5) {
                write(currentCommand);
                errorCount++;
            } else {
				START_COMMANDS = [...START_COMMANDS_RESET];
				startCount = 0;
                stop(port, parser).then(res => {
                    write(START_COMMANDS[0]);
                })
            }
       	break;
    }
}

module.exports = start;
