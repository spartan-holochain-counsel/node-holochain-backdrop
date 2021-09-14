#!/usr/bin/env node
const path				= require('path');
const logger				= require('@whi/stdlog');
const log				= logger(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const { Command, Option }		= require('commander');
const { Holochain }			= require('../src/index.js');


function increaseTotal ( v, total ) {
    return total + 1;
}

function detect_level ( level, default_level ) {
    let lvl		= default_level;

    if ( log[ level ] !== undefined )
	lvl		= level;
    else if ( level === "trace" )
	lvl		= "silly";

    return lvl;
}

const COLORS				= logger.COLOR_CONFIG;
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
    // normal: 3,
    info: 4,
    debug: 5,
    silly: 6,
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


async function main ( args, callback ) {
    if ( callback && typeof callback !== "function" )
	throw new TypeError(`Callback must be a function; not type of '${typeof callback}'`);

    const program			= new Command();

    program
	.version("0.1.0")
	.option("-v, --verbose", "increase logging verbosity", increaseTotal, 2 ) // increase starting from 'warn'
	.option("-q, --quiet", "suppress all printing except for final result", false )
	.option("-p, --admin-port <port>", "set the admin port that will be saved in Conductor's config", parseInt )
	.option("-c, --config <path>", "set the config path (it will be generated if file does not exist)" )
	.hook("preAction", async function ( self, action ) {
	    const options		= self.opts();

	    quiet			= options.quiet;
	    verbosity			= options.verbose === undefined
		? ( quiet
		    ? 1 // turn off 'warn' level when --quiet is used
		    : 2 // show fatal, error, and warn by default
		  )
		: options.verbose

	    log.transports[0].setLevel( verbosity );
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
	    });

	    if ( !quiet ) {
		holochain.on("lair:stdout", (line, parts) => {
		    holochain_log( "\x1b[39;1m     Lair STDOUT:", parts );
		});

		holochain.on("lair:stderr", (line, parts) => {
		    holochain_log( "\x1b[31;1m     Lair STDERR:", parts );
		});

		holochain.on("conductor:stdout", (line, parts) => {
		    holochain_log( "\x1b[39;1mConductor STDOUT:", parts );
		});

		holochain.on("conductor:stderr", (line, parts) => {
		    holochain_log( "\x1b[31;1mConductor STDERR:", parts );
		});
	    }

	    try {
		let base_dir		= await holochain.setup();

		print(`Starting Holochain in "${base_dir}"...`);
		await holochain.start();

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


if ( require.main === module ) {
    log.normal("Running as CLI interface");
    main( process.argv )
	.catch( console.error );
}


module.exports = {
    main,
};
