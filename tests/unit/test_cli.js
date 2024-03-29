import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-cli", process.env.LOG_LEVEL );

import { expect }			from 'chai';

import { main }				from '../../bin/hc-backdrop-cli.js';


const default_args			= [ "node", "test_cli.js" ];

if ( log.level_rank < 3 )
    default_args.push( "--quiet" );

function cmd_args ( ...args ) {
    return default_args.concat([ ...args ]);
}


function basic_tests () {
    it("should start and stop holochain", async function () {
	this.timeout( 10_000 );

	await main( cmd_args() , async ( holochain ) => {
	    await holochain.destroy();
	});
    });

    it("should specify admin port", async function () {
	this.timeout( 10_000 );

	await main( cmd_args( "-p", "48756" ), async ( holochain ) => {
	    try {
		expect( holochain.adminPorts()[0] ).to.equal( 48756 );
	    } finally {
		await holochain.destroy();
	    }
	});
    });

    it("should specify admin port and config location", async function () {
	this.timeout( 10_000 );

	await main( cmd_args( "-p", "48756", "-c", "tests/tmp/config.yaml" ), async ( holochain ) => {
	    try {
		expect( holochain.adminPorts()[0] ).to.equal( 48756 );
	    } finally {
		await holochain.destroy();
	    }
	});

	// Ensure idempotency
	await main( cmd_args( "-p", "48756", "-c", "tests/tmp/config.yaml" ), async ( holochain ) => {
	    await holochain.destroy();
	});
    });
}

function errors_tests () {
    it("should fail because specified admin port and config don't match", async function () {
	this.timeout( 10_000 );

	let failed			= false;
	try {
	    await main( cmd_args( "-p", "48756", "-c", "tests/tmp/config.yaml" ), async ( holochain ) => {
		try {
		    expect( holochain.adminPorts()[0] ).to.equal( 48756 );
		} finally {
		    await holochain.destroy();
		}
	    });

	    await main( cmd_args( "-p", "4875", "-c", "tests/tmp/config.yaml" ), async ( holochain ) => {
		try {
		    expect( holochain.adminPorts()[0] ).to.equal( 48756 );
		} finally {
		    await holochain.destroy();
		}
	    });
	} catch (err) {
	    failed			= true;

	    expect( err.message		).to.have.string("does not match any from the config file");
	}
	expect( failed			).to.be.true;
    });

    it("should fail because start-up timeout", async function () {
	let failed			= false;
	try {
	    await main( cmd_args( "-t", "1" ), async ( holochain ) => {
		await holochain.destroy();
	    });
	} catch (err) {
	    failed			= true;

	    expect( err.message		).to.have.string("Failed to start Holochain within");
	}
	expect( failed			).to.be.true;
    });
}

describe("CLI", () => {

    describe("Basic", basic_tests );
    describe("Errors", errors_tests );
});
