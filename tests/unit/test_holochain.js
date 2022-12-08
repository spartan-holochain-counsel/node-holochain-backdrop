const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const expect				= require('chai').expect;
const { Holochain }			= require('../../src/index.js');


function basic_tests () {
    it("should start and stop holochain", async function () {
	this.timeout( 20_000 );

	let holochain			= new Holochain();
	try {
	    await holochain.start();

	    let statuses		= await holochain.stop();

	    expect( statuses[0].signal	).to.equal( "SIGTERM" );
	    expect( statuses[1].signal	).to.equal( "SIGTERM" );
	} finally {
	    await holochain.destroy();
	}
    });

    it("should run holochain with specified admin port", async function () {
	this.timeout( 20_000 );

	const admin_port		= 29876;
	let holochain			= new Holochain({
	    "config": { admin_port },
	});
	try {
	    await holochain.setup();

	    const port			= holochain.adminPorts()[0];

	    expect( port		).to.equal( admin_port );
	} finally {
	    await holochain.destroy();
	}
    });

    it("should try backdrop setup", async function () {
	this.timeout( 20_000 );

	const admin_port		= 29876;
	let holochain			= new Holochain({
	    "config": { admin_port },
	});

	let failed			= false;
	try {
	    await holochain.start();
	    await holochain.backdrop( "test", 44910, {
		"memory": __filename,
	    });
	} catch (err) {
	    failed			= true;

	    expect( err.type		).to.equal("error");
	    expect( err.data.data	).to.have.string("invalid gzip header");
	} finally {
	    await holochain.destroy();
	}

       expect( failed			).to.be.true;
    });
}

function errors_tests () {
    it("should fail to start because of invalid config option", async () => {
	let holochain			= new Holochain({
	    "config": {
		"construct": () => null,
	    },
	});

	let failed			= false;
	try {
	    await holochain.setup();
	} catch (err) {
	    failed			= true;

	    expect( err.message		).to.have.string("must specify the config path");
	}
	expect( failed			).to.be.true;

	await holochain.destroy();
    });
}

describe("Holochain", () => {

    describe("Basic", basic_tests );
    describe("Errors", errors_tests );

});
