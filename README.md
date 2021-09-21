[![](https://img.shields.io/npm/v/@whi/holochain-backdrop/latest?style=flat-square)](http://npmjs.com/package/@whi/holochain-backdrop)

# Holochain Backdrop
A Javascript library for automating the setup of a Holochain development environment.


[![](https://img.shields.io/github/issues-raw/mjbrisebois/node-holochain-backdrop?style=flat-square)](https://github.com/mjbrisebois/node-holochain-backdrop/issues)
[![](https://img.shields.io/github/issues-closed-raw/mjbrisebois/node-holochain-backdrop?style=flat-square)](https://github.com/mjbrisebois/node-holochain-backdrop/issues?q=is%3Aissue+is%3Aclosed)
[![](https://img.shields.io/github/issues-pr-raw/mjbrisebois/node-holochain-backdrop?style=flat-square)](https://github.com/mjbrisebois/node-holochain-backdrop/pulls)


## Overview
Repeatedly configuring and running instances of `holochain` for development can have its
complexities.  The primary purpose of this module is to help establish a backdrop for testing your
DNAs or UI development.  It provides reliable controls for

-  starting/stopping the Lair/Holochain processes
-  installing Apps for one or more agents

> **Note:** this module does not include `lair-keystore` and `holochain` binaries.  They are
> expected to be in your environment.


### Holochain Version Map

| Holochain Version                                                                                  | Commit Date    | Lair Version                                                                                         | Holochain Backdrop Version                                                     |
|----------------------------------------------------------------------------------------------------|----------------|------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| [`v0.0.100`](https://github.com/holochain/holochain/tree/3bd9181ea35c32993d1550591fd19720b31065f6) | *Apr 20, 2021* | [`v0.0.1-alpha.12`](https://github.com/holochain/lair/tree/2998dd3ad21928115b3a531cbc319e61bc896b78) | [`v0.1.3`](https://github.com/mjbrisebois/node-holochain-backdrop/tree/v0.1.3) |
| [`v0.0.101`](https://github.com/holochain/holochain/tree/ea726cc05aa6064c3b8b4f85fddf3e89429f018e) | *Jul 1, 2021*  | [`v0.0.1-alpha.12`](https://github.com/holochain/lair/tree/2998dd3ad21928115b3a531cbc319e61bc896b78) | [`v0.2.0`](https://github.com/mjbrisebois/node-holochain-backdrop/tree/v0.2.0) |
| [`v0.0.102`](https://github.com/holochain/holochain/tree/6535292238dc1fbd2b60433a2054f7787e4f060e) | *Jul 29, 2021* | [`v0.0.1-alpha.12`](https://github.com/holochain/lair/tree/2998dd3ad21928115b3a531cbc319e61bc896b78) | [`v0.3.0`](https://github.com/mjbrisebois/node-holochain-backdrop/tree/v0.3.0) |
| [`v0.0.103`](https://github.com/holochain/holochain/tree/f3d17d993ad8d988402cc01d73a0095484efbabb) | *Aug 17, 2021* | [`v0.0.3`](https://github.com/holochain/lair/tree/6a9aab37c90566328c13c4d048d1afaf75fc39a9)          | [`v0.4.0`](https://github.com/mjbrisebois/node-holochain-backdrop/tree/v0.4.0) |
| [`v0.0.104`](https://github.com/holochain/holochain/tree/d003eb7a45f1d7125c4701332202761721793d68) | *Aug 25, 2021* | [`v0.0.4`](https://github.com/holochain/lair/tree/d3155ac98ec550c6b5eb097923556958015f9354)          | [`v0.5.1`](https://github.com/mjbrisebois/node-holochain-backdrop/tree/v0.5.1) |
| `v0.0.105` (never released)                                                                        | *Sep 1, 2021*  | [`v0.0.4`](https://github.com/holochain/lair/tree/d3155ac98ec550c6b5eb097923556958015f9354)          | N/A                                                                            |
| [`v0.0.106`](https://github.com/holochain/holochain/tree/b11908875a9f6a09e8939fbf6f45ff658e3d10a6) | *Sep 16, 2021* | [`v0.0.4`](https://github.com/holochain/lair/tree/d3155ac98ec550c6b5eb097923556958015f9354)          | [`v0.6.0`](https://github.com/mjbrisebois/node-holochain-backdrop/tree/v0.6.0) |


### Features

- No configuration use-case that uses temporary directories/files
- A CLI tool that provides some of the basic options
- Reliable start/stop and subprocess management
- App installation for setting up test scenarios

Tested against Holochain revision
[`3bd9181ea35c32993d1550591fd19720b31065f6`](https://github.com/holochain/holochain/tree/3bd9181ea35c32993d1550591fd19720b31065f6)

## Install

```bash
npm i @whi/holochain-backdrop
```

## Basic Usage

```javascript
const { Holochain } = require('@whi/holochain-backdrop');

let holochain = new Holochain();

holochain.on("lair:stdout", line => {
    console.log( "     Lair STDOUT:", line );
});

holochain.on("lair:stderr", line => {
    console.log( "     Lair STDERR:", line );
});

holochain.on("conductor:stdout", line => {
    console.log( "Conductor STDOUT:", line );
});

holochain.on("conductor:stderr", line => {
    console.log( "Conductor STDERR:", line );
});

await holochain.setup();
await holochain.start();

// ... do stuff

await holochain.stop();
await holochain.destroy();
```

## Basic CLI Usage

```
[shell:~]$ npx holochain-backdrop
```

### API Reference

See [docs/API.md](docs/API.md)

### CLI Reference

See [docs/CLI.md](docs/CLI.md)

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
