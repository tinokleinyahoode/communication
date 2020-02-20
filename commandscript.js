const {start, stop, post} = require('./gsm.js');
const getPosition= require('./gps.js');

let count = 0;

    start().then(port => {
        
            getPosition(port).then(pos => {
                console.log("POS: ",pos);
                setTimeout(() => {
                    getPosition(port).then(pos => {
                        console.log(pos);
                    });
                }, 10000);
            }).catch(error => console.log(error));
       
    });


