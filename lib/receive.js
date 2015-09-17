var once = require('once');
var run = require('./run');
var debug = require('./debug');

var CB_WAIT = process.env.ZSYNC_RECEIVE_CB_WAIT || 5000;

module.exports = receive;

/*
 * receive(opts, cb)
 * 
 * Receive a dataset via opts.stream.
 * 
 * * opts
 *   * stream - a readable stream whose data is a zfs send stream
 * 
 * Note:
 * 
 * Sometimes an error event is emitted after the stream has closed. We want
 * to properly report the error when we call the callback. So there is a CB_WAIT
 * millisecond wait. Configurable by the environment variable ZSYNC_RECEIVE_CB_WAIT,
 * defaults to 5000.
 * 
 */

function receive(opts, cb) {
	cb = once(cb);

	var cbtimer;
	
	opts.command = 'receive';
	opts.verbose = true;

	run(opts, function (err, receiveStream) {
		if (err) {
			return maybeCallback(err);
		}

		receiveStream.on('error', function (err) {
			//suppress ECONNRESET errors
			if (err.code === 'ECONNRESET') {
				debug('receive(): receiveStream.on(error): suppressing ECONNRESET error', err);
				return;
			}

			debug('receive(): receiveStream.on(error):', err);
			
			return maybeCallback(err);
		});

		receiveStream.on('verbose', function (data) {
			debug('receive(): receiveStream.on(verbose):', data);

			process.stderr.write(data);
		});

		receiveStream.on('close', function () {
			debug('receive(): receiveStream.on(close)');

			return maybeCallback();
		});

		opts.stream.pipe(receiveStream);
	});
	
	function maybeCallback(err) {
		//if we received an error then call back immediately
		if (err) {
			cb(err);
		}
		
		if (typeof cbtimer === 'undefined') {
			return cbtimer = setTimeout(maybeCallback, CB_WAIT);
		}
		
		cb();
	}
}