[back to README.md](README.md)

# Contributing

## Overview
This module is intended to help configure, run, and setup Holochain for local development.

- It should not provide the testing framework
- It should not provide the client for App interface

## Development

### Environment

- Developed using Node.js `v18.14.2`

### Building
No build required.  Vanilla JS only.

### Testing

To run all tests with logging
```
make test-debug
```

- `make test-unit-debug` - **Unit tests only**
- `make test-integration-debug` - **Integration tests only**

> **NOTE:** remove `-debug` to run tests without logging
