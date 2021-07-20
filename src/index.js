const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const { Holochain }			= require('./holochain.js');
const Config				= require('./config.js');


module.exports = {
    Holochain,
    Config,
};
