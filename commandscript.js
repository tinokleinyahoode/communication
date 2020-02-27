const { start, stop, post } = require('./gsm.js');
const getPosition = require('./gps.js');

let intCount = 0;

(init = () => {
    start().then((portparser) => {
		const {port, parser} = portparser;
        heardbeat(port, parser);
    }).catch(error => console.log('start: ',error));
})();


const heardbeat = (port, parser) => {
    setInterval(() => {
        getPosition(port, parser).then((pos) => {
            post(pos).then(response => {
                console.log("RES: OK");
            }).catch(error => console.log('post: ',error));
        }).catch(error => console.log('Position: ',error));
    }, 10000);
}
