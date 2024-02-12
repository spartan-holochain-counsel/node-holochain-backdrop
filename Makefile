.PHONY:			FORCE

#
# Building
#
build:			FORCE lib/index.js
lib/index.js:		node_modules src/*.ts Makefile
	rm -f lib/*.js
	npx tsc -t es2022 -m es2022 --moduleResolution node --esModuleInterop \
		--outDir lib -d --sourceMap src/index.ts


#
# Project
#
package-lock.json:	package.json
	npm install
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@
build:			node_modules

use-local-holochain-client:
	npm uninstall @whi/holochain-client
	npm install --save ../js-holochain-client
use-npm-holochain-client:
	npm uninstall @whi/holochain-client
	npm install --save @whi/holochain-client


#
# Testing
#
DEBUG_LEVEL	       ?= fatal
TEST_ENV_VARS		= LOG_LEVEL=$(DEBUG_LEVEL)
MOCHA_OPTS		= -n enable-source-maps

test-setup:
	rm -rf tests/tmp/

test:			build test-setup
	$(TEST_ENV_VARS) npx mocha --recursive ./tests

test-unit:		build test-setup
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/unit

test-unit-holochain:	build test-setup
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/unit/test_holochain.js

#
# Repository
#
clean-remove-chaff:
	@find . -name '*~' -exec rm {} \;
clean-files:		clean-remove-chaff
	git clean -nd
clean-files-force:	clean-remove-chaff
	git clean -fd
clean-files-all:	clean-remove-chaff
	git clean -ndx
clean-files-all-force:	clean-remove-chaff
	git clean -fdx


#
# NPM
#
preview-package:	clean-files test
	npm pack --dry-run .
create-package:		clean-files test
	npm pack .
publish-package:	clean-files test
	npm publish --access public .
