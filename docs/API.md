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

Example usage
```javascript
let holochain = new Holochain({
    "config": {
        "path": process.cwd() + "/config.yaml",
        "construct": () => {
            return Config.generate();
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


### `<Holochain>.start() -> Promise<undefined>`
Start the `lair-keystore` and `holochain` subprocesses.

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


### `<Holochain>.backdrop( app_id_prefix, app_port, dnas, agents ) -> Promise<object>`
A method that will create Agent keys, register DNAs, and install Apps for each Agent.

- `app_id_prefix` - (*required*) used to create app IDs combined with agent names
  - eg. `<app_id_prefix>-<agent>`
- `app_port` - (*required*) the port to attach for the app interface
- `dnas` - (*required*) an object with
  - `key` - the DNA role ID
  - `value` - the file path for the DNA package
- `agents` - (*optional*) an array of names for agent clients
  - defaults to `[ "alice" ]`

Returns a Promise that resolves with agent configurations when administrative calls are completed.

Example usage
```javascript
let holochain = new Holochain();

await holochain.start();

let clients = await holochain.backdrop( "my-app", 44910, {
    "dna_role_id": "/some/path/to/dna/file.dna",
}, [
    "alice",
    "bobby",
]);

// Example response (value of 'clients')
// {
//     "alice": {
//         "id": "my-app-alice",
//         "actor": "alice",
//         "agent": new AgentPubKey("uhCAkUhoH4om32FQE7IBkSngR-eL-y7GbkmJ52RgtydvYBo8NM_cN"),
//         "cells": {
//             "dna_role_id": {
//                 "id": [
//                     new DnaHash("uhC0k83KXkKeWh4Lp5kZjo4efO2KFKDfxBnuJDc6o_CgA3K9ShTPs"),
//                     new AgentPubKey("uhCAkUhoH4om32FQE7IBkSngR-eL-y7GbkmJ52RgtydvYBo8NM_cN")
//                 ],
//                 "dna": new DnaHash("uhC0k83KXkKeWh4Lp5kZjo4efO2KFKDfxBnuJDc6o_CgA3K9ShTPs"),
//                 "agent": new AgentPubKey("uhCAkUhoH4om32FQE7IBkSngR-eL-y7GbkmJ52RgtydvYBo8NM_cN")
//             }
//         }
//     },
//     "bobby": {
//         "id": "my-app-bobby",
//         "actor": "bobby",
//         "agent": new AgentPubKey("uhCAkst6fYsuBhuKnOaA2dUd6IDm0WIHqZTUpuB1tfRtS_PcFqCYP"),
//         "cells": {
//             "dna_role_id": {
//                 "id": [
//                     new DnaHash("uhC0k83KXkKeWh4Lp5kZjo4efO2KFKDfxBnuJDc6o_CgA3K9ShTPs"),
//                     new AgentPubKey("uhCAkst6fYsuBhuKnOaA2dUd6IDm0WIHqZTUpuB1tfRtS_PcFqCYP")
//                 ],
//                 "dna": new DnaHash("uhC0k83KXkKeWh4Lp5kZjo4efO2KFKDfxBnuJDc6o_CgA3K9ShTPs"),
//                 "agent": new AgentPubKey("uhCAkst6fYsuBhuKnOaA2dUd6IDm0WIHqZTUpuB1tfRtS_PcFqCYP")
//             }
//         }
//     }
// }
```
