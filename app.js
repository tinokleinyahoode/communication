const { start, stop, post, reset } = require('./gsm');
const getPosition = require('./gps');

const NAVIGATION_RATE = 1000;
const HEARTBEAT_RATE = 5000 ;
const WAIT_FOR_GPS_ACCURACY = 5000;
const MAXIMUM_SERVER_RESPONSE_TIME = 20000;

let port = null;
let parser = null;
let heartbeatTimeout = null;

let intervals = {
    navigation: null,
    heartbeat: null
};

let status = {
    coordinates: [],
    startPoint: null,
    wayPoints: [],
    // control: BoatControl,
    trash: [],
    command: "STOP",
    position: [],
    speed: 0,
    heading: 0
};

/**
 * @desc    Sets parameter to the status object after validating them.
 */
let setParams = ({ coordinates, wayPoints, command, position, speed, heading }) => {

    if (valid(coordinates)) status.coordinates = coordinates;

    if (valid(wayPoints)) status.wayPoints = wayPoints;

    if (valid(position)) status.position = position;

    if (valid(position)) {
        if (status.startPoint === null) status.startPoint = position
    }

    if (typeof speed === "number") status.speed = speed;

    if (typeof heading === "number") status.heading = heading;

    if (typeof command === "string") status.command = command;
};


/**
 *
 * @param validKeys
 * @param object
 * @returns {{}}
 */
let only = (validKeys, object) => {
    let newObject = {};

    Object.keys(object).forEach(key => {
        if (validKeys.includes(key)) newObject[key] = object[key]
    });

    return newObject;
};

/**
 * @desc    Gets the Waste Detection Object and calls the navigationHandler
 *          if status has a valid position and coordinates.
 */
let navigation = () => {
    console.log('NAVIGATING');
};

/**
 * @desc    Resets all intervals and restarts the heartbeat if server exceeded
 *          maximum response time.
 */
let restartHeartbeat = () => {
    console.log('[ RESTARTING MODULE ]');
    resetTimeout = setTimeout(restartHeartbeat, MAXIMUM_SERVER_RESPONSE_TIME);

    // clearTimeout(heartbeatTimeout);
    clearInterval(intervals.navigation);
    clearInterval(intervals.heartbeat);
    intervals.navigation = null;

    // stop()
    //     .then(res => {
    //         if (res) start().then(res => {
    //             console.log('[ RESTARTING HEARTBEAT ]');
    //             clearTimeout(resetTimeout);
    //             heartbeat();
    //         })
    //     })
    getPosition(port, parser)
        .then(res => {
            clearInterval(resetTimeout);
            intervals.heartbeat = setInterval(heartbeat, HEARTBEAT_RATE);
            post(JSON.stringify({ clear: true, ...getKeys(["position", "heading", "speed"], status) }))
            .then(res => setParams(JSON.parse(res)))
                .then(res => {
                    clearTimeout(resetTimeout);
                    intervals.heartbeat = setInterval(heartbeat, HEARTBEAT_RATE);
                });
            });
        
};

/**
 *  @desc   Gets Drone position via gps and sends the data to our server, which
 *          returns an available command, wayPoints and the coordinates.
 */
let heartbeat = () => {
    clearInterval(intervals.heartbeat);

    getPosition(port, parser)
        .then(res => {
            setParams(JSON.parse(res));
            heartbeatTimeout = setTimeout(restartHeartbeat, MAXIMUM_SERVER_RESPONSE_TIME);

            post(JSON.stringify({ clear: true, ...getKeys(["position", "heading", "speed"], status) }))
                .then(res => setParams(JSON.parse(res)))
                .then(res => {

                    // waiting for first position before starting the navigation
                    if (intervals.navigation === null) {
                        console.log('[ STARTING NAVIGATION ]');
                        intervals.navigation = setInterval(navigation, NAVIGATION_RATE);
                    }

                    clearTimeout(heartbeatTimeout);
                    intervals.heartbeat = setInterval(heartbeat, HEARTBEAT_RATE);
                    console.log(status);
                })
                .catch(err => console.log('POST ERROR: ', err));
        })
        .catch(err => console.log('GPS ERROR: ', err));
};

/**
 * @desc    Removes all keys in the given object that are not listed in the given array.
 * @param   validKeys: array
 * @param   object: object
 * @returns Object
 */
let getKeys = (validKeys, object) => {
    let newObject = {};

    Object.keys(object).forEach(key => {
        if (validKeys.includes(key)) newObject[key] = object[key]
    });

    return newObject;
};

/**
 * @desc    Checks if the given parameter is an array with a length greater than one.
 * @param   arr: array
 * @returns boolean
 */
let valid = (arr) => Array.isArray(arr) && arr.length > 0;

/**
 * @desc    Updating the console log.
 * @param   time: number
 */
let wait = (time) => {
    let seconds = time / 1000;
    let icon = '࡫';

    setInterval(() => {
        process.stdout.write('[]');
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write("\n"); // end the line
    }, seconds);
};

/**
 * @desc    Init-function which starts the gsm module and sets off the heartbeat
 *          and navigation interval.
 */
(function () {
    start().then(({ port: _port, parser: _parser }) => {
        port = _port;
        parser = _parser;
        console.log('[ GSM MODULE STARTED ]');
        console.log('[ WAITING ' + WAIT_FOR_GPS_ACCURACY / 1000 + 's FOR BETTER GPS ACCURACY ]');

        getPosition(port, parser)
            .then(res => {
               setTimeout(() => {
                   console.log('[ STARTING HEARTBEAT ]');

                   intervals.heartbeat = setInterval(heartbeat, HEARTBEAT_RATE);
               }, WAIT_FOR_GPS_ACCURACY);
            });
    });
})();