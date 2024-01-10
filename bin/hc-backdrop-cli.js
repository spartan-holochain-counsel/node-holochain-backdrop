#!/usr/bin/env node
import { Logger }			from '@whi/weblogger';
const log				= new Logger("cli", process.env.LOG_LEVEL );

import path				from 'path';
import url				from 'url';
import { Command, Option }		from 'commander';

import { Holochain }			from '../src/index.js';


function increaseTotal ( v, total ) {
    return total + 1;
}

function detect_level ( level, default_level ) {
    let lvl		= default_level;

    if ( log[ level ] !== undefined )
	lvl		= level;
    else if ( level === "trace" )
	lvl		= "trace";

    return lvl;
}

const COLOR_RESET			= "\x1b[0m";
const COLORS				= {
    "FATAL_LEVEL":	"\x1b[91;1m",
    "FATAL_MESSAGE":	"",

    "ERROR_LEVEL":	"\x1b[31m",
    "ERROR_MESSAGE":	"",

    "WARN_LEVEL":	"\x1b[33;1m",
    "WARN_MESSAGE":	"\x1b[22m",

    "NORMAL_LEVEL":	"\x1b[35;1m",
    "NORMAL_MESSAGE":	COLOR_RESET,

    "INFO_LEVEL":	"\x1b[36;1m",
    "INFO_MESSAGE":	COLOR_RESET,

    "DEBUG_LEVEL":	"\x1b[1m",
    "DEBUG_MESSAGE":	COLOR_RESET,

    "TRACE_LEVEL":	"\x1b[2;1m",
    "TRACE_MESSAGE":	"\x1b[0;2m",
};

function level_color ( level ) {
    return COLORS[`${level.trim()}_LEVEL`]	|| "";
}
function msg_color ( level ) {
    return COLORS[`${level.trim()}_MESSAGE`]	|| "";
}

let verbosity				= 0;
const log_levels			= {
    fatal: 0,
    error: 1,
    warn: 2,
    normal: 3,
    info: 4,
    debug: 5,
    trace: 6,
};
const RUST_LOG_LEVELS			= {
    0: "error",
    1: "error",
    2: "warn",
    3: "warn",
    4: "info",
    5: "debug",
    6: "trace",
};
function should_i_log ( level ) {
    return verbosity >= log_levels[ level ];
}

function holochain_log ( prefix, parts ) {
    if ( parts.level === null ) {
	return console.error(
	    `%s %s\x1b[0;97m %s\x1b[0m`,
	    parts.date.toISOString(),
	    prefix,
	    parts.message
	);
    }

    let lvl				= detect_level( parts.level, "normal" )

    if ( should_i_log( lvl ) === false )
	return;

    lvl					= ("  " + lvl).slice( -6 ).toUpperCase();
    console.error(
	`%s %s\x1b[0m %s%s\x1b[0m | \x1b[36m%s\x1b[39m | %s%s\x1b[0m`,
	parts.date.toISOString(),
	prefix,
	level_color( lvl ),
	lvl,
	parts.context.padEnd(48),
	msg_color( lvl ),
	parts.message
    );
}

let quiet				= false;

function print ( msg ) {
    if ( quiet )
	return;

    process.stdout.write(`\x1b[37m${msg}\x1b[0m\n`);
}


export async function main ( args, callback ) {
    if ( callback && typeof callback !== "function" )
	throw new TypeError(`Callback must be a function; not type of '${typeof callback}'`);

    const program			= new Command();

    program
	.version("0.1.0")
	.option("-v, --verbose", "increase logging verbosity", increaseTotal, 2 ) // increase starting from 'warn'
	.option("-q, --quiet", "suppress all printing except for final result", false )
	.option("-p, --admin-port <port>", "set the admin port that will be saved in Conductor's config", parseInt )
	.option("-c, --config <path>", "set the config path (it will be generated if file does not exist)" )
	.option("-t, --timeout <timeout>", "set timeout for Holochain start-up (default 60 seconds)" )
	.hook("preAction", async function ( self, action ) {
	    const options		= self.opts();

	    quiet			= options.quiet;
	    verbosity			= options.verbose === undefined
		? ( quiet
		    ? 1 // turn off 'warn' level when --quiet is used
		    : 2 // show fatal, error, and warn by default
		  )
		: options.verbose

	    log.setLevel( verbosity );
	})
	.action(async function ( options ) {

	    async function graceful_shutdown () {
		print("\nStopping Holochain...");
		try {
		    await holochain.stop();
		    await holochain.destroy();
		} catch (err) {
		    log.error("Holochain stop raised an error: %s", err.stack );
		} finally {
		    process.off("exit", graceful_shutdown );
		    process.off("SIGINT", graceful_shutdown );
		}
	    }
	    process.once("exit", graceful_shutdown );
	    process.once("SIGINT", graceful_shutdown );

	    let rust_log		= process.env.RUST_LOG || RUST_LOG_LEVELS[verbosity] || "trace";
	    let holochain		= new Holochain({
		"lair_log": rust_log,
		"conductor_log": rust_log,
		"config": {
		    "admin_port": options.adminPort,
		    "path": options.config && path.resolve( process.cwd(), options.config ),
		},
		"timeout": options.timeout,
		"default_loggers": !quiet,
	    });

	    try {
		let base_dir		= await holochain.setup();

		print(`Starting Holochain in "${base_dir}"...`);
		await holochain.start( options.timeout );

		await holochain.ready();
		print(`Holochain is ready`);

		if ( callback )
		    callback( holochain );

		await holochain.close();
	    } catch (err) {
		throw err;
	    } finally {
		print("Running cleanup...");
		await graceful_shutdown();
	    }
	})
	.allowExcessArguments( false );

    log.info("Parsing args: %s", args );
    await program.parseAsync( args );

    const options			= program.opts();
}

if ( typeof process?.mainModule?.filename !== "string" ) {
    log.normal("Running as CLI interface");
    main( process.argv )
	.catch( console.error );
}


export default {
    main,
};
