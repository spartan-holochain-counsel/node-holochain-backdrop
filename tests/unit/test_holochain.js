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

    it("should setup hApp using backdrop", async function () {
	this.timeout( 20_000 );

	const admin_port		= 29876;
	let holochain			= new Holochain({
	    "config": { admin_port },
	});

	try {
	    await holochain.start();
	    const clients		= await holochain.backdrop( "test", 44910, {
		"test": path.resolve( __dirname, "../test.dna" ),
	    });

	    expect( clients.alice.id	).to.equal("test-alice");
	    expect( clients.alice.actor	).to.equal("alice");
	    expect( clients.alice.agent	).to.be.an("AgentPubKey");

	    expect( clients.alice.cells.test.role_name	).to.equal("test");
	    expect( clients.alice.cells.test.id[0]	).to.be.a("DnaHash");
	    expect( clients.alice.cells.test.id[1]	).to.be.a("AgentPubKey");
	    expect( clients.alice.cells.test.source	).to.be.a("string");

	    expect( clients.alice.cells.test.dna		).to.be.a("DnaHash");
	    expect( clients.alice.cells.test.agent		).to.be.a("AgentPubKey");
	    expect( clients.alice.cells.test.granted_functions	).to.equal("*");
	} finally {
	    await holochain.destroy();
	}
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
