import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-config", process.env.LOG_LEVEL );

import path				from 'path';
import { expect }			from 'chai';

import { generate }			from '../../src/config.js';


const __dirname				= path.dirname( new URL(import.meta.url).pathname );

function basic_tests () {
    it("should start and stop conductor", async () => {
	let config			= await generate( __dirname );

	expect( config.data_root_path		).to.have.string( __dirname );
	expect( config.keystore.keystore_path	).to.have.string( __dirname );

	expect( config.admin_interfaces[0].driver.port	).to.be.a("number");
    });
}

describe("Config", () => {

    describe("Basic", basic_tests );

});
