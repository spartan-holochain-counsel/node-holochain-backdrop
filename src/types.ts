
export type DnaMap = Record<string, string>;

export type RoleDnaConfig = Partial<{
    path:			string;
    modifiers:			any;
}>;

export type RoleConfig = Partial<{
    name:			string;
    dna:			Partial<RoleDnaConfig>;
}>;

export type HappBundle = {
    manifest: Partial<{
	manifest_version:	string;
	name:			string;
	roles:			Array<RoleConfig>;
    }>,
    resources:			Record<string, Uint8Array>;
};

export type InstallInput = {
    app_name?:			string;
    installed_app_id?:		string;
    bundle:			string | DnaMap | HappBundle;
    network_seed?:		string;
    membrane_proofs?:		Record<string, any>;
};

export type InstallDefaults = {
    network_seed?:		string;
    membrane_proofs?:		Record<string, any>;
};

export type InstallResult = {
    app_name?:			string;
    network_seed:		string;
    app_info:			any;
};

export type CreateAppConfigInput = {
    app_name?:			string;
    installed_app_id?:		string;
    bundle:			string | DnaMap | HappBundle;
};

export type HolochainDefaults = {
    lair_log?:			string;
    conductor_log?:		string;
    default_loggers?:		boolean;
    default_stdout_loggers?:	boolean;
    default_stderr_loggers?:	boolean;
    timeout?:			number;
    name?:			string;
    cleanup?:			boolean;
};

export type HolochainOptions = {
    lair_log:			string;
    conductor_log:		string;
    default_loggers:		boolean;
    default_stdout_loggers:	boolean;
    default_stderr_loggers:	boolean;
    timeout:			number;
    name:			string;
    cleanup:			boolean;
    config?:			any;
};

export type AdminInterface = {
    type:			string;
    port:			number;
};

export type AdminDriver = {
    driver:			AdminInterface;
};

export type KeyStoreConfig = {
    type:					string;
    keystore_path:				string;
    connection_url:				string;
    danger_passphrase_insecure_from_config:	string;
};

export enum NetworkType {
    QuicBootstrap = "quic_bootstrap",
    QuicMDNS = "quic_mdns",
};

export enum TransportType {
    Mem = "mem",
    WebRTC = "webrtc",
    Proxy = "proxy",
};

export type TransportConfig = {
    type:			TransportType;
    signal_url:			string;
};

export type NetworkConfig = {
    network_type:		NetworkType;
    transport_pool:		Array<TransportConfig>;
};

export type HolochainConfig = {
    data_root_path:		string;
    keystore:			KeyStoreConfig;
    admin_interfaces:		Array<AdminDriver>;
    network:			NetworkConfig;
    db_sync_strategy:		string;
};
