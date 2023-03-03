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
    "bootstrap_service": "https://devnet-bootstrap.holo.host",
    "transport_pool": [{
	"type": TRANSPORT_QUIC,
    }],
}


async function generate ( base_dir, admin_port ) {
    const port				= admin_port || await getAvailablePort();

    log.info("Determined admin port to be (given port: %s): %s", admin_port, port );
    return Object.assign({
	"environment_path": path.resolve( base_dir, "databases" ),
	"keystore": {
	    "type": "lair_server",
	    "keystore_path": path.resolve( base_dir, "lair" ),
	    "danger_passphrase_insecure_from_config": "",
	},
	"admin_interfaces": [{
	    "driver": {
		"type": "websocket",
		"port": port,
	    },
	}],
	"network": DEFAULT_NETWORK_CONFIG,
	"db_sync_strategy": "Fast",
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
