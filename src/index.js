const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal',
});

const { Holochain,
	TimeoutError }			= require('./holochain.js');
const Config				= require('./config.js');


module.exports = {
    Holochain,
    Config,
    TimeoutError,
};
