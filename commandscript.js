const { start, stop, post } = require('./gsm.js');
const getPosition = require('./gps.js');

let intCount = 0;

(init = () => {
    start().then(port => {
        heardbeat(port);
    }).catch(error => console.log('start: ',error));
})();


const heardbeat = (port) => {
    if(intCount < 5){
        setInterval(() => {
            intCount++;
            getPosition(port).then((pos) => {
                post(pos).then(response => {
                    console.log(JSON.parse(response));
                }).catch(error => console.log('post: ',error));
            }).catch(error => console.log('Position: ',error));
        }, 10000);
    }else{
        stop().then(data => {
            console.log(data);
            port.close();
        })
    }
}
