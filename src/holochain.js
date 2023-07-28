const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal',
});

global.WebSocket			= require('ws');

const fs				= require('fs');
const YAML				= require('yaml');
const EventEmitter			= require('events');
const getAvailablePort			= require('get-port');
const { execSync }			= require('child_process');
const { SubProcess }			= require('@whi/subprocess');
const { PromiseTimeout,
	TimeoutError }			= require('@whi/promise-timeout');
const { AdminClient,
	AgentClient }			= require('@whi/holochain-client');

const { parse_line,
	column_eclipse_right,
	column_eclipse_left,
	mktmpdir }			= require('./utils.js');
const { generate }			= require('./config.js');


const DEFAULT_LAIR_LOG			= process.env.RUST_LOG || "info";
const DEFAULT_COND_LOG			= process.env.RUST_LOG || "info";

const HOLOCHAIN_DEFAULTS		= {
    "lair_log": process.env.LAIR_LOG || DEFAULT_LAIR_LOG,
    "conductor_log": process.env.CONDUCTOR_LOG || DEFAULT_COND_LOG,
    "default_loggers": false,
    "default_stdout_loggers": false,
    "default_stderr_loggers": false,
    "timeout": 10_000,
    "clientConstructor": ( agent, roles, app_port ) => {
	const client			= new AgentClient( agent, roles, app_port );
	all_clients.push( client );
	return client;
    },
    get name () {
	return Math.random().toString(16).slice(-12);
    },
};

const all_clients			= [];
function exit_cleanup () {
    all_clients.forEach( client => client.close() );
}
process.once("exit", exit_cleanup );

async function timed ( fn ) {
    const start				= Date.now();
    await fn();
    return Date.now() - start;
}


class Holochain extends EventEmitter {
    constructor ( options = {} ) {
	super();

	this._exit_handler		= this._handle_exit.bind(this);
	process.once("exit", this._exit_handler );

	this.options			= Object.assign({}, HOLOCHAIN_DEFAULTS, options );
	this.options.name		= this.options.name.slice(0,8);
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

	if ( this.options.default_loggers === true ) {
	    log.debug("Adding all default stdout/stderr");
	    this.options.default_stdout_loggers		= true;
	    this.options.default_stderr_loggers		= true;
	}

	if ( this.options.default_stdout_loggers === true ) {
	    log.silly("Adding default stdout line event logging hooks");
	    this.on("lair:stdout", (line, parts) => {
		if ( parts.type === "multiline" )
		    console.log( "\x1b[33;1m[%s]      Lair STDOUT:\x1b[0m %s\x1b[0m", this.id, line );
		else if ( parts.type === "print" )
		    console.log( "\x1b[33;1m[%s]      Lair STDOUT:\x1b[37;22m %s\x1b[0m", this.id, parts.message );
		else
		    console.log( "\x1b[33;1m[%s]      Lair STDOUT:\x1b[37;22m %s\x1b[0m", this.id, line );
	    });

	    this.on("conductor:stdout", (line, parts) => {
		if ( parts.type === "multiline" )
		    console.log( "\x1b[33;1m[%s] Conductor STDOUT:\x1b[0m %s\x1b[0m", this.id, line );
		else if ( parts.type === "print" )
		    console.log( "\x1b[33;1m[%s] Conductor STDOUT:\x1b[37;22m %s\x1b[0m", this.id, parts.message );
		else
		    console.log( "\x1b[33;1m[%s] Conductor STDOUT:\x1b[0m %s\x1b[0m", this.id, line );
	    });

	}
	if ( this.options.default_stderr_loggers === true ) {
	    log.silly("Adding default stderr line event logging hooks");
	    this.on("lair:stderr", (line, parts) => {
		console.log( "\x1b[31;1m[%s]      Lair STDERR:\x1b[0m %s\x1b[0m", this.id, line );
	    });

	    this.on("conductor:stderr", (line, parts) => {
		if ( line.includes("func_translator") )
		    return;
		console.log( "\x1b[31;1m[%s] Conductor STDERR:\x1b[0m %s\x1b[0m", this.id, line );
	    });
	}
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

		this.config		= await this.options.config.construct.call(this);

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

	this.keystore_path		= path.resolve( this.basedir, "lair-keystore" );
	if ( ! fs.existsSync( this.keystore_path ) ) {
	    log.info("Creating Lair path: %s", this.keystore_path );
	    fs.mkdirSync( this.keystore_path, {
		"recursive": true,
	    });
	}

	return this.basedir;
    }

