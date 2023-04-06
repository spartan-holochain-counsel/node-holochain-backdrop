const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal',
});

const fs				= require('fs');
const os				= require('os');


const strip_escape_codes		= /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

function sanitize_str ( str ) {
    return str.replace(strip_escape_codes, "");
}


function column_eclipse_right ( str, length, align = "left" ) {
    if ( typeof str !== "string" )
	str				= "";

    return align === "left"
	? eclipse_right( str, length ).padEnd( length, " ")
	: eclipse_right( str, length ).padStart( length, " ");
}

function column_eclipse_left ( str, length, align = "right" ) {
    if ( typeof str !== "string" )
	str				= "";

    return align === "right"
	? eclipse_left( str, length ).padStart( length, " ")
	: eclipse_left( str, length ).padEnd( length, " ");
}

function eclipse_right ( str, length ) {
    str					= sanitize_str( str );

    if ( length === 0 )
	return "\u2026";
    if ( str.length > length )
	return str.slice( 0, length - 1 ) + "\u2026";
    else
	return str.slice( 0, length );
}

function eclipse_left ( str, length ) {
    str					= sanitize_str( str );
    rlength				= Math.max( length - 1, 1 );

    if ( length === 0 )
	return "\u2026";
    if ( str.length > length )
	return "\u2026" + str.slice( -rlength );
    else
	return str.slice( 0, length );
}

function parse_line ( source ) {
    const text				= sanitize_str( source );
    const metadata			= {};

    let type				= "unknown";
    let date				= new Date();
    let level				= null;
    let group				= null;
    let location			= null;
    let message				= null;

    if ( text.startsWith(" ")
	 || text.trim().length === 1 // Catch a closing brace or bracket from debug output
       ) {
	type				= "multiline";
    }
    // If it doesn't start with a date, then it is a normal printed line
    else if ( !text.slice(0, 27).match(/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+Z/) ) {
	type				= "print";
	level				= "normal";
	message				= text;
    }
    else {
	// 0                        27 29 33 34
	// |                         | |   | |
	// 2023-04-05T23:54:56.267039Z DEBUG ...
	let msg				= text.slice(34);
	date				= new Date( text.slice(0, 27) );
	level				= text.slice( 28, 33 ).toLowerCase().trim();

	if ( msg.startsWith("wasm_trace") ) {
	    // (\S+)       (\S+)                                     ([0-9]+)
	    // |           |                                         |  (.*)
	    // |           |                                         |  |
	    // wasm_trace: mere_memory_api::handlers:src/handlers.rs:32 Creating entries for remembering (3000000 bytes)
	    const matches		= msg.match(/(\S+): (\S+):([0-9]+) (.*)/);

	    type			= "wasm-trace";
	    level			= "normal";
	    group			= matches[1];	// wasm_trace
	    location			= matches[2];	// mere_memory_api::handlers:src/handlers.rs
	    line_number			= matches[3];	// 32
	    message			= matches[4];	// Creating entries for remembering (3000000 bytes)
	}
	else if ( msg.startsWith("publish_dht_ops_workflow") ) {
	    // (\S+)                                                                                               (\S+)                                                (\S+)                                                          ([0-9]+)
	    // |                                                                                                   |                                                    |                                                              |   (.*)
	    // |                                                                                                   |                                                    |                                                              |   |
	    // publish_dht_ops_workflow{agent=AgentPubKey(uhCAkIsrrEt9Pe83lfp4a_LqGV_w9FvUmRQEk4k0Vky-Q8ckVo5L5)}: holochain::core::workflow::publish_dht_ops_workflow: crates/holochain/src/core/workflow/publish_dht_ops_workflow.rs:46: publishing to 11 nodes
	    const matches		= msg.match(/(\S+): (\S+): (\S+):([0-9]+): (.*)/);

	    type			= "dht-opts"
	    group			= matches[2];	// holochain::core::workflow::publish_dht_ops_workflow
	    location			= matches[3];	// crates/holochain/src/core/workflow/publish_dht_ops_workflow.rs
	    line_number			= matches[4];	// 46
	    message			= matches[5];	// publishing to 11 nodes

	    //                                            43                                                 -3
	    //                                            |                                                   |
	    // publish_dht_ops_workflow{agent=AgentPubKey(uhCAkIsrrEt9Pe83lfp4a_LqGV_w9FvUmRQEk4k0Vky-Q8ckVo5L5)}
	    metadata.agent		= matches[1].slice( 43, -3 );
	}
	else {
	    // (\S+)      (\S+)                                      ([0-9]+)
	    // |          |                                          |   (.*)
	    // |          |                                          |   |
	    // holochain: crates/holochain/src/bin/holochain/main.rs:96: Conductor successfully initialized.
	    const matches		= msg.match(/(\S+): (\S+):([0-9]+): (.*)/);

	    if ( matches ) {
		type			= "group-location";
		group			= matches[1];	// holochain
		location		= matches[2];	// crates/holochain/src/bin/holochain/main.rs
		line_number		= matches[3];	// 96
		message			= matches[4];	// Conductor successfully initialized.
	    }
	}
    }

    const context			= group
	  ? `(${eclipse_right(group, 22)}) ${column_eclipse_left(location, 45-(Math.min(group.length, 22)))}`
	  : `${column_eclipse_left(location, 48)}`;

    return {
	type,
	source,
	text,
	date,
	level,
	group,
	location,
	context,
	message,
	metadata,
	"formatted": `\x1b[35;22m${date.toISOString()} \x1b[39m${level.toUpperCase().slice(0,5).padStart(5)}\x1b[39m | \x1b[36m${context}\x1b[39m | \x1b[0m${eclipse_right(message, 2000)}\x1b[0m`,
    }
}


function mktmpdir () {
    let tmpdir				= path.resolve( os.tmpdir(), "conductor-" );
    return new Promise( (f,r) => {
	fs.mkdtemp( tmpdir, (err, directory) => {
	    if (err)
		return r(err);

	    f(directory);
	});
    });
}


module.exports = {
    sanitize_str,
    eclipse_right,
    eclipse_left,
    column_eclipse_right,
    column_eclipse_left,
    parse_line,
    mktmpdir,
};
