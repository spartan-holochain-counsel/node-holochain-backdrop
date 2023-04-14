const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const expect				= require('chai').expect;
const { Holochain, Config }		= require('../../src/index.js');


function basic_tests () {
    it("should start and stop holochain", async function () {
	this.timeout( 5_000 );

	let holochain			= new Holochain({
	    "default_loggers": true,
	});
	try {
	    let base_dir		= await holochain.setup();

	    expect( base_dir		).to.be.a("string");

	    await holochain.start();

	    expect( holochain.adminPorts() ).to.deep.equal([ holochain.config.admin_interfaces[0].driver.port ]);

	    let statuses		= await holochain.stop();

	    expect( statuses[0].signal	).to.equal( "SIGTERM" );
	    expect( statuses[1].signal	).to.equal( "SIGTERM" );
	} finally {
	    await holochain.destroy();
	}
    });
}

function customizing_tests () {
    it("should start and stop holochain with custom config", async function () {
	const config_file		= path.resolve( process.cwd(), "tests/config.yaml" );
	const config			= {
	    "environment_path": "./databases",
	    "keystore": {
		"keystore_path": "./lair",
	    },
	    "admin_interfaces": [{
		"driver": {
		    "type": "websocket",
		    "port": 30_512,
		},
	    }],
	    "network": Config.DEFAULT_NETWORK_CONFIG,
	};

	let holochain			= new Holochain({
	    "config": {
		"path": config_file,
		"construct": () => config,
	    },
	});

	let base_dir			= await holochain.setup();

	expect( base_dir		).to.equal( path.dirname( config_file ) );
	expect( holochain.config_file	).to.equal( config_file );
	expect( holochain.config	).to.deep.equal( config );

	await holochain.destroy();

	expect( fs.existsSync( base_dir)	).to.be.true;
	expect( fs.existsSync( config_file )	).to.be.false;
    });
}



describe("Backdrop", () => {

    describe("Basic", basic_tests );
    describe("Customizing", customizing_tests );

});
