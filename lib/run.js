var runremote = require('./run-remote');
var debug = require('./debug');
var zfs = require('./zfs').zfs;

module.exports = run

function run(opts, cb) {
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