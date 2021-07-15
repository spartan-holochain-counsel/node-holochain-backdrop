
const path				= require('path');
const getAvailablePort			= require('get-port');


const NetworkType = {
    QuicBootstrap: 'quic_bootstrap',
    QuicMdns: 'quic_mdns',
}

const TransportConfigType = {
    Mem: 'mem',
    Quic: 'quic',
    Proxy: 'proxy',
}

const default_network= {
    "network_type": NetworkType.QuicBootstrap,
    "transport_pool": [{
	"type": TransportConfigType.Quic,
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
	"network": default_network,
    });
}

module.exports = {
    generate,
};
