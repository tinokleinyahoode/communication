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

const START_COMMANDS = [
    'AT+SAPBR=1,1',
    'AT+SAPBR=2,1',
    'AT+HTTPINIT'
]

const STOP_COMMANDS = [
    // 'AT+HTTPTERM',
    'AT+SAPBR=0,1'
]

let errorCount = 0;
let startCount = 0;
let result, bytes, port, parser, currentCommand;

start = () => {
    // console.log("function: ",'start');
    return new Promise((resolve, reject) => {
        
            const output = new gpio.DigitalOutput('P1-31');
            output.write(gpio.HIGH);

            port = new SerialPort('/dev/ttyS0', { baudRate: 57600 });
            parser = port.pipe(new Readline()); //{ delimiter: '\r\n' }

            setTimeout(() => {
                output.write(gpio.LOW);
                write(START_COMMANDS[0]); 
            }, 1000);

            parser.on('data', data => {
                let response = evaluate(data, 'start');
                if(response == 'started'){
                    resolve(port);
                }
            });
            
    })
};

stop = () => {
    // console.log("function: ",'stop');
    return new Promise((resolve, reject) => {
        write(STOP_COMMANDS[0]);
        parser.on('data', data => {  
            let response = evaluate(data, 'stop');
            resolve(response);
        });
    });
}

const includesAny = (string, arr) => {
    let match;
    arr.map(i => {
        if (string.includes(i)) match = i;
    });
    return match;
};

const write = (cmd, params = '', option = '') => {
    console.log("> ",cmd);
    if(option == 'send'){
        port.write(params + '\r\n');
    }else{
        params = '';
        port.write(cmd + '\r\n');
    }
};

const evaluate = (data, commands) => {
    // console.log("commands: ",commands);
        console.log("< ",data);
        switch(commands){
            case 'start':
                com = START_COMMANDS;
                break;
            case 'stop':
                com = STOP_COMMANDS;
                break;
            case 'post':
                com = COMMANDS;
                break;
        }
        
        if(startCount == 0) { currentCommand = com.shift(); startCount++; };
        let availableResponses = ['ERROR', 'DOWNLOAD', '+HTTPACTION:', 'OK'];  
        switch (includesAny(data, availableResponses)) {
            case 'OK':
                if(commands == 'start'){
                    if(com.length != 0){
                        currentCommand = com[0]
                        write(com.shift());
                    }else{
                        return 'started';
                    }    

                }else if(commands == 'stop'){
                    if(com.length != 0){
                        currentCommand = com[0]
                        write(com.shift());
                    }else{
                        parser = null;
                        return 'stopped';
                    }   
                }else if(commands == 'post'){

                    if(currentCommand != 'AT+HTTPACTION=1' && currentCommand != 'AT+HTTPPARA="CONTENT","application/json"'){
                        
                        if(com.length == 1){
                            write(currentCommand);
                        }else{
                            if(errorCount == 0){
                                resolve(result);
                            }else{
                                reject(errordata);
                            }
                        }
                    }else if(currentCommand == 'AT+HTTPPARA="CONTENT","application/json"'){
                        write(bytes+',2000');
                    }else if(currentCommand.includes('AT+HTTPPARA="URL",')){
                        write(currentCommand,url);
                    }

                }
                break;
            case 'DOWNLOAD':
                write(pos,'send');
                break;    
            case '+HTTPACTION:':
                let param = data.split(',').pop();
                write(currentCommand, param);
                break;
            case 'ERROR':
                // if(commands == 'start'){
                //     write('AT+HTTPTERM');
                //     // write('AT+SAPBR=0,1');
                // }else{
                    write(currentCommand);
                // }
                
                // write('AT+SAPBR=0,1');
                // port.close();
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

post = (port, pos, url) => {
    
        pos = JSON.stringify(pos);
        bytes = pos.length;

        write();

        parser.on('data', data => evaluate(data, 'post'));
        parser.on('error', err => reject(err.data));
    
};

module.exports = {start, stop, post};