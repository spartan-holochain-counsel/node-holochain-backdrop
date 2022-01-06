const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const expect				= require('chai').expect;
const { main }				= require('../../bin/hc-backdrop-cli.js');


const default_args			= [ "node", "test_cli.js" ];

if ( !process.env.LOG_LEVEL )
    default_args.push( "--quiet" );

function cmd_args ( ...args ) {
    return default_args.concat([ ...args ]);
}


function basic_tests () {
    it("should start and stop holochain", async function () {
	await main( cmd_args() , async ( holochain ) => {
	    await holochain.destroy();
	});
    });

    it("should specify admin port", async function () {
	await main( cmd_args( "-p", "48756" ), async ( holochain ) => {
	    try {
		expect( holochain.adminPorts()[0] ).to.equal( 48756 );
	    } finally {
		await holochain.destroy();
	    }
	});
    });

    it("should specify admin port and config location", async function () {
	this.timeout( 5_000 );

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
}

describe("CLI", () => {

    describe("Basic", basic_tests );
    describe("Errors", errors_tests );

});
