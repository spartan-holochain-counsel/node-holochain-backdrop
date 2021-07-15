const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const { Conductor }			= require('./conductor.js');
const Config				= require('./config.js');


module.exports = {
    Conductor,
    Config,
};
