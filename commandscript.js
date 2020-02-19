const {start, stop, post} = require('./gsm.js');
const getPosition= require('./gps.js');

let count = 0;
let Port;


    start().then(startPort => {
        Port = startPort;
        
            getPosition(Port).then(pos => {
                console.log("POS: ",pos);
                setInterval(() => {
                    getPosition(Port).then(pos => {
                        console.log("POS: ",pos);
                    });
                },10000);
            }).catch(error => console.log(error));
       
    });


