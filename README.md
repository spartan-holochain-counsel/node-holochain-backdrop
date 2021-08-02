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
