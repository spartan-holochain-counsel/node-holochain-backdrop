const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal',
});

const fs				= require('fs');
const YAML				= require('yaml');
const EventEmitter			= require('events');
const { spawn }				= require('child_process');
const { SubProcess }			= require('@whi/subprocess');

const { dissect_rust_log,
	mktmpdir }			= require('./utils.js');
const { generate }			= require('./config.js');


const DEFAULT_LAIR_LOG			= process.env.RUST_LOG || "debug";
const DEFAULT_COND_LOG			= process.env.RUST_LOG || "debug";

const HOLOCHAIN_DEFAULTS		= {
    "lair_log": process.env.LAIR_LOG || DEFAULT_LAIR_LOG,
    "conductor_log": process.env.CONDUCTOR_LOG || DEFAULT_COND_LOG,
};


class Holochain extends EventEmitter {
    constructor ( options = {} ) {
	super();

	process.once("exit", this._handle_exit.bind(this) );

	this.options			= Object.assign({}, HOLOCHAIN_DEFAULTS, options );
	this.basedir			= null;

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


	log.silly("Setup using options: %s", this.options );
	if ( this.options.config ) {
	    if ( this.options.config.construct ) {
		log.info("Using constructor to build config content");

		if ( !this.options.config.path )
		    throw new Error(`You must specify the config path if you use a config constructor`);

		this.config		= this.options.config.construct();

		log.warn("Flag for config cleanup");
		this._cleanup_config	= true;
	    }
	    else if ( this.options.config.path ) {
		let config_file		= this.options.config.path;

		if ( fs.existsSync( config_file ) ) {
		    let config_yaml	= fs.readFileSync( config_file, "utf8" );
		    this.config		= YAML.parse( config_yaml );
		}
	    }

	    if ( this.options.config.path ) {
		this.config_file	= this.options.config.path;
		this.basedir		= path.dirname( this.options.config.path );
		log.debug("Set config file location to: %s", this.config_file );
	    }
	}

	if ( this.config === undefined ) {
	    if ( this.basedir === null ) {
		this.basedir		= await mktmpdir();
		this._cleanup_basedir	= this.basedir;
		log.normal("Using tmp folder as base dir: %s", this.basedir );
	    }

	    this.config			= await generate( this.basedir, this.options.admin_port );

	    if ( this.config_file === undefined ) {
		log.warn("No config file path was specificed; using tmp dir: %s", this.basedir );

		this._cleanup_config	= true;
		this.config_file	= path.resolve( this.basedir, "config.yaml" );
		log.debug("Set config file location to: %s", this.config_file );
	    }
	}

	log.info("Writing config file to: %s", this.config_file );
	fs.writeFileSync(
	    this.config_file,
	    YAML.stringify(this.config),
	    "utf8"
	);

	return this.basedir;
    }

    setup () {
	return this.configured;
    }

    async start () {
	if ( this.conductor )
	    throw new Error(`Tried to start Conductor when is was already started`);

	await this.setup();


	log.info("Starting lair-keystore subprocess with debug level: %s", this.options.lair_log );
	this.lair			= new SubProcess({
	    "name": "lair-keystore",
	    "command": [ "lair-keystore", "-d", this.config.keystore_path ],
	    "x_env": {
		"RUST_LOG": this.options.lair_log,
	    },
	});
	log.debug("Started Lair subprocess with PID: %s", this.lair.pid );

	this.lair.stdout( line => {
	    let parts			= dissect_rust_log( line );
	    this.emit("lair:stdout", parts.line, parts );
	});

	this.lair.stderr( line => {
	    let parts			= dissect_rust_log( line );
	    this.emit("lair:stderr", parts.line, parts );
	});

	await this.lair.output( line => {
	    return line.includes("lair-keystore-ready");
	});
	log.normal("Lair is ready...");


	log.info("Starting conductor subprocess with debug level: %s", this.options.conductor_log );
	this.conductor			= new SubProcess({
	    "name": "conductor",
	    "command": [ "holochain", "-c", this.config_file ],
	    "x_env": {
		"RUST_LOG": this.options.conductor_log,
	    },
	});
	log.debug("Started Conductor subprocess with PID: %s", this.conductor.pid );

	this.conductor.stdout( line => {
	    let parts			= dissect_rust_log( line );
	    this.emit("conductor:stdout", parts.line, parts );
	});

	this.conductor.stderr( line => {
	    let parts			= dissect_rust_log( line );
	    this.emit("conductor:stderr", parts.line, parts );
	});

	this._ready			= this.conductor.output("Conductor ready");
    }

    ready () {
	return this._ready;
    }

    close () {
	return this.conductor.close();
    }

    async stop () {
	log.debug("Stopping lair (%s) and conductor (%s)", !!this.lair, !!this.conductor );
	return await Promise.all([
	    this.lair
		? this.lair.stop()
		: Promise.resolve(),
	    this.conductor
		? this.conductor.stop()
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

	this._destroyed			= true;

	let statuses			= await this.stop();
	log.silly("Exit statuses: Lair => %s && Conductor => %s", statuses[0], statuses[1] );

	if ( this.options.cleanup !== false ) {
	    log.normal("Cleaning up automatically generated content");

	    if ( this._cleanup_config === true ) {
		log.warn("Removing automatically generated config file: %s", this.config_file );
		fs.unlinkSync( this.config_file );
	    }

	    if ( this._cleanup_basedir !== false ) {
		log.warn("Removing temporary directory created by this process: %s", this._cleanup_basedir );
		fs.rmSync( this._cleanup_basedir, {
		    "recursive": true,
		    "force": true,
		});
	    }
	}
    }

    async _handle_exit ( code ) {
	if ( this._destroyed === true )
	    return;

	console.log("Automatically cleaning up Holochain");
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
