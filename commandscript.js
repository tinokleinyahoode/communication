const { start, stop, post } = require('./gsm.js');
const getPosition = require('./gps.js');

let count = 0;

start().then(port => {
	getPosition(port)
		.then(pos => {
            post(port, pos).then(data => {
                console.log("send: ",data);
            })
			
		})
		.catch(error => console.log(error));
});
