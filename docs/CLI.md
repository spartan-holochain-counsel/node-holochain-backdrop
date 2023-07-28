[back to README.md](../README.md)

# CLI Examples

### Install
```bash
npm install @spartan-hc/holochain-backdrop
```

See help output for detailed usage and options
```
[shell:~]$ npx holochain-backdrop --help
```


## Basic usage

Example
```
[shell:~]$ npx holochain-backdrop
Starting Holochain in "/run/user/1000/conductor-lmNSnE"...
2021-07-30T22:20:48.707Z      Lair STDOUT: #lair-keystore-ready#
2021-07-30T22:20:48.709Z      Lair STDOUT: #lair-keystore-version:0.0.1-alpha.12#
2021-07-30T22:20:48.823Z Conductor STDOUT:
2021-07-30T22:20:48.823Z Conductor STDOUT: ###HOLOCHAIN_SETUP###
2021-07-30T22:20:48.823Z Conductor STDOUT: ###ADMIN_PORT:43253###
2021-07-30T22:20:48.823Z Conductor STDOUT: ###HOLOCHAIN_SETUP_END###
2021-07-30T22:20:48.823Z Conductor STDOUT: Conductor ready.
Holochain is ready
```


## Set Log Levels

Turn up the verbosity with `-v`; starts at level **warn**.

- `-v` - turn up to **normal** (lair and conductor level is still **warn**)
- `-vv` - turn up to **info**
- `-vvv` - turn up to **debug**
- `-vvvv` - turn up to **trace**

```
[shell:~]$ npx holochain-backdrop -vvvv
```


## Custom Admin Port

```
[shell:~]$ npx holochain-backdrop --admin-port 33010
```

> **Warning:** the admin port can only be specified when generating a config file.  This means that
> using --admin-port with --config will not be idempotent.  The first time will generate a config
> that uses the given admin port, but any subsequent attempts will throw a `ConfigurationError`.


## Config File
By default, a temporary directory is created and destroyed everytime and a generic config is used in
that directory.

By giving the `--config <path>` option, it will create or use a config file at the given location.
```
[shell:~]$ ls -la holochain
ls: cannot access 'holochain': No such file or directory

[shell:~]$ npx holochain-backdrop --config holochain/config.yaml

[shell:~]$ ls -la holochain
-rw-r--r-- 1 user group  281 Aug  1 07:29 config.yaml
drwxr-xr-x 8 user group 4096 Jul 27 17:46 databases
drwxr-xr-x 2 user group 4096 Aug  1 07:29 lair
```
