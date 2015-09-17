var runremote = require('./run-remote');
var debug = require('./debug');
var zfs = require('./zfs').zfs;

module.exports = run

/*
 * run(opts, cb)
 * 
 * run a function in the zfs module, possibly remotely.
 * 
 * * opts
 *   * command - function name to call in the zfs module
 *   * host - if exists command will be executed on remote host
 */

function run(opts, cb) {
	//debug('run(): ', opts);
	
	if (opts.host) {
		opts.format = opts.format || 'json';
		
		fn = runremote;
	}
	else {
		if (!zfs[opts.command]) {
			throw new Error("command does not exist in zfs module: " + opts.command);
		}

		fn = zfs[opts.command];
	}

	fn(opts, cb);	
}