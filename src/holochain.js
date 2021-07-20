const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const fs				= require('fs');
const YAML				= require('yaml');
const { spawn }				= require('child_process');
const { SubProcess }			= require('@whi/subprocess');

const { normalize_conductor_stderr,
	mktmpdir }			= require('./utils.js');
const { generate }			= require('./config.js');


const DEFAULT_RUST_LOG			= "debug";
const HOLOCHAIN_DEFAULTS		= {
    "cleanup": true,
};


class Holochain {
    constructor ( options = {} ) {
	process.once("exit", this._handle_exit.bind(this) );
	process.once('SIGINT', this._handle_exit.bind(this) );

	this.options			= Object.assign({}, HOLOCHAIN_DEFAULTS, options );
	this._cleanup_config		= false;
	this._cleanup_basedir		= false;
	this._destroyed			= false;

	this.configured			= new Promise( (f,r) => {
	    this._prep_fulfill		= f;
	    this._prep_reject		= r;
	});

	this._setup()
	    .then( this._prep_fulfill, this._prep_reject )
	    .catch( this._prep_reject );
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
	    this._cleanup_basedir	= basedir;

	    log.normal("Using tmp folder as base dir: %s", basedir );

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

	return basedir;
    }

    setup () {
	return this.configured;
    }

    start () {
	if ( this._conductor_process )
	    throw new Error(`Tried to start Conductor when is was already started`);

	let self			= this;
	return new Promise( async (f,r) => {
	    try {
		await this.setup();


		log.info("Starting lair-keystore subprocess with debug level: %s", process.env.RUST_LOG || DEFAULT_RUST_LOG );
		this._lair_process			= new SubProcess({
		    "name": "lair-keystore",
		    "command": [ "lair-keystore", "-d", this.config.keystore_path ],
		    "x_env": {
			"RUST_LOG": DEFAULT_RUST_LOG,
		    },
		});
		log.debug("Started subprocess with PID: %s", this._lair_process.pid );

		this._lair_process.stdout.on("line", line => {
		    log.debug("\x1b[2;37m     Lair STDOUT\x1b[0;2m: %s\x1b[0m", line );
		});

		this._lair_process.stderr.on("line", line => {
		    log.silly("\x1b[2;31m     Lair STDERR\x1b[0;2m: %s\x1b[0m", line );
		});

		await this._lair_process.output( line => {
		    return line.includes("lair-keystore-ready");
		});
		log.normal("Lair is ready...");


		log.info("Starting conductor subprocess with debug level: %s", process.env.RUST_LOG || DEFAULT_RUST_LOG );
		this._conductor_process			= new SubProcess({
		    "name": "conductor",
		    "command": [ "holochain", "-c", this.config_file ],
		    "x_env": {
			"RUST_LOG": DEFAULT_RUST_LOG,
		    },
		});
		log.debug("Started subprocess with PID: %s", this._conductor_process.pid );

		this._conductor_process.stdout.on("line", line => {
		    log.debug("\x1b[2;37mConductor STDOUT\x1b[0;2m: %s\x1b[0m", line );
		});

		this._conductor_process.stderr.on("line", line => {
		    log.silly("\x1b[2;31mConductor STDERR\x1b[0;2m: %s\x1b[0m", normalize_conductor_stderr( line ) );
		});

		await this._conductor_process.output( line => {
		    return line.includes("Conductor ready");
		});
		log.normal("Conductor is ready...");

		f();
	    } catch ( err ) {
		r( err );
	    }
	});
    }

    async stop () {
	return await Promise.all([
	    this._lair_process
		? this._lair_process.stop()
		: Promise.resolve(),
	    this._conductor_process
		? this._conductor_process.stop()
		: Promise.resolve(),
	]);
    }

    adminPorts () {
	this._assert_ready();

	return this.config.admin_interfaces.map( iface => iface.driver.port );
    }

    async destroy ( exit_code ) {
	log.debug("Destroying Holochain because of %s", exit_code );

	if ( this._destroyed === true )
	    return;

	await this.stop();

	if ( this.options.cleanup !== false ) {

	    log.normal("Cleaning up automatically generated content");
	    if ( this._cleanup_config === true )
		fs.unlinkSync( this.config_file );

	    if ( this._cleanup_basedir !== false ) {
		log.warn("Removing temporary directory created by this process: %s", this._cleanup_basedir );
		fs.rmSync( this._cleanup_basedir, {
		    "recursive": true,
		    "force": true,
		});
	    }
	}

	this._destroyed			= true;
    }

    async _handle_exit ( code ) {
	await this.destroy( code );

	log.info("Exiting with code: %s", code );
	process.exit( code );
    }

    _assert_ready () {
	if ( this.config === undefined )
	    throw new Error(`Not ready`);
    }
}


module.exports = {
    Holochain,
};
