
const path				= require('path');
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


async function generate ( base_dir ) {
    return Object.assign({
	"environment_path": path.resolve( base_dir, "databases" ),
	"keystore_path": path.resolve( base_dir, "lair" ),
	"admin_interfaces": [{
	    "driver": {
		"type": "websocket",
		"port": await getAvailablePort(),
	    },
	}],
	"network": DEFAULT_NETWORK_CONFIG,
    });
}


module.exports = {
    generate,

    NETWORK_QUICBOOTSTRAP,
    NETWORK_QUICMDNS,

    TRANSPORT_MEM,
    TRANSPORT_QUIC,
    TRANSPORT_PROXY,
};
