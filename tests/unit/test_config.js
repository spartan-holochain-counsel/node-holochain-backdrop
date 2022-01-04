const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const expect				= require('chai').expect;
const { generate }			= require('../../src/config.js');


function basic_tests () {
    it("should start and stop conductor", async () => {
	let config			= await generate( __dirname );

	expect( config.environment_path		).to.have.string( __dirname );
	expect( config.keystore.keystore_path	).to.have.string( __dirname );

	expect( config.admin_interfaces[0].driver.port	).to.be.a("number");
    });
}

describe("Config", () => {

    describe("Basic", basic_tests );

});
