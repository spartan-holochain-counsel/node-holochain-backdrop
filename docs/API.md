[back to README.md](../README.md)

# API Reference

Examples assume the module is loaded like this
```javascript
const { Holochain, Config } = require('@whi/holochain-backdrop');
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


### `<Holochain>.backdrop( happs, { app_port, actors, network_seed }) -> Promise<object>`
A method that will create Agent keys, register DNAs, and install Apps for each Agent.

- `happs` - (*required*) an object with
  - `key` - an `app_id_prefix` used to create app IDs combined with agent names
  - `value` - the hApp input for install app (ie. file path, bundle, or DNA map)
    - see [`installApp(...)`](https://github.com/mjbrisebois/js-holochain-client/blob/master/docs/API_AdminClient.md) for more details
    - also excepts a map of role names to DNA file paths
- Optional
  - `app_port` - the port to attach for the app interface
    - defaults to an available port
  - `actors` - an array of names for agent clients
    - defaults to `[ "alice" ]`
  - `network_seed` - a custom network seed when installing the app
    - defaults to a random hex
    - specify `null` to clear default

Returns a Promise that resolves with configuration details when setup is completed.

Example usage
```javascript
let holochain = new Holochain();

await holochain.start();

let actors = await holochain.backdrop({
    "happ1": "/some/path/to/happ1/file.happ",
    "happ2": {
        "happ2_dna1": "/some/path/to/dna/file.dna",
    },
    "happ3": {
        "manifest": {
            "manifest_version": "1",
            "name": "happ #3",
            "roles": [{
                "name": "happ3_dna1",
                "dna": {
                    "path": "/some/path/to/dna/file.dna",
                },
            }]
        },
        "resources": {},
    },
});

// Example response
// {
//     "alice": {
//         "happ1": {
//             "id": "happ1-alice",
//             "actor": "alice",
//             "agent": new AgentPubKey("uhCAkUhoH4om32FQE7IBkSngR-eL-y7GbkmJ52RgtydvYBo8NM_cN"),
//             "client": new AgentClient(...),
//             "source": "/some/path/to/happ1/file.happ"
//             "cells": {
//                 "happ1_dna1": {
//                     "name": "happ1_dna1",
//                     "id": [
//                         new DnaHash("uhC0k83KXkKeWh4Lp5kZjo4efO2KFKDfxBnuJDc6o_CgA3K9ShTPs"),
//                         new AgentPubKey("uhCAkUhoH4om32FQE7IBkSngR-eL-y7GbkmJ52RgtydvYBo8NM_cN")
//                     ],
//                     "dna": new DnaHash("uhC0k83KXkKeWh4Lp5kZjo4efO2KFKDfxBnuJDc6o_CgA3K9ShTPs"),
//                     "agent": new AgentPubKey("uhCAkUhoH4om32FQE7IBkSngR-eL-y7GbkmJ52RgtydvYBo8NM_cN"),
//                 }
//             }
//         },
//         "happ2": {
//             "id": "happ2-alice",
//             ...
//             "source": {
//                 "manifest": {
//                     "manifest_version": "1",
//                     "name": "happ2",
//                     "roles": [{
//                         "name": "happ2_dna1",
//                         "dna": {
//                             "path": "/some/path/to/dna/file.dna",
//                         },
//                     }]
//                 },
//                 "resources": {},
//             },
//             "cells": {
//                 "happ2_dna1": {
//                     "name": "happ2_dna1",
//                     ...
//                 }
//             }
//         },
//         "happ3": {
//             "id": "happ3-alice",
//             ...
//             "source": {
//                 "manifest": {
//                     "manifest_version": "1",
//                     "name": "happ #3",
//                     "roles": [{
//                         "name": "happ3_dna1",
//                         "dna": {
//                             "path": "/some/path/to/dna/file.dna",
//                         },
//                     }]
//                 },
//                 "resources": {},
//             },
//             "cells": {
//                 "happ3_dna1": {
//                     "name": "happ3_dna1",
//                     ...
//                 }
//             }
//         },
//     }
// }
```
