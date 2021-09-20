const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal',
});

const fs				= require('fs');
const YAML				= require('yaml');
const EventEmitter			= require('events');
const { spawn }				= require('child_process');
const { SubProcess,
	TimeoutError }			= require('@whi/subprocess');
const { HoloHash }			= require('@whi/holo-hash');
const { AdminWebsocket,
	AppWebsocket }			= require('@holochain/conductor-api');

const { dissect_rust_log,
	mktmpdir }			= require('./utils.js');
const { generate }			= require('./config.js');


const DEFAULT_LAIR_LOG			= process.env.RUST_LOG || "info";
const DEFAULT_COND_LOG			= process.env.RUST_LOG || "info";

const HOLOCHAIN_DEFAULTS		= {
    "lair_log": process.env.LAIR_LOG || DEFAULT_LAIR_LOG,
    "conductor_log": process.env.CONDUCTOR_LOG || DEFAULT_COND_LOG,
};


class Holochain extends EventEmitter {
    constructor ( options = {} ) {
	super();

	this._exit_handler		= this._handle_exit.bind(this);
	process.once("exit", this._exit_handler );

	this.options			= Object.assign({}, HOLOCHAIN_DEFAULTS, options );
	this.basedir			= null;

	this._cleanup_config		= false;
	this._cleanup_basedir		= false;
	this._destroyed			= false;

	this.configured			= new Promise( (f,r) => {
	    this._prep_fulfill		= f;
	    this._prep_reject		= r;
	});

	this._ready			= new Promise( (f,r) => {
	    this._ready_fulfill		= f;
	    this._ready_reject		= r;
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

		// We force the config path to also be specified so that we don't orphan the storage
		// paths from the config file in the clean-up phase.
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

		    if ( this.options.config.admin_port
			 && !this.adminPorts().includes( this.options.config.admin_port ) )
			throw new Error(`The given admin port (${this.options.config.admin_port}) does not match any from the config file: ${this.adminPorts().join(", ")}`);
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

	    this.config			= await generate(
		this.basedir,
		this.options.config && this.options.config.admin_port
	    );
	    log.normal("Generated a config with admin port: %s", this.adminPorts()[0] );

	    if ( this.config_file === undefined ) {
		log.warn("No config file path was specificed; using tmp dir: %s", this.basedir );

		this._cleanup_config	= true;
		this.config_file	= path.resolve( this.basedir, "config.yaml" );
		log.debug("Set config file location to: %s", this.config_file );
	    }
	}

	if ( ! fs.existsSync( this.basedir ) ) {
	    log.info("Creating basedir path: %s", this.basedir );
	    fs.mkdirSync( this.basedir, {
		"recursive": true,
	    });
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

	this.lair.stdout( line => {
	    let parts			= dissect_rust_log( line );
	    this.emit("lair:stdout", parts.line, parts );
	});

	this.lair.stderr( line => {
	    let parts			= dissect_rust_log( line );
	    this.emit("lair:stderr", parts.line, parts );
	});

	await this.lair.ready( 4_000 );
	log.debug("Started Lair subprocess with PID: %s", this.lair.pid );

	await this.lair.output("lair-keystore-ready");
	log.normal("Lair is ready...");


	log.info("Starting conductor subprocess with debug level: %s", this.options.conductor_log );
	this.conductor			= new SubProcess({
	    "name": "conductor",
	    "command": [ "holochain", "-c", this.config_file ],
	    "x_env": {
		"RUST_LOG": this.options.conductor_log,
	    },
	});

	this.conductor.stdout( line => {
	    let parts			= dissect_rust_log( line );
	    this.emit("conductor:stdout", parts.line, parts );
	});

	this.conductor.stderr( line => {
	    let parts			= dissect_rust_log( line );
	    this.emit("conductor:stderr", parts.line, parts );
	});

	await this.conductor.ready( 4_000 );
	log.debug("Started Conductor subprocess with PID: %s", this.conductor.pid );

	await this.conductor.output("Conductor ready", 5000 );

	log.normal("Conductor is ready...");
	this._ready_fulfill();
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
	this._assert_setup();

	return this.config.admin_interfaces.map( iface => iface.driver.port );
    }

    async destroy ( exit_code ) {
	log.debug("Destroying Holochain because of %s", exit_code );

	if ( this._destroyed === true )
	    return;

	process.off("exit", this._exit_handler );
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
		try { // TODO: fix silent fail when .rmSync does not exist
		    fs.rmSync( this._cleanup_basedir, {
			"recursive": true,
			"force": true,
		    });
		} catch (err) {
		    console.log( err );
		}
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

    _assert_setup () {
	if ( this.config === undefined )
	    throw new Error(`Not setup`);
    }

    async backdrop ( app_id_prefix, app_port, dnas, agents = [ "alice" ] ) {
	const ports			= this.adminPorts();
	log.debug("Waiting for Admin client to connect @ ws://localhost:%s", ports[0] );
	const admin			= await AdminWebsocket.connect( "ws://localhost:" + ports[0] );

	log.debug("Attaching app interface to port %s", app_port );
	await admin.attachAppInterface({
	    "port": app_port,
	});

	log.debug("Registering DNAs...");
	const dna_list			= await Promise.all(
	    Object.entries( dnas ).map( async ([dna_nick, dna_path]) => {
		log.debug(" - registering DNA package: %s", dna_path );
		const dna_hash		= await new HoloHash( await admin.registerDna({
		    "path": dna_path,
		}) );
		log.silly("Registered DNA '%s' with hash (%s) from: %s", dna_nick, String(dna_hash), dna_path );

		return {
		    "nick": dna_nick,
		    "path": dna_path,
		    "hash": new HoloHash( dna_hash ),
		};
	    })
	);

	log.debug("Creating agents and installing apps...");
	const agent_list		= await Promise.all( agents.map(async ( actor ) => {
	    const pubkey		= new HoloHash( await admin.generateAgentPubKey() );
	    const app_id		= `${app_id_prefix}-${actor}`;

	    const cell_list		= dna_list.map( dna => {
		return {
		    "id": [ dna.hash, pubkey ],
		    "dna": dna,
		    "agent": pubkey
		};
	    });

	    log.debug("Installing app '%s' for agent %s...", app_id, actor );
	    await admin.installApp({
		"installed_app_id": app_id,
		"agent_key": pubkey,
		"dnas": dna_list.map( ({ nick, hash }) => {
		    return { nick, hash };
		}),
	    });

	    log.debug("Activating app '%s' for agent %s...", app_id, actor );
	    await admin.activateApp({
		"installed_app_id": app_id,
	    });

	    return {
		"id": app_id,
		"actor": actor,
		"agent": pubkey,
		"cells": cell_list.reduce( (acc, cell) => {
		    acc[cell.dna.nick]	= cell;
		    return acc;
		}, {}),
	    };
	}) );

	return agent_list.reduce( (acc, happ) => {
	    acc[happ.actor]			= happ;
	    return acc;
	}, {});
    }
}


module.exports = {
    Holochain,
    TimeoutError,
};
