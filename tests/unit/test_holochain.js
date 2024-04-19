import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-holochain", process.env.LOG_LEVEL );

import why				from 'why-is-node-running';

import path				from 'path';
import { expect }			from 'chai';
import json				from '@whi/json';

import { Holochain }			from '../../lib/index.js';


const __dirname				= path.dirname( new URL(import.meta.url).pathname );

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

    it("should create actor profile", async function () {
	this.timeout( 20_000 );

	const holochain			= new Holochain();

	try {
	    await holochain.start();

	    const pubkey		= await holochain.profile("alice");

	    expect( pubkey		).to.deep.equal( await holochain.profile("alice") );

	    const pubkeys		= await holochain.profiles( "alice", "bobby", "carol", "david" );

	    expect( pubkey		).to.deep.equal( pubkeys[0] );
	    expect( pubkeys[3]		).to.be.a("AgentPubKey");
	} finally {
	    await holochain.destroy();
	}
    });

    it("should install app 2x with different network seeds", async function () {
	this.timeout( 60_000 );

	const holochain			= new Holochain();
	try {
	    await holochain.start();

	    const { alice }			= await holochain.install(
		"alice",
		[
		    {
			"bundle": path.resolve( __dirname, "../test.happ" ),
			"network_seed": "*",
		    },
		    {
			"bundle": path.resolve( __dirname, "../test.happ" ),
			"network_seed": "*",
		    },
		]
	    );
	} finally {
	    await holochain.destroy();
	}
    });

    it("should install apps using every source configuration", async function () {
	this.timeout( 60_000 );

	const holochain			= new Holochain();

	try {
	    await holochain.start();

	    const { alice }			= await holochain.install(
		"alice",
		[
		    path.resolve( __dirname, "../test.happ" ),
		    {
			"app_name": "happ1",
			"bundle": path.resolve( __dirname, "../test.happ" ),
			"network_seed": "*",
		    },
		    {
			"app_name": "happ2",
			"bundle": {
			    "dna1": path.resolve( __dirname, "../test.dna" ),
			},
			"network_seed": "*",
		    },
		    {
			"app_name": "happ3",
			"bundle": {
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
			"network_seed": null, // must override collective network seed so that the
					      // manifest seed is used
		    },
		]
	    );

	    const alice_app_ids			= Object.keys( alice );

	    expect( alice_app_ids		).to.have.length( 4 );

	    const happ0				= alice[ 0 ];

	    // log.normal("Alice 'happ0': %s", json.debug(happ0) );

	    expect( happ0.installed_app_id	).to.have.string("alice");
	    expect( happ0.agent_pub_key		).to.be.a("AgentPubKey");
	    expect( happ0.status		).to.deep.equal({ running: null });
	    expect( happ0.source		).to.be.a("string");

	    const { happ1, happ2, happ3 }	= alice;

	    // log.normal("Alice 'happ1': %s", json.debug(happ1) );

	    expect( happ1.app_id		).to.equal("happ1-alice");
	    expect( happ1.installed_app_id	).to.equal("happ1-alice");
	    expect( happ1.agent_pub_key		).to.be.a("AgentPubKey");
	    expect( happ1.status		).to.deep.equal({ running: null });

	    // log.normal("Alice 'happ2': %s", json.debug(happ2) );

	    expect( happ2.app_id		).to.equal("happ2-alice");
	    expect( happ2.agent_pub_key		).to.be.a("AgentPubKey");
	    expect( happ2.status		).to.deep.equal({ running: null });

	    // log.normal("Alice 'happ3': %s", json.debug(happ3) );

	    expect( happ3.app_id		).to.equal("happ3-alice");
	    expect( happ3.agent_pub_key		).to.be.a("AgentPubKey");
	    expect( happ3.status		).to.deep.equal({ running: null });

	    expect( happ1.agent_pub_key		).to.deep.equal( happ2.agent_pub_key );
	    expect( happ1.agent_pub_key		).to.deep.equal( happ3.agent_pub_key );
	} finally {
	    await holochain.destroy();
	}
    });

    it("should install complex arrangement", async function () {
	this.timeout( 60_000 );

	const holochain			= new Holochain();

	try {
	    await holochain.start();

	    const network_seed			= holochain.randomNetworkSeed();

	    const { alice, bobby }		= await holochain.install(
		[ "alice", "bobby" ],
		[
		    {
			"app_name": "happ1",
			"bundle": path.resolve( __dirname, "../test.happ" ),
			"network_seed": "*",
		    },
		    {
			"app_name": "happ2",
			"bundle": {
			    "dna1": path.resolve( __dirname, "../test.dna" ),
			},
		    },
		],
		{
		    network_seed,
		}
	    );

	    // console.log( json.debug( alice ) );
	    // console.log( json.debug( bobby ) );

	    expect(
		alice.happ1.roles.storage.dna_modifiers.network_seed
	    ).to.not.equal( network_seed );
	    expect(
		bobby.happ1.roles.storage.dna_modifiers.network_seed
	    ).to.not.equal( network_seed );

	    expect(
		alice.happ2.roles.dna1.dna_modifiers.network_seed
	    ).to.equal( network_seed );
	    expect(
		bobby.happ2.roles.dna1.dna_modifiers.network_seed
	    ).to.equal( network_seed );

	    const { carol, david }		= await holochain.install(
		[ "carol", "david" ],
		{
		    "app_name": "happ2",
		    "bundle": {
			"dna1": path.resolve( __dirname, "../test.dna" ),
		    },
		},
		{
		    network_seed,
		}
	    );

	    // console.log( json.debug( carol ) );
	    // console.log( json.debug( david ) );

	    expect(
		carol.happ2.roles.dna1.dna_modifiers.network_seed
	    ).to.equal( network_seed );
	    expect(
		david.happ2.roles.dna1.dna_modifiers.network_seed
	    ).to.equal( network_seed );
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
