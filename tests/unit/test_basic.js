const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const expect				= require('chai').expect;
const { Conductor, Config }		= require('../../src/index.js');


function basic_tests () {
    it("should start and stop conductor", async () => {
	let conductor			= new Conductor();

	let base_dir			= await conductor.setup();

	expect( base_dir		).to.be.a("string");

	await conductor.start();

	expect( conductor.adminPorts()	).to.deep.equal([ conductor.config.admin_interfaces[0].driver.port ]);

	let status			= await conductor.stop();

	expect( status.code		).to.equal( null );
	expect( status.signal		).to.equal( "SIGTERM" );
    });

    it("should start and stop conductor with custom config", async () => {
	const config_file		= path.resolve( process.cwd(), "tests/config.yaml" );
	const config			= {
	    "environment_path": "./databases",
	    "keystore_path": "./lair",
	    "admin_interfaces": [{
		"driver": {
		    "type": "websocket",
		    "port": 30512,
		},
	    }],
	    "network": Config.DEFAULT_NETWORK_CONFIG,
	};

	let conductor			= new Conductor({
	    "config": {
		"path": config_file,
		"constructor": () => config,
	    },
	});

	let base_dir			= await conductor.setup();

	expect( base_dir		).to.equal( undefined );
	expect( conductor.config_file	).to.equal( config_file );
	expect( conductor.config	).to.deep.equal( config );

	await conductor.destroy();

	expect( fs.existsSync( config_file ) ).to.be.false;
    });
}



describe("Backdrop", () => {

    describe("Basic", basic_tests );

});
