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


function dissect_rust_log ( line ) {
    let parts				= {
	"date": new Date(),
	"level": null,
	"context": null,
	"message": line,
	"multiline": false,
	line,
    };

    // Shortcut empty lines
    if ( line.trim() === "" )
	return parts;

    // If the line starts with whitespace, we assume that this is part of a multiline output
    if ( line.startsWith(" ")
	 || line.trim().length === 1 // Catch a closing brace or bracket from debug output
       ) {
	parts.multiline			= true;
	return parts;
    }

    try {
	let date			= line.slice(  4, 23 );

	try {
	    let date_string		= (new Date()).getFullYear() + " " + date;
	    date			= new Date( date_string );
	    if ( isNaN( date.getTime() ) )
		throw new Error(`Invalid date in "${line}"`);
	} catch (err) {
	    // console.error(err);
	    throw err;
	}

	let level			= line.slice( 28, 38 );
	let msg				= line.slice( 43 );

	let context			= `?`;
	let msg_parts			= msg.split(" ");


	if ( msg_parts[0].includes("wasm_trace") ) {
	    let group			= eclipse_right( sanitize_str( msg_parts[0] ).slice(0, -1), 22 );
	    let location		= eclipse_left( msg_parts[1], Math.max(45 - group.length, 1) );

	    level			= "NORMAL";
	    context			= `(${group}) ${location}`;
	    msg				= msg_parts.slice(2).join(" ");
	}
	else if ( !msg_parts[0].slice(0,-1).includes(":") && msg_parts[1] && msg_parts[1].includes("::") ) {
	    // Feb 28 13:47:41.144  INFO										// 43 characters
	    // publish_dht_ops_workflow{agent=AgentPubKey(uhCAk3O9tjVpZzUzCjZTnRQR-HBHzrnLDOQVvjvp_brKS8zBsYH36)}:	// msg_parts[0]
	    // holochain::core::workflow::publish_dht_ops_workflow:							// msg_parts[1]
	    // committed sent ops											// msg_parts.slice(2).join(" ")
	    if ( msg_parts[0].includes("publish_dht_ops_workflow") ) {
		msg_parts[0]		= msg_parts[0].slice( 59, 59+53 );
	    }

	    let group			= eclipse_right( sanitize_str( msg_parts[0] ).slice(0, -1), 22 );
	    let location		= eclipse_left( msg_parts[1], Math.max(45 - group.length, 1) );

	    context			= `(${group}) ${location}`;
	    msg				= msg_parts.slice(2).join(" ");
	}
	else if ( msg_parts[0].endsWith(":") ) {
	    let location		= eclipse_left( msg_parts[0], 48 );
	    context			= `${location}`
	    msg				= msg_parts.slice(1).join(" ");
	}
	else {
	    msg				= msg_parts.join(" ");
	}

	parts.date			= date;
	parts.level			= level.replace(strip_escape_codes, "").trim().toUpperCase();
	parts.context			= context;
	parts.message			= msg;
	parts.line			= `\x1b[22;37m${date.toISOString()}\x1b[35m ${parts.level.slice(0,5).padStart(5)}\x1b[39m | \x1b[36m${context.padEnd(48)}\x1b[39m | \x1b[0m${eclipse_right(msg, 2000)}\x1b[0m`;
    } catch (err) {
	// log.silly("Failed to dissect Rust log: %s", line );
    } finally {
	return parts;
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
    dissect_rust_log,
    mktmpdir,
};
