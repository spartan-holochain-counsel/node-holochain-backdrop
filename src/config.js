const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal',
});

const getAvailablePort			= require('get-port');


const NETWORK_QUICBOOTSTRAP		= "quic_bootstrap";
const NETWORK_QUICMDNS			= "quic_mdns";

const TRANSPORT_MEM			= "mem";
const TRANSPORT_QUIC			= "quic";
const TRANSPORT_PROXY			= "proxy";

const DEFAULT_NETWORK_CONFIG		= {
    "network_type": NETWORK_QUICBOOTSTRAP,
    "transport_pool": [{
	"type": TRANSPORT_QUIC,
    }],
}


async function generate ( base_dir, admin_port ) {
    const port				= admin_port || await getAvailablePort();

    log.info("Determined admin port to be (given port: %s): %s", admin_port, port );
    return Object.assign({
	"environment_path": path.resolve( base_dir, "databases" ),
	"keystore_path": path.resolve( base_dir, "lair" ),
	"admin_interfaces": [{
	    "driver": {
		"type": "websocket",
		"port": port,
	    },
	}],
	"network": DEFAULT_NETWORK_CONFIG,
    });
}


module.exports = {
    generate,

    DEFAULT_NETWORK_CONFIG,

    NETWORK_QUICBOOTSTRAP,
    NETWORK_QUICMDNS,

    TRANSPORT_MEM,
    TRANSPORT_QUIC,
    TRANSPORT_PROXY,
};
