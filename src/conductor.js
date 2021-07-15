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
const CONDUCTOR_DEFAULTS		= {
    "cleanup": true,
};

class Conductor {
    constructor ( options = {} ) {
	process.once("exit", async () => {
	    log.debug("Destroying Conductor object because of 'exit' event");
	    await this.destroy();
	});

	this.options			= Object.assign({}, CONDUCTOR_DEFAULTS, options );
	this._cleanup_config		= false;
	this._destroyed			= false;

	this.configured			= new Promise( (f,r) => {
	    this._prep_fulfill		= f;
	    this._prep_reject		= r;
	});
	this.spawned			= new Promise( (f,r) => {
	    this._spawn_fulfill		= f;
	    this._spawn_reject		= r;
	});

	this._setup()
	    .catch( (err) => {
		console.error("Failed during setup", err );
	    });
    }

    async _setup () {
	if ( this.config_file )
	    throw new Error(`Already setup @ ${this.config_file}`);

	if ( this.options.config ) {
	    if ( this.options.config.constructor ) {
		if ( !this.options.config.path )
		    throw new Error(`You must specify the config path if you use a config constructor`);

		this.config		= this.options.config.constructor();
		this._cleanup_config	= true;
	    }
	    else if ( this.options.config.path ) {
		let config_file		= this.options.config.path;

		if ( fs.existsSync( config_file ) ) {
		    let config_yaml	= fs.readFileSync( config_file );
		    this.config		= YAML.parse( config_yaml );
		}
	    }

	    if ( this.options.config.path )
		this.config_file	= this.options.config.path;
	}

	let basedir;
	if ( this.config === undefined ) {
	    basedir			= await mktmpdir();
	    this.config			= await generate( basedir );

	    if ( this.config_file === undefined ) {
		this._cleanup_config	= true;
		this.config_file	= path.resolve( basedir, "config.yaml" );
	    }
	}

	log.info("Writing config file to: %s", this.config_file );
	fs.writeFileSync(
	    this.config_file,
	    YAML.stringify(this.config),
	    "utf8"
	);

	this._prep_fulfill( basedir );
    }

    setup () {
	return this.configured;
    }

    async start () {
	await this.setup();

	log.info("Starting holochain subprocess with debug level: %s", process.env.RUST_LOG || DEFAULT_RUST_LOG );
	this.subprocess			= spawn( "holochain", [ "-c", this.config_file ], {
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
		    self._spawn_fulfill( self.subprocess );
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

	await this.ready();
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

    ready () {
	return this.spawned;
    }

    adminPorts () {
	this._assert_ready();

	return this.config.admin_interfaces.map( iface => iface.driver.port );
    }

    async destroy () {
	if ( this._destroyed === true )
	    return;

	log.normal("Cleaning up automatically generated content");
	if ( this.options.cleanup !== false ) {
	    if ( this._cleanup_config === true )
		fs.unlinkSync( this.config_file );
	}

	this._destroyed			= true;
    }

    _assert_ready () {
	if ( this.config === undefined )
	    throw new Error(`Not ready`);
    }
}


module.exports = {
    Conductor,
};
