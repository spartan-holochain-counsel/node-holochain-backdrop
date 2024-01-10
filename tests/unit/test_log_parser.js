import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-log-parser", process.env.LOG_LEVEL );

import fs				from 'fs';
import path				from 'path';
import { expect }			from 'chai';
import { parse_line,
	 column_eclipse_right,
	 column_eclipse_left }		from '../../src/utils.js';


const __dirname				= path.dirname( new URL(import.meta.url).pathname );
const LOGS				= fs.readFileSync( path.resolve( __dirname, "../holochain_log_example.txt"), "utf8" );

function basic_tests () {
    it("should categorize and parse Holochain output", async function () {
	let unknown_formats		= [];

	for ( let line of LOGS.split("\n") ) {
	    let content			= parse_line( line );

	    if ( content.type === "unknown" ) {
		unknown_formats.push( line );
		log.level_rank > 2 && console.log( content.type, line );
	    }
	    else if ( content.type === "print" )
		log.normal("\x1b[37m%s\x1b[0m", content.message );
	    else if ( content.type === "multiline" ) {
		log.normal("\x1b[37m%s\x1b[0m", content.message );
	    }
	    else if ( content.group === null || content.location === null ) {
		unknown_formats.push( line );
		log.level_rank > 2 && console.log( `\x1b[33m${line}\x1b[0m` );
		// console.log(
		//     column_eclipse_right( content.type, 20 ),
		//     content.date,
		//     content.level,
		//     content.text,
		// );
	    }
	    else {
		log[content.level]( content.formatted, content.metadata );
		// log.trace(
		//     "\x1b[35;22m%s \x1b[0m%s \x1b[0m| \x1b[36;22m%s\x1b[0m | \x1b[39m%s\x1b[0m",
		//     content.date.toISOString(),
		//     content.level.toUpperCase().slice(0,5).padStart(5),
		//     column_eclipse_left( content.context, 48 ),
		//     content.message,
		//     content.metadata,
		// );
	    }
	}

	expect( unknown_formats		).to.have.length( 0 );
    });
}

describe("Log Parser", () => {

    describe("Basic", basic_tests );

});
