var once = require('once');
var run = require('./run');
var debug = require('./debug');

var CB_WAIT = process.env.ZSYNC_RECEIVE_CB_WAIT || 500;

module.exports = send;

/*
 * send(opts, cb)
 * 
 * Send a dataset via opts.stream.
 * 
 * * opts
 *   * stream - a writable on which zfs send stream data is written
 *   * incremental - the from snapshot
 *	 * intermediary - Include intermediary snapshots with the stream
 *	 * properties -send dataset properties with the stream
 *	 * snapshot - the location of the snapshot. Following structure must be used: pool/project/production@today (must exist)
 *	 * verbose - emit verbose events containing the contents of stderr
 *	 * replication - create a replication stream
 * 
 * Note:
 * 
 * Sometimes an error event is emitted after the stream has closed. We want
 * to properly report the error when we call the callback. So there is a CB_WAIT
 * millisecond wait. Configurable by the environment variable ZSYNC_RECEIVE_CB_WAIT,
 * defaults to 500.
 * 
 */

function send(opts, cb) {
	cb = once(cb);

	var cbtimer;
	
	opts.command = 'send';
	opts.verbose = true;

	run(opts, function (err, sendStream) {
		if (err) {
			return maybeCallback(err);
		}

		sendStream.on('error', function (err) {
			//suppress ECONNRESET errors
			if (err.code === 'ECONNRESET') {
				debug('send(): sendStream.on(error): suppressing ECONNRESET error', err);
				return;
			}

			debug('send(): sendStream.on(error):', err);
			
			return maybeCallback(err);
		});

		sendStream.on('verbose', function (data) {
			debug('send(): sendStream.on(verbose):', data);

			process.stderr.write(data);
		});

		sendStream.on('close', function () {
			debug('send(): sendStream.on(close)');

			return maybeCallback();
		});

		sendStream.pipe(opts.stream);
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