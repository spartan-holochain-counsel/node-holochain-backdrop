const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const expect				= require('chai').expect;
const { Conductor }			= require('../../src/index.js');


function basic_tests () {
    it("should start and stop conductor", async () => {
	let conductor			= new Conductor();

	await conductor.ready();

	let status			= await conductor.stop();

	expect( status.code		).to.equal( null );
	expect( status.signal		).to.equal( "SIGTERM" );
    });
}

describe("Conductor", () => {

    describe("Basic", basic_tests );

});