    setup () {
	return this.configured;
    }

    start ( timeout = 60_000 ) {
	const start_time		= Date.now();

	function elapsed () {
	    return Date.now() - start_time;
	}

	function remaining_time () {
	    return timeout - elapsed();
	}

	return new PromiseTimeout( async (f,r) => {
	    if ( this.conductor )
		throw new Error(`Tried to start Conductor when is was already started`);

	    await this.setup();

	    const lair_config_path	= path.join( this.keystore_path, "lair-keystore-config.yaml" );
	    if ( ! fs.existsSync( lair_config_path ) ) {
		log.normal("Initializing lair-keystore because config (%s) did not exist", lair_config_path );
		let output		= execSync(`lair-keystore -r ${this.keystore_path} init -p`, {
		    "input": "",
		    "encoding": "utf8",
		});
	    }

	    const lair_config_yaml	= fs.readFileSync( lair_config_path, "utf8" );
	    const lair_config		= YAML.parse( lair_config_yaml );

	    this.config.keystore.connection_url = lair_config.connectionUrl;

	    log.info("Writing config file to: %s", this.config_file );
	    fs.writeFileSync(
		this.config_file,
		YAML.stringify(this.config),
		"utf8"
	    );

	    log.info("Starting lair-keystore subprocess with debug level: %s", this.options.lair_log );
	    this.lair			= new SubProcess({
		"name": "Lair Keystore Process",
		"command": [ "lair-keystore", "-r", this.keystore_path, "server", "-p" ],
		"x_env": {
		    "RUST_LOG": this.options.lair_log,
		},
		"input": "",
	    });

	    this.lair.stdout( line => {
		let parts		= parse_line( line );
		this.emit("lair:stdout", parts.formatted, parts );
	    });

	    this.lair.stderr( line => {
		let parts		= parse_line( line );
		this.emit("lair:stderr", parts.formatted, parts );
	    });

	    log.debug("Sending input to %s (writable: %s)", this.lair.toString(), this.lair._process.stdin.writable );
	    this.lair._process.stdin.end("\n");

	    await this.lair.ready( remaining_time() );
	    log.debug("Started Lair subprocess with PID: %s", this.lair.pid );
	    log.debug("%s seconds elapsed", elapsed()/1000 );

	    await this.lair.output("running", remaining_time() );
	    log.normal("Lair is ready...");
	    log.debug("%s seconds elapsed", elapsed()/1000 );

	    log.info("Starting conductor subprocess with debug level: %s", this.options.conductor_log );
	    this.conductor			= new SubProcess({
		"name": "Holochain Conductor",
		"command": [ "holochain", "-p", "-c", this.config_file ],
		"x_env": {
		    "RUST_LOG": this.options.conductor_log,
		},
	    });

	    this.conductor.stdout( line => {
		let parts		= parse_line( line );
		this.emit("conductor:stdout", parts.formatted, parts );
	    });

	    const fatal			= [];
	    this.conductor.stderr( line => {
		if ( line.includes("FATAL") || fatal.length )
		    fatal.push( line );

		let parts		= parse_line( line );
		this.emit("conductor:stderr", parts.formatted, parts );

		if ( line.startsWith("}") || line.includes("Thank you kindly!") )
		    r( fatal.join("\n") );
	    });

	    log.debug("Sending input to %s (writable: %s)", this.conductor.toString(), this.conductor._process.stdin.writable );
	    this.conductor._process.stdin.end("\n");

	    await this.conductor.ready( remaining_time() );
	    log.debug("Started Conductor subprocess with PID: %s", this.conductor.pid );
	    log.debug("%s seconds elapsed", elapsed()/1000 );

	    await this.conductor.output("Conductor ready", remaining_time() );
	    log.debug("%s seconds elapsed", elapsed()/1000 );

	    const ports			= this.adminPorts();
	    this.admin			= new AdminClient( ports[0], {
		"timeout": this.options.timeout,
	    });

	    log.normal("Conductor is ready...");
	    this._ready_fulfill();
	    f();
	}, timeout, "start Holochain" );
    }

