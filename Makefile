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
test:			build test-setup
	npx mocha --recursive ./tests
test-debug:		build test-setup
	LOG_LEVEL=silly npx mocha --recursive ./tests

test-unit:		build test-setup
	npx mocha ./tests/unit
test-unit-debug:	build test-setup
	LOG_LEVEL=silly npx mocha ./tests/unit

test-integration:	build test-setup
	npx mocha ./tests/integration
test-integration-debug:	build test-setup
	LOG_LEVEL=silly npx mocha ./tests/integration
test-setup:
	rm -rf tests/tmp/

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
