var once = require('once');
var run = require('./run');
var debug = require('./debug');

module.exports = receive;

/*
 * receive(opts, cb)
 * 
 * Receive a dataset via opts.stream.
 * 
 * * opts
 *   * stream - a readable stream whose data is a zfs send stream
 * 
 */

function receive(opts, cb) {
	cb = once(cb);

	opts.command = 'receive';
	opts.verbose = true;

	run(opts, function (err, receiveStream) {
		if (err) {
			return cb(err);
		}

		receiveStream.on('error', function (err) {
			//suppress ECONNRESET errors
			if (err.code === 'ECONNRESET') {
				return;
			}

			debug('receive(): receiveStream.on(error):', err);

			cb(err);
		});

		receiveStream.on('verbose', function (data) {
			debug('receive(): receiveStream.on(verbose):', data);

			process.stderr.write(data);
		});

		receiveStream.on('close', function () {
			debug('receive(): receiveStream.on(close)');

			cb();
		});

		opts.stream.pipe(receiveStream);
	});
}