const { start, stop, post } = require('./gsm.js');
const getPosition = require('./gps.js');

let intCount = 0;

(init = () => {
    start().then(({port, parser}) => {
		heardbeat(port, parser);
    }).catch(error => console.log('start: ',error));
})();


const heardbeat = (port, parser) => {
	getPosition(port, parser).then((pos) => {
		post(pos).then(response => {
			console.log("RES: ", response);
			setInterval(() => {
				getPosition(port, parser).then((pos) => {
					post(pos).then(response => {
						console.log("RES: ", response);
					}).catch(error => console.log('post: ',error));
				}).catch(error => console.log('Position: ',error));
			}, 5000);	
		})
	});
}
