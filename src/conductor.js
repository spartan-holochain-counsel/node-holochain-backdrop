const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const YAML				= require('yaml');
const { spawn }				= require('child_process');
const { normalize_conductor_stderr,
	log_stream,
	LineParser,
	mktmpdir }			= require('./utils.js');
const { generate }			= require('./config.js');

const DEFAULT_RUST_LOG			= "debug";


class Conductor {
    constructor () {
	this.spawned			= new Promise( (f,r) => {
	    this._spawn_fulfill		= f;
	    this._spawn_reject		= r;
	});

	this.setup()
	    .catch( (err) => {
		console.error("Failed during setup", err );
	    });
    }

    async setup () {
	let tmpdir			= await mktmpdir();
	let config			= await generate( tmpdir );
	let config_file			= path.resolve( tmpdir, "config.yaml" );

	log.info("Writing config file to: %s", config_file );
	fs.writeFileSync( config_file, YAML.stringify(config), "utf8" );

	log.info("Starting holochain subprocess with debug level: %s", process.env.RUST_LOG || DEFAULT_RUST_LOG );
	this.subprocess			= spawn( "holochain", [ "-c", config_file ], {
	    "env": Object.assign({}, {
		"RUST_LOG": DEFAULT_RUST_LOG,
	    }, process.env),
	});


	let lines			= new LineParser();
	let self			= this;
	function check_for_ready ( chunk ) {
	    lines.write( chunk );

	    for ( let line of lines.drain() ) {
		if ( line.includes("Conductor ready") ) {
		    self._spawn_fulfill();
		    self.subprocess.stdout.off("data", check_for_ready );
		    self.subprocess.off("close", failed_to_start );
		}
	    }
	}
	this.subprocess.stdout.on("data", check_for_ready );

	function failed_to_start (code, signal) {
	    log.fatal("Conductor closed with: code %s (signal: %s)", code, signal );
	    self._spawn_reject({
		code,
		signal,
	    });
	    self.subprocess.stdout.off("data", check_for_ready );
	}
	this.subprocess.on("close", failed_to_start );


	log_stream( this.subprocess.stdout, ( line ) => {
	    log.debug("\x1b[2;37mConductor STDOUT\x1b[0;2m: %s\x1b[0m", line );
	});

	log_stream( this.subprocess.stderr, ( line ) => {
	    log.silly("\x1b[2;31mConductor STDERR\x1b[0;2m: %s\x1b[0m", normalize_conductor_stderr( line ) );
	});

	this.subprocess.on("spawn", () => {
	    log.normal("Conductor subprocess has been spawned");
	});

	this.subprocess.on("message", (msg, handle) => {
	    log.info("Conductor subprocess message event: %s", msg );
	});

	this.subprocess.on("disconnect", () => {
	    log.warn("Conductor subprocess disconnect");
	});

	this.subprocess.on("error", (err) => {
	    console.error("Conductor subprocess error:", err );
	});

	this.subprocess.on("exit", (code, signal) => {
	    log.warn("Conductor exited with: code %s (signal: %s)", code, signal );
	});
    }

    ready () {
	return this.spawned;
    }

    stop () {
	if ( this.subprocess.killed === true ) {
	    log.warn("Tried to stop Conductor when it wasn't running");
	    return Promise.resolve( this.subprocess.exitCode );
	}

	return new Promise( (f,r) => {
	    this.subprocess.on("exit", (code, signal) => {
		f({
		    code,
		    signal,
		});
	    });
	    this.subprocess.kill();
	});
    }
}


module.exports = {
    Conductor,
};
