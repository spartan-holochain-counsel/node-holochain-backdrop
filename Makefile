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

npm-reinstall-local:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save $(LOCAL_PATH)
npm-reinstall-public:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save $(NPM_PACKAGE)
npm-reinstall-dev-local:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save-dev $(LOCAL_PATH)
npm-reinstall-dev-public:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save-dev $(NPM_PACKAGE)

npm-use-admin-client-public:
npm-use-admin-client-local:
npm-use-admin-client-%:
	NPM_PACKAGE=@spartan-hc/holochain-admin-client LOCAL_PATH=../../admin-client-js make npm-reinstall-$*


#
# Testing
#
DEBUG_LEVEL	       ?= fatal
TEST_ENV_VARS		= LOG_LEVEL=$(DEBUG_LEVEL)
MOCHA_OPTS		= -n enable-source-maps

test-setup:
	rm -rf tests/tmp/

test:
	make -s test-unit
	make -s test-integration

test-unit:
	make -s test-unit-config
	make -s test-unit-log-parser

test-unit-config:		build test-setup
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/unit/test_config.js
test-unit-log-parser:		build test-setup
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/unit/test_log_parser.js

test-integration:
	make -s test-integration-basic
	make -s test-integration-cli
	make -s test-integration-holochain

test-integration-basic:	build test-setup
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/integration/test_basic.js
test-integration-cli:		build test-setup
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/integration/test_cli.js
test-integration-holochain:	build test-setup
	$(TEST_ENV_VARS) npx mocha $(MOCHA_OPTS) ./tests/integration/test_holochain.js



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
