[back to README.md](../README.md)

# API Reference

Examples assume the module is loaded like this
```javascript
const { Holochain, Config } = require('@spartan-hc/holochain-backdrop');
```

### Module exports
```javascript
{
    Holochain,
    Config,
    TimeoutError,
}
```

## `new Holochain( options )`
A class for managing the configuration and lifecycle of a `holochain` process and it's requirements
(eg. `lair-keystore`).

- `options.config.path` - (*optional*) path to the config YAML for Holochain
  - defaults to `fs.mkdtemp() + "/config.yaml"`
- `options.config.construct` - (*optional*) a callback function for building the config object
- `options.config.admin_port` - (*optional*) the admin port that will be used if generating a config
  - defaults to some available port
- `options.lair_log` - (*optional*) set the logging level for Lair
  - defaults to `info`
- `options.conductor_log` - (*optional*) set the logging level for Holochain (conductor)
  - defaults to `info`
- `options.default_loggers` - alias for options `default_stdout_loggers` and `default_stderr_loggers`
- `options.default_stdout_loggers` - add the default console loggers for Lair and Conductor `stdout`
  - defaults to `false`
- `options.default_stderr_loggers` - add the default console loggers for Lair and Conductor `stderr`
  - defaults to `false`

Example usage
```javascript
let holochain = new Holochain({
    "config": {
        "path": process.cwd() + "/config.yaml",
        async construct () => {
            return await Config.generate();
        },
        "admin_port": null,
    },
    "lair_log": "info",
    "conductor_log": "debug",
});
```

#### Config Option Logic
By default, when `config` values are not provided, a new temporary directory is created and
destroyed for each instance of `Holochain`.

- `config.path` - if present, this option will be used as the location for the `holochain` config
  file.
  - If the given config path exists, it is used as-is with no modifications.
  - If the given config path does not exist, the config file is generated.  It will use the given
    path's basedir as the location for Lair and Conductor's storage.
- `config.construct` - if present, this function will be called and should return the desired
  configuration object for `config.yaml`.
- `config.admin_port` - if present, this number will be used as the admin port when generating a
  config.  Otherwise, if the `config.path` exists, it will throw an error.


### `<Holochain>.setup() -> Promise<string>`
Setup is run by the class `constructor`, but this method provides a way to know when the setup has
completed.

Returns a Promise that resolves with the base directory used for Lair and Holochain storage.

Example usage
```javascript
let holochain = new Holochain();

let basedir = await holochain.setup();
// Example basedir value
// "/run/user/1000/conductor-gCFFcv/"
```

### `<Holochain>.adminPorts() -> Array<number>`
Returns a list of the admin ports gathered from the configuration file.

Example usage
```javascript
let holochain = new Holochain();

await holochain.setup();

holochain.adminPorts();
// eg. [ 43811 ]
```

Example failure mode
```javascript
let holochain = new Holochain();

holochain.adminPorts();
// throw Error because setup has not finished
```


### `<Holochain>.start( timeout ) -> Promise<undefined>`
Start the `lair-keystore` and `holochain` subprocesses.

- `timeout` - (*optional*) sets the maximum time in milliseconds for startup
  - throws a `TimeoutError` if limit is reached
  - defaults to `60_000` (60 seconds)

Returns a Promise that resolves when the "ready" output is detected for both subprocesses.

Example usage
```javascript
let holochain = new Holochain();

await holochain.start();
```


### `<Holochain>.ready() -> Promise<undefined>`
Returns a Promise that resolves when `start()` has completed.

Example usage
```javascript
let holochain = new Holochain();

holochain.start();

await holochain.ready();
```


### `<Holochain>.stop() -> Promise<array>`
Stop Lair and Conductor subprocesses.

Returns a Promise that resolves with exit statuses when both subprocesses have closed.

Example usage
```javascript
let holochain = new Holochain();

await holochain.start();

let statuses = await holochain.stop();

// statuses[0] is the Lair SubProcess.stop() result
// statuses[1] is the Conductor SubProcess.stop() result
// [
//     {
//         "code": null,
//         "signal": "SIGTERM"
//     },
//     {
//         "code": null,
//         "signal": "SIGTERM"
//     },
// ]
```


### `<Holochain>.destroy() -> Promise<undefined>`
This will run `stop()` but will also cleanup any temporary files or directories.

Returns a Promise that resolves when the subprocesses are stopped and the temporary directories have
been removed.

Example usage
```javascript
let holochain = new Holochain();

await holochain.start();

await holochain.destroy();
```


### `<Holochain>.install( profiles, configs, defaults ) -> Promise<object>`
A method that will create Agent keys, register DNAs, and install Apps for each Agent.

- `profiles` - (*required*) an array of names for agent clients
  - accepts `string` as a single profile name
- `configs` - (*required*) a list of objects with
  - `bundle` - (*required*) the hApp input for install app (ie. file path, bundle, or DNA map)
  - `app_name` - (*optional*) a `string` used as the prefix for `installed_app_id`
    - defaults to a random hex
  - `installed_app_id` - (*optional*) manually override the derived ID
    - defaults to `${app_name}-${profile}`
  - `network_seed` - (*optional*) manually override the seed
    - defaults to a random hex
  - Any additional options available for [`AdminClient.installApp( ... )`](https://github.com/spartan-holochain-counsel/holochain-admin-client-js/blob/master/docs/API.md)
- `defaults` - (*optional*) an object with
  - `network_seed` - (*optional*) a custom network seed when installing the app
    - specify `null` to clear default
  - Any additional options available for [`AdminClient.installApp( ... )`](https://github.com/spartan-holochain-counsel/holochain-admin-client-js/blob/master/docs/API.md)

Returns a Promise that resolves with configuration details when setup is completed.

Example usage
```javascript
let holochain = new Holochain();

await holochain.start();

const { alice }                     = await holochain.install( "alice", [
    "../test.happ",
    {
        "app_name": "happ1",
        "bundle": "../test.happ",
        "network_seed": "*",
    },
    {
        "app_name": "happ2",
        "bundle": {
            "dna1": "../test.dna",
        },
        "network_seed": "*",
    },
    {
        "app_name": "happ3",
        "bundle": {
            "manifest": {
                "manifest_version": "1",
                "name": "test",
                "roles": [{
                    "name": "test_dna",
                    "dna": {
                        "path": "../test.dna",
                        "modifiers": {
                            "network_seed": "1",
                        },
                    },
                }]
            },
            "resources": {},
        },
        "network_seed": null,
    },
]);
```
