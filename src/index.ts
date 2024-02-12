
import { AdminClient }			from '@spartan-hc/holochain-admin-client';

import * as Config			from './config.js';
import { Holochain,
	 TimeoutError }			from './holochain.js';


export { AdminClient }			from '@spartan-hc/holochain-admin-client';

export * as Config			from './config.js';
export { Holochain,
	 TimeoutError }			from './holochain.js';

export default {
    Holochain,
    Config,

    AdminClient,
    TimeoutError,
};
