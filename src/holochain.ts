import path				from 'path';
import { Logger }			from '@whi/weblogger';
const __dirname				= path.dirname( new URL(import.meta.url).pathname );
const log				= new Logger(
    "holochain",
    (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal'
);

import WebSocket			from 'ws';
global.WebSocket			= WebSocket;

import fs				from 'fs';
import YAML				from 'yaml';
import { EventEmitter }			from 'events';
import getAvailablePort			from 'get-port';

import { execSync }			from 'child_process';
import { PromiseTimeout }		from '@whi/promise-timeout';
import * as PromiseTimeoutLib		from '@whi/promise-timeout';
export const { TimeoutError }		= PromiseTimeoutLib;

import SubProcessLib			from '@whi/subprocess';
const { SubProcess }			= SubProcessLib;

import {
    AgentPubKey,
}					from '@spartan-hc/holo-hash';
import { AdminClient }			from '@spartan-hc/holochain-admin-client';

import { parse_line,
	 column_eclipse_right,
	 column_eclipse_left,
	 mktmpdir }			from './utils.js';
import { generate }			from './config.js';


const DEFAULT_LAIR_LOG			= process.env.RUST_LOG || "info";
const DEFAULT_COND_LOG			= process.env.RUST_LOG || "info";

const HOLOCHAIN_DEFAULTS		= {
    "lair_log": process.env.LAIR_LOG || DEFAULT_LAIR_LOG,
    "conductor_log": process.env.CONDUCTOR_LOG || DEFAULT_COND_LOG,
    "default_loggers": false,
    "default_stdout_loggers": false,
    "default_stderr_loggers": false,
    "timeout": 30_000,
    get name () {
	return Math.random().toString(16).slice(-12);
    },
};

const APP_CONFIG_DEFAULTS		= {
    "app_name": "*",
    "installed_app_id": null,
    "network_seed": "*",
    "membrane_proofs": {},
};


async function timed ( fn ) {
    const start				= Date.now();
    await fn();
    return Date.now() - start;
}


export class Holochain extends EventEmitter {
    #actors		: Record<string,AgentPubKey>	= {};
    #cleanup_basedir	: string | null			= null;
    #cleanup_config	: boolean			= false;
    #destroyed		: boolean			= false;
    #exit_handler	: (...args: any[]) => void;
    #ready		: Promise<void>;
    #ready_fulfill	: Function;
    #ready_reject	: Function;
    #prep_fulfill	: () => void;
    #prep_reject	: () => void;

    options		: any;
    basedir		: string | null			= null;
    app_ports		: Array<number>			= [];
    config		: any;
    config_file		: string;
    configured		: Promise<void>;
    lair		: typeof SubProcess;
    conductor		: typeof SubProcess;
    keystore_path	: string;
    admin		: AdminClient;

    constructor ( options = {} ) {
	super();

	this.#exit_handler		= this.#handle_exit.bind(this);
	process.once("exit", this.#exit_handler );

	this.options			= Object.assign({}, HOLOCHAIN_DEFAULTS, options );
	this.options.name		= this.options.name.slice(0,8);

	this.configured			= new Promise( (f,r) => {
	    this.#prep_fulfill		= f;
	    this.#prep_reject		= r;
	});

	this.#ready			= new Promise( (f,r) => {
	    this.#ready_fulfill		= f;
	    this.#ready_reject		= r;
	});

	this.#setup()
	    .then( this.#prep_fulfill, this.#prep_reject )
	    .catch( this.#prep_reject );

	if ( this.options.default_loggers === true ) {
	    log.debug("Adding all default stdout/stderr");
	    this.options.default_stdout_loggers		= true;
	    this.options.default_stderr_loggers		= true;
	}

	if ( this.options.default_stdout_loggers === true ) {
	    log.trace("Adding default stdout line event logging hooks");
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
	    log.trace("Adding default stderr line event logging hooks");
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

    async #setup () : Promise<string> {
	if ( this.config_file )
	    throw new Error(`Already setup @ ${this.config_file}`);


	log.trace("Setup using options: %s", this.options );
	if ( this.options.config ) {
	    if ( this.options.config.construct ) {
		log.info("Using constructor to build config content");

		// We force the config path to also be specified so that we don't orphan the storage
		// paths from the config file in the clean-up phase.
		if ( !this.options.config.path )
		    throw new Error(`You must specify the config path if you use a config constructor`);

		this.config		= await this.options.config.construct.call(this);

		log.warn("Flag for config cleanup");
		this.#cleanup_config	= true;
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
		this.basedir		= (await mktmpdir()) as string;
		this.#cleanup_basedir	= this.basedir;
		log.normal("Using tmp folder as base dir: %s", this.basedir );
	    }

	    this.config			= await generate(
		this.basedir,
		this.options.config && this.options.config.admin_port
	    );
	    log.normal("Generated a config with admin port: %s", this.adminPorts()[0] );

	    if ( this.config_file === undefined ) {
		log.warn("No config file path was specificed; using tmp dir: %s", this.basedir );

		this.#cleanup_config	= true;
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

	    this.conductor		= true;

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
	    this.#ready_fulfill();
	    f();
	}, timeout, "start Holochain" );
    }

    ready () {
	return this.#ready;
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
	    this.conductor && this.conductor !== true
		? this.conductor.stop()
		: Promise.resolve(),
	]);
    }

    adminPorts () {
	this.#assert_setup();

	return this.config.admin_interfaces.map( iface => iface.driver.port );
    }

    appPorts () {
	this.#assert_setup();

	return this.app_ports;
    }

    async ensureAppPort ( app_port ) {
	if ( !app_port )
	    app_port			= await getAvailablePort();

	log.debug("Attaching app interface to port %s", app_port );
	await this.admin.attachAppInterface( app_port );

	this.app_ports.push( app_port );

	return app_port;
    }

    async destroy ( exit_code = "unspecified" ) {
	log.debug("Destroying Holochain because of %s", exit_code );

	if ( this.#destroyed === true )
	    return;

	process.off("exit", this.#exit_handler );
	this.#destroyed			= true;

	let statuses			= await this.stop();
	log.trace("Exit statuses: Lair => %s && Conductor => %s", statuses[0], statuses[1] );

	if ( this.options.cleanup !== false ) {
	    log.normal("Cleaning up automatically generated content");

	    if ( this.#cleanup_config === true ) {
		log.warn("Removing automatically generated config file: %s", this.config_file );
		if ( fs.existsSync( this.config_file ) )
		    fs.unlinkSync( this.config_file );
	    }

	    if ( this.#cleanup_basedir !== null ) {
		log.warn("Removing temporary directory created by this process: %s", this.#cleanup_basedir );
		try { // TODO: fix silent fail when .rmSync does not exist
		    fs.rmSync( this.#cleanup_basedir, {
			"recursive": true,
			"force": true,
		    });
		} catch (err) {
		    console.log( err );
		}
	    }
	}
    }

    async #handle_exit ( code ) : Promise<void> {
	if ( this.#destroyed === true )
	    return;

	console.log("Automatically cleaning up Holochain");
	await this.destroy( code );

	log.info("Exiting with code: %s", code );
	process.exit( code );
    }

    #assert_setup () {
	if ( this.config === undefined )
	    throw new Error(`Not setup`);
    }

    randomAppName () {
	return ( Math.random() * 1e17 ).toString(16).slice(0,8);
    }

    randomNetworkSeed () {
	return Math.random().toString(16).slice(-12);
    }

    async profile ( name ) {
	if ( typeof name !== "string" )
	    throw new TypeError(`Profile input expects a 'string'; not type '${typeof name}'`);

	if ( this.#actors[ name ] === undefined )
	    this.#actors[ name ]	= await this.admin.generateAgent();

	return this.#actors[ name ];
    }

    async profiles ( ...names ) {
	return await Promise.all(
	    names.map( name => this.profile( name ) )
	);
    }

    async createBundleSource ( app_config ) {
	const bundle_source		= app_config.bundle;
	// Source can be either
	//
	//   File path		- indicating the path to a hApp bundle
	//   DNA list		- listing the DNAs and paths to DNA bundles
	//   Bundle		- a full bundle description with manifest + resources
	//

	// Handle 'File path'
	if ( typeof bundle_source === "string" )
	    return bundle_source;

	if ( [null, undefined].includes( bundle_source ) )
	    throw new TypeError(`Bundle source cannot be null or undefined`);

	if ( typeof bundle_source !== "object" )
	    throw new TypeError(`Expected bundle source to be an 'object'; not type '${typeof bundle_source}'`);

	// Handle 'Bundle'
	if ( typeof bundle_source.manifest === "object" &&
	     typeof bundle_source.resources === "object" ) {

	    bundle_source.manifest	= JSON.parse( JSON.stringify( bundle_source.manifest ) );
	    bundle_source.resources	= Object.assign( {}, bundle_source.resources );

	    // Do not override network_seed if there is one set in the manifest role DNA
	    // modifiers
	    bundle_source.manifest.roles.forEach( role_config => {
		if ( !role_config.dna.modifiers?.network_seed ) {
		    if ( !role_config.dna.modifiers )
			role_config.dna.modifiers = {};

		    role_config.dna.modifiers.network_seed = app_config.network_seed;
		}
	    });

	    return bundle_source;
	}

	if ( Object.values( bundle_source ).some( dna_path => typeof dna_path !== "string" ) )
	    throw new TypeError(`Unknown bundle source format; did not match File path, DNA list, or Bundle`);

	// Handle 'DNA list'
	log.debug("Generating hApp bundle from DNAs...");
	// log.trace("Created bundle source:", config );
	return await create_happ_bundle( app_config.app_name, bundle_source );
    }

    async createAppConfig ( profile_name, app_config ) {
	if ( typeof app_config === "string" ) {
	    app_config			= {
		"bundle": app_config,
	    };
	}

	if ( [null, undefined].includes( app_config.bundle ) ) {
	    log.error("Missing 'bundle' in app config:", app_config );
	    throw new TypeError(`Missing 'bundle' in app config`);
	}

	const config			= Object.assign( {}, APP_CONFIG_DEFAULTS, app_config );

	if ( config.installed_app_id && config.app_name )
	    throw new Error(`Misconfiguration: 'installed_app_id' will override 'app_name'; only set 1 in app configurations`);

	if ( config.app_name === "*" )
	    config.app_name		= this.randomAppName();
	if ( config.network_seed === "*" )
	    config.network_seed		= this.randomNetworkSeed();

	if ( !config.installed_app_id )
	    config.installed_app_id	= `${config.app_name}-${profile_name}`;

	config.bundle			= await this.createBundleSource( config );

	log.trace("Created app config:", config );
	return config;
    }

    async installApp ( profile_name, app_config ) {
	// Normalize app config input
	const config			= await this.createAppConfig( profile_name, app_config );
	const app_id			= config.installed_app_id;
	const modifiers			= { ...config };

	// Ensure the profile exists
	const pubkey			= await this.profile( profile_name );

	// Install app
	log.debug("Installing app '%s' with modifiers:", app_id, modifiers );
	const app_info			= await this.admin.installApp(
	    app_id, pubkey, config.bundle, modifiers
	);

	// Enable app
	log.debug("Enabling app '%s' for agent %s...", app_id, profile_name );
	const enabled			= await this.admin.enableApp( app_id );

	if ( enabled.errors?.length ) {
	    log.error("Failed to enable app '%s'", app_id );
	    enabled.errors.map( (msg, i) => {
		log.error("  - %s: %s", i, msg );
	    });
	    throw new Error(`Failed to enable app '${app_id}' with ${enabled.errors.length} error(s)`)
	}

	// Grant capabilities for each role
	for ( let [role_name,cell_info] of Object.entries( app_info.roles ) ) {
	    const agent_hash		= cell_info.cell_id[1];
	    const dna_hash		= cell_info.cell_id[0];

	    await this.admin.grantUnrestrictedCapability( "testing", agent_hash, dna_hash, "*" );
	}

	const app_info_obj		= {
	    ...enabled.app,
	    "source": config.bundle,
	};

	Object.defineProperties( app_info_obj, {
	    "app_id": {
		get () {
		    return this.installed_app_id;
		},
	    },
	});

	return {
	    "app_name": config.app_name,
	    "network_seed": config.network_seed,
	    "app_info": app_info_obj,
	};
    }

    // By default, an "install" will create a random network seed and use it for all the
    // profiles/apps.  Each app config can override the collective network seed.
    async install ( profile_names, app_configs, default_config = {} ) {
	// options - should be settings for all app_configs; such as 'network_seed'.  app config
	// settings take priority over
	if ( !this.conductor )
	    await this.start();

	const defaults			= Object.assign( { "network_seed": "*" }, default_config );

	if ( defaults.network_seed === "*" )
	    defaults.network_seed	= this.randomNetworkSeed();

	if ( !Array.isArray( profile_names ) )
	    profile_names		= [ profile_names ];

	if ( !Array.isArray( app_configs ) )
	    app_configs		= [ app_configs ];

	const installations		= {};

	for ( let name of profile_names ) {
	    installations[ name ]	= {};

	    for ( let [i,config] of Object.entries(app_configs) ) {
		if ( typeof config === "string" )
		    config			= { "bundle": config };
		const app_settings	= Object.assign( {}, defaults, config );

		log.debug("Install app settings:", app_settings );
		const install_info	= await this.installApp( name, app_settings );
		const { app_name,
			app_info }	= install_info;

		installations[ name ][ app_name ]	= app_info;

		Object.defineProperty( installations[ name ], i, {
		    "value": app_info,
		});
	    }
	}

	return installations;
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


export default {
    Holochain,
    TimeoutError,
};
