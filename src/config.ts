import path				from 'path';
import { Logger }			from '@whi/weblogger';
const __dirname				= path.dirname( new URL(import.meta.url).pathname );
const log				= new Logger(
    "config",
    (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal'
);

import getAvailablePort			from 'get-port';

import {
    HolochainConfig,
}					from './types.js';


export const NETWORK_QUICBOOTSTRAP	= "quic_bootstrap";
export const NETWORK_QUICMDNS		= "quic_mdns";

export const TRANSPORT_MEM		= "mem";
export const TRANSPORT_WEBRTC		= "webrtc";
export const TRANSPORT_PROXY		= "proxy";

export const DEFAULT_NETWORK_CONFIG	= {
    "network_type": NETWORK_QUICBOOTSTRAP,
    "transport_pool": [{
	"type": TRANSPORT_WEBRTC,
	"signal_url": "wss://signal.holo.host/",
    }],
    // "transport_pool": [{
    // 	"type": TRANSPORT_PROXY,
    // 	"proxy_config": {
    //         "proxy_url": "kitsune-proxy://f3gH2VMkJ4qvZJOXx0ccL_Zo5n-s_CnBjSzAsEHHDCA/kitsune-quic/h/137.184.142.208/p/5788/--",
    //         "type": "remote_proxy_client",
    // 	},
    // 	"sub_transport": {
    //         "type": TRANSPORT_QUIC,
    // 	},
    // }],
}


export async function generate (
    base_dir:		string,
    admin_port?:	number | null,
) : Promise<HolochainConfig> {
    const port				= admin_port || await getAvailablePort();

    log.info("Determined admin port to be (given port: %s): %s", admin_port, port );
    return Object.assign({
	"data_root_path": path.resolve( base_dir, "databases" ),
	"keystore": {
	    "type": "lair_server",
	    "keystore_path": path.resolve( base_dir, "lair" ),
	    "connection_url": "**will be replaced at runtime**",
	    "danger_passphrase_insecure_from_config": "",
	},
        "dpki": {
            "dna_path": null,
            "network_seed": "",
            "allow_throwaway_random_dpki_agent_key": false,
            "no_dpki": true,
        },
	"admin_interfaces": [{
	    "driver": {
		"type": "websocket",
		"port": port,
		"allowed_origins": "*",
	    },
	}],
	"network": DEFAULT_NETWORK_CONFIG,
	"db_sync_strategy": "Fast",
    });
}


export default {
    generate,

    DEFAULT_NETWORK_CONFIG,

    NETWORK_QUICBOOTSTRAP,
    NETWORK_QUICMDNS,

    TRANSPORT_MEM,
    TRANSPORT_WEBRTC,
    TRANSPORT_PROXY,
};