    ready () {
	return this._ready;
    }

    close () {
	return this.conductor.close();
    }

    async stop () {
	if ( this.admin )
	    await this.admin.close();

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

    async destroy ( exit_code = "unspecified" ) {
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
		if ( fs.existsSync( this.config_file ) )
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

    async setupApp ( app_port, app_id_prefix, actor, agent, happ_input, options ) {
	const app_id			= `${app_id_prefix}-${actor}`;

	log.debug("Installing app '%s' for agent %s...", app_id, actor );
	const installation		= await this.admin.installApp( app_id, agent, happ_input, {
	    "network_seed": options.network_seed,
	});

	log.debug("Activating app '%s' for agent %s...", app_id, actor );
	const enabled			= await this.admin.enableApp( app_id );

	const dnas			= {};
	const cells			= {};

	for ( let role_name in installation.roles ) {
	    const cell_info		= installation.roles[ role_name ];
	    const agent_hash		= cell_info.cell_id[1];
	    const dna_hash		= cell_info.cell_id[0];

	    dnas[ role_name ]		= dna_hash;
	    cells[ role_name ]		= {
		"name": role_name,
		"id": cell_info.cell_id,
		"dna": dna_hash,
		"agent": agent_hash,
	    };

	    await this.admin.grantUnrestrictedCapability( "testing", agent_hash, dna_hash, "*" );
	}

	return {
	    "id": app_id,
	    "agent": agent,
	    "actor": actor,
	    "status": enabled.app.status,
	    "dnas": dnas,
	    "cells": cells,
	    "app_port": app_port,
	    "client": this.options.clientConstructor( agent, dnas, app_port ),
	    "source": happ_input,
	};
    }

    async backdrop ( happs, opts = {}) {
	const options			= Object.assign({}, {
	    "actors": [ "alice" ],
	    "network_seed": Math.random().toString(16).slice(-12),
	}, opts );

	await this.configued;

	// Start holochain if it is not already started
	if ( !this.conductor )
	    await this.start();

	const app_port			= options.app_port || await getAvailablePort();

	log.debug("Attaching app interface to port %s", app_port );
	await this.admin.attachAppInterface( app_port );

	const agents			= {};
	for ( let actor of options.actors ) {
	    const agent			= await this.admin.generateAgent();
	    const installs		= {};

	    for ( let app_id_prefix in happs ) {
		let happ_input		= happs[ app_id_prefix ];
		let setup_opts		= {};

		// A config object that doesn't have the bundle properties is assumed to be a map of
		// DNA bundle paths.
		if ( typeof happ_input !== "string" ) {
		    if ( typeof happ_input.manifest === "object" &&
			 typeof happ_input.resources === "object" ) {
			// Do not override network_seed if there is one set in the manifest role DNA
			// modifiers
			happ_input.manifest.roles.forEach( role_config => {
			    if ( !role_config.dna.modifiers ) {
				role_config.dna.modifiers = {
				    "network_seed": options.network_seed,
				};
			    }
			    else if ( !role_config.dna.modifiers.network_seed ) {
				role_config.dna.modifiers.network_seed = options.network_seed;
			    }
			});
		    }
		    else {
			log.debug("Generating hApp bundle from DNAs...");
			happ_input		= await create_happ_bundle( app_id_prefix, happ_input );
			setup_opts.network_seed	= options.network_seed;
		    }
		}
		else {
		    setup_opts.network_seed	= options.network_seed;
		}

		log.debug("Setup app '%s' for agent %s...", app_id_prefix, actor );
		installs[ app_id_prefix ]	= await this.setupApp( app_port, app_id_prefix, actor, agent, happ_input, setup_opts );
	    }

	    agents[ actor ]		= installs;
	}

	return agents;
    }

    get id () {
	return this.options.name;
    }
}

async function create_happ_bundle ( name, dnas ) {
    const bundle_config			= {
	"manifest": {
	    "manifest_version": "1",
	    "name": name,
	    "roles": []
	},
	"resources": {},
    };

    for ( let [role_name, dna_path] of Object.entries(dnas) ) {
	bundle_config.manifest.roles.push({
	    "name": role_name,
	    "dna": {
		"path": dna_path,
	    },
	});
    }

    return bundle_config;
}


module.exports = {
    Holochain,
    TimeoutError,
};
