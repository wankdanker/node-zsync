var debug = require('./debug');
var run = require('./run');
var gatherJSON = require('./gather-json');
var Progress = require('./progress');
var CB_WAIT = process.env.ZSYNC_RECEIVE_CB_WAIT || 500;

module.exports = sendreceive;

/*
 * sendreceive(opts, cb)
 * 
 * Initiate a zfs send and pipe it to a zfs receive optionally on a remote server
 * 
 * * opts
 *   * source - source dataset name
 *   * sourceHost - host on which the source dataset resides
 *   * destination - destination dataset (base name); eg: pool2
 *   * destinationHost - host on which the destination dataset resides
 *   * fromSnap - for an incremental send, the snapshot that marks the beginning of the incremental period
 *   * toSnap - the snapshot to send
 *   * force - force receive (zfs receive -F)
 *   * replication - create a replication send stream
 *   * intermediary - send intermediary snapshots when doin and incremental send
 *
 * Note:
 * 
 * Sometimes an error event is emitted after the stream has closed. We want
 * to properly report the error when we call the callback. So there is a CB_WAIT
 * millisecond wait. Configurable by the environment variable ZSYNC_RECEIVE_CB_WAIT,
 * defaults to 500.
 * 
 */

function sendreceive(opts, cb) {
	var receiveStream;
	var sendStream;
	var returnErrors = [];
	var returnValue;
	var cbtimer;
	
	debug('sendreceive(%s:%s->%s:%s): sending from %s to %s'
		, opts.sourceHost || 'local', opts.source, opts.destinationHost || 'local', opts.destination
		, opts.fromSnap, opts.toSnap);

	initializeReceive();

	function initializeReceive () {
		debug('sendreceive(): initializing receive');

		run({
			command : 'receive'
			, destination : opts.destination
			, host : opts.destinationHost
			, streams : (opts.destinationHost) ? true : false
			, verbose : true
			, force : opts.force
			, user : opts.user
			, key : opts.key
		}, function (err, s) {
			receiveStream = s;

			if (err) {
				err.message = "Error setting up destination receive: " + err.message;
				return cb(err);
			}

			//if we are doing a remote receive then we need to
			//gather the JSON response
			if (opts.destinationHost) {
				receiveStream.pipe(gatherJSON(function (err, data) {
					debug('sendreceive(%s:%s->%s:%s): ReceiveStream: gather cb:', opts.sourceHost || 'local', opts.source
						, opts.destinationHost || 'local', opts.destination, err, data);

					if (err) {
						sendStream.end();
					}

					returnErrors.push(err);
					returnValue = data;
					
					receiveStream.ended = true;
					maybeFinish();
				}));
			}
			else {
				receiveStream.on('close', function () {
					debug('sendreceive(%s:%s->%s:%s): ReceiveStream.on(close)', opts.sourceHost || 'local', opts.source
						, opts.destinationHost || 'local', opts.destination);
				
					receiveStream.ended = true;
					maybeFinish();
				});
			}

			receiveStream.on('error', function (err) {
				debug('sendreceive(%s:%s->%s:%s): ReceiveStream.on(error):', opts.sourceHost || 'local', opts.source
					, opts.destinationHost || 'local', opts.destination, err);
				
				sendStream.end();
				
				//ignore ENOTCONN errors
				if (err.code === 'ENOTCONN' || err.code === 'ECONNRESET') {
					debug('sendreceive(%s:%s->%s:%s): ReceiveStream.on(error): supressing previously reported error (not calling back)'
						, opts.sourceHost || 'local', opts.source
						, opts.destinationHost || 'local', opts.destination);
					return;
				}
				
				//put the receiveStream errors at the beginning of the array
				returnErrors.unshift(err);
			});

			receiveStream.on('verbose', function (data) {
				debug('sendreceive(%s:%s->%s:%s): ReceiveStream.on(verbose):', opts.sourceHost || 'local',  opts.source
					, opts.destinationHost || 'local', opts.destination, data.trim());
			});

			initializeSend();
		});
	}

	function initializeSend() {
		debug('sendreceive(): initializing send');
		
		run({
			command : 'send'
			, incremental : opts.fromSnap
			, intermediary : (opts.hasOwnProperty('intermediary')) ? opts.intermediary : true
			, properties : opts.properties
			, snapshot : opts.toSnap
			, verbose : true
			, replication : opts.replication
			, host : opts.sourceHost
			, streams : (opts.sourceHost) ? true : false
			, user : opts.user
			, key : opts.key
		}, function (err, s) {
			sendStream = s;
			sendStream.on('error', function (err) {
				debug('sendreceive(%s->%s): SendStream.on(error):', opts.source, opts.destination, err);
				
				//ignore ENOTCONN errors
				if (err.code === 'ENOTCONN') {
					return;
				}
				
				//put the sendStream errors at the end of the array
				returnErrors.push(err);
			});

			sendStream.on('close', function () {
				debug('sendreceive(%s->%s): SendStream.on(close)', opts.source, opts.destination);

				sendStream.ended = true;
				maybeFinish();
			});

			sendStream.on('verbose', function (data) {
				data = data.trim();
				debug('sendreceive(%s->%s): SendStream.on(verbose):', opts.source, opts.destination, data);

				var progress = Progress(data);

				//debug('sendreceive(%s->%s): SendStream.on(verbose):', opts.source, opts.destination, progress);
			});

			sendStream.pipe(receiveStream);
		});
	}

	function maybeFinish() {
		debug('sendreceive(%s->%s): maybeFinish', opts.source, opts.destination, sendStream.ended, receiveStream.ended);

		if (!sendStream.ended || !receiveStream.ended) {
			return;
		}
		
		if (typeof cbtimer === 'undefined') {
			return cbtimer = setTimeout(maybeFinish, CB_WAIT);
		}
		
		var err = returnErrors[0];
		if (err) {
			err.errors = returnErrors;
		}
		
		cb(err, returnValue);
	}
}
