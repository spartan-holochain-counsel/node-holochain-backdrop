const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

// const why				= require('why-is-node-running');
const expect				= require('chai').expect;
const { AgentClient }			= require('@whi/holochain-client');
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

    it("should setup DNAs using backdrop", async function () {
	this.timeout( 20_000 );

	const admin_port		= 29876;
	let holochain			= new Holochain({
	    "config": { admin_port },
	});

	try {
	    const { alice }		= await holochain.backdrop({
		"happ1": path.resolve( __dirname, "../test.happ" ),
		"happ2": {
		    "test_dna": path.resolve( __dirname, "../test.dna" ),
		},
		"happ3": {
		    "manifest": {
			"manifest_version": "1",
			"name": "test",
			"roles": [{
			    "name": "test_dna",
			    "dna": {
				"path": path.resolve( __dirname, "../test.dna" ),
				"modifiers": {
				    "network_seed": "1",
				},
			    },
			}]
		    },
		    "resources": {},
		},
	    });

	    const { happ1, happ2, happ3 }	= alice;

	    expect( happ1.id			).to.equal("happ1-alice");
	    expect( happ1.actor			).to.equal("alice");
	    expect( happ1.agent			).to.be.an("AgentPubKey");
	    expect( happ1.status		).to.deep.equal({ running: null });
	    expect( happ1.client		).to.be.an("AgentClient");
	    expect( happ1.source		).to.be.a("string");

	    expect( happ1.cells.storage.name	).to.equal("storage");
	    expect( happ1.cells.storage.id[0]	).to.be.a("DnaHash");
	    expect( happ1.cells.storage.id[1]	).to.be.a("AgentPubKey");
	    expect( happ1.cells.storage.dna	).to.be.a("DnaHash");
	    expect( happ1.cells.storage.agent	).to.be.a("AgentPubKey");

	    expect( happ2.status		).to.deep.equal({ running: null });
	    expect( happ2.source		).to.be.a("object");
	    expect( happ2.cells.test_dna.name	).to.equal("test_dna");

	    expect( happ3.status		).to.deep.equal({ running: null });
	    expect( happ3.source		).to.be.a("object");
	    expect( happ3.cells.test_dna.name	).to.equal("test_dna");

	    expect( happ1.agent			).to.deep.equal( happ2.agent );
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
	} finally {
	    await holochain.destroy();
	}
	expect( failed			).to.be.true;
    });

    it("should fail to start because of timeout", async () => {
	let holochain			= new Holochain();

	let failed			= false;
	try {
	    await holochain.start( 1 );
	} catch (err) {
	    failed			= true;

	    expect( err.message		).to.have.string("Failed to start Holochain within");
	} finally {
	    await holochain.destroy();
	}
	expect( failed			).to.be.true;

	// setTimeout( () => why(), 1_000 );
    });
}

describe("Holochain", () => {

    describe("Basic", basic_tests );
    describe("Errors", errors_tests );

});
