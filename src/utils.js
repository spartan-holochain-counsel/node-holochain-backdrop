
const fs				= require('fs');
const os				= require('os');
const path				= require('path');

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

function normalize_conductor_stderr ( line ) {
    try {
	let date				= line.slice(  4, 23 );

	try {
	    let date_string			= (new Date()).getFullYear() + " " + date;
	    date				= new Date( date_string );
	} catch (err) {
	    console.error(err);
	}

	let level				= line.slice( 28, 42 );
	let msg				= line.slice( 43 );

	let context;
	let msg_parts			= msg.split(" ");

	if ( !msg_parts[0].slice(0,-1).includes(":") && msg_parts[1].includes("::") ) {
	    let group			= sanitize_str( msg_parts[0] ).slice(0, -1);
	    let location			= eclipse_right( msg_parts[1], Math.max(45 - group.length, 1) );

	    context				= `${location} (${group})`;
	    msg				= msg_parts.slice(2).join(" ");
	}
	else {
	    let location			= msg_parts[0]
		.replace(strip_escape_codes, "").slice( -48 );
	    context				= `${location.padEnd(48)}`
	    msg				= msg_parts.slice(1).join(" ");
	}

	return `${date.toISOString()} ${level} | \x1b[36;2m${context}\x1b[0m | \x1b[2m${msg}`;
    } catch (err) {
	return line;
    }
}

function log_stream ( stream, handler ) {
    let lines				= new LineParser();

    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
	lines.write( chunk );

	for ( let line of lines.drain() ) {
	    handler( line );
	}
    });
}

class LineParser {
    constructor () {
	this.remnant			= "";
	this.lines			= [];
    }

    write ( chunk ) {
	let lines			= chunk.split("\n");

	lines[0]			= this.remnant + lines[0];
	this.remnant			= lines.pop();

	for ( let line of lines ) {
	    this.lines.push( line );
	}
    }

    drain () {
	let new_lines			= this.lines;
	this.lines			= [];

	return new_lines;
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
    normalize_conductor_stderr,
    log_stream,
    LineParser,
    mktmpdir,
};
